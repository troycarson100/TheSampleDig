import { cookies } from "next/headers"
import type Stripe from "stripe"
import { prisma } from "@/lib/db"
import { normalizeAffiliateCode } from "@/lib/affiliate-logic"
import { readAttributionMetadata } from "@/lib/attribution-snapshot"
import type { CompProduct } from "@/lib/plugin-products"
import { checkoutUrls, type CancelPath } from "@/lib/plugin-checkout-logic"

// Shared by the shft, drft and bundle checkout routes. Each route still picks
// its own price and runs its own ownership guards; this is the part that was
// copied three times.

export type CheckoutBuyer = { id: string; email: string | null }

/** The signed-in buyer for checkout, or null for a guest. The one definition
 *  of "signed in enough to buy", shared by the three checkout routes. */
export function buyerFromSession(
  session: { user?: { id?: string | null; email?: string | null } | null } | null | undefined,
): CheckoutBuyer | null {
  const id = session?.user?.id
  return id ? { id, email: session?.user?.email ?? null } : null
}

export function checkoutBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  )
}

/** A valid, currently-active ?ref= code from the shft_ref cookie, or null.
 *  The webhook re-validates it; this just keeps junk out of the metadata. */
export async function readAffiliateCodeFromCookie(label: string): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const raw = normalizeAffiliateCode(cookieStore.get("shft_ref")?.value)
    if (!raw) return null
    const affiliate = await prisma.affiliate.findUnique({ where: { code: raw } })
    return affiliate?.active ? raw : null
  } catch (e) {
    console.error(`[${label}] affiliate cookie read failed`, e)
    return null
  }
}

/**
 * One-time Checkout Session for a plugin, the bundle, or an arbitrary cart.
 *
 * `buyer` is null for a guest. A signed-in buyer's id is stamped as
 * client_reference_id and metadata.userId and their email prefilled. A guest
 * with no `guestEmail` gets neither and types their email into Checkout fresh
 * - the pattern every single-plugin/bundle route still uses, where there is
 * nothing upstream to bind to. `guestEmail` is for a caller that has already
 * checked something (ownership, ownership-by-email) against a specific
 * address before creating the session: passing it as `customer_email` makes
 * Stripe render that field read-only, so the identity that was checked is the
 * identity Checkout collects payment for and the webhook grants to - it
 * cannot be swapped for a different address at the payment step. metadata.guest
 * marks guest sessions (with or without a bound email) in the Stripe dashboard.
 *
 * Pass exactly one of `priceId` (the single-item shape every route used
 * before the cart existed) or `lineItems` (one entry per cart product, or a
 * single bundle-priced entry when the cart is the whole catalog) — adding the
 * second shape here, rather than a second session builder, is what keeps the
 * two from drifting apart. Any of `RESERVED_METADATA_KEYS` present in a
 * caller's `metadata` is dropped before merging - not merely overridden by a
 * later spread, which only protects a key the branch actually sets this call
 * (a guest session never sets `userId`, so an override-by-spread would still
 * have let a caller's `userId` survive on exactly that branch). Stripping the
 * reserved keys unconditionally means a caller can only ever add genuinely
 * new keys, never spoof, widen or blank the fields that decide who a session
 * belongs to and what it grants, regardless of which branch is live.
 */
/** Metadata keys this function alone decides - see createPluginCheckoutSession's
 *  doc comment. Kept in sync with the fields the session-create call below
 *  actually sets: `product`, the userId/guest pair, `affiliateCode`, and
 *  whatever readAttributionMetadata's four keys are. */
const RESERVED_METADATA_KEYS = [
  "product",
  "userId",
  "guest",
  "affiliateCode",
  "attrVisitorId",
  "attrReferrer",
  "attrSource",
  "attrCampaign",
] as const

function withoutReservedKeys(metadata: Record<string, string> | undefined): Record<string, string> {
  if (!metadata) return {}
  const clean: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (!(RESERVED_METADATA_KEYS as readonly string[]).includes(key)) clean[key] = value
  }
  return clean
}

export async function createPluginCheckoutSession(
  stripe: Stripe,
  opts: {
    product: CompProduct
    priceId?: string
    lineItems?: Stripe.Checkout.SessionCreateParams.LineItem[]
    paid: number
    cancelPath: CancelPath
    buyer: CheckoutBuyer | null
    affiliateCode: string | null
    /** A guest identity already checked against something by the caller (see
     *  above). Ignored when `buyer` is set - a signed-in buyer's own email
     *  always wins. */
    guestEmail?: string | null
    metadata?: Record<string, string>
  },
): Promise<Stripe.Checkout.Session> {
  const attrMetadata = await readAttributionMetadata()
  const { buyer } = opts
  const lineItems = opts.lineItems ?? (opts.priceId ? [{ price: opts.priceId, quantity: 1 }] : [])
  if (lineItems.length === 0) {
    throw new Error("createPluginCheckoutSession: neither priceId nor lineItems was given")
  }
  const customerEmail = buyer?.email ?? opts.guestEmail ?? null
  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    ...checkoutUrls(checkoutBaseUrl(), opts.product, opts.paid, opts.cancelPath),
    customer_creation: "always",
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    billing_address_collection: "auto",
    allow_promotion_codes: true,
    ...(buyer ? { client_reference_id: buyer.id } : {}),
    metadata: {
      ...withoutReservedKeys(opts.metadata),
      product: opts.product,
      ...(buyer ? { userId: buyer.id } : { guest: "1" }),
      ...(opts.affiliateCode ? { affiliateCode: opts.affiliateCode } : {}),
      ...attrMetadata,
    },
    custom_fields: [
      {
        key: "creator_code",
        label: { type: "custom", custom: "Creator code (optional)" },
        type: "text",
        optional: true,
      },
    ],
  })
}
