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
 * One-time Checkout Session for a plugin or the bundle.
 *
 * `buyer` is null for a guest. A signed-in buyer's id is stamped as
 * client_reference_id and metadata.userId and their email prefilled; a guest
 * gets neither, types their email into Checkout, and that address is the
 * only identity the webhook has to attach the purchase to. metadata.guest
 * marks those sessions in the Stripe dashboard.
 */
export async function createPluginCheckoutSession(
  stripe: Stripe,
  opts: {
    product: CompProduct
    priceId: string
    paid: number
    cancelPath: CancelPath
    buyer: CheckoutBuyer | null
    affiliateCode: string | null
  },
): Promise<Stripe.Checkout.Session> {
  const attrMetadata = await readAttributionMetadata()
  const { buyer } = opts
  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: opts.priceId, quantity: 1 }],
    ...checkoutUrls(checkoutBaseUrl(), opts.product, opts.paid, opts.cancelPath),
    customer_creation: "always",
    ...(buyer?.email ? { customer_email: buyer.email } : {}),
    billing_address_collection: "auto",
    allow_promotion_codes: true,
    ...(buyer ? { client_reference_id: buyer.id } : {}),
    metadata: {
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
