import { PRODUCTS } from "./products"

// Pure decisions for turning a paid Stripe Checkout Session into a grant. No
// Prisma, no next/headers, and relative imports only (like lib/license-key.ts),
// so `npx tsx --test` loads it directly; the DB work lives in
// lib/plugin-purchase-grant.ts.

/** The fields of a Stripe Checkout Session that identify who paid. Declared
 *  structurally so tests can pass plain objects. */
export type BuyerSource = {
  client_reference_id?: string | null
  metadata?: Record<string, string> | null
  customer_details?: { email?: string | null } | null
  customer_email?: string | null
}

export type BuyerLookup =
  | { kind: "user"; id: string }
  | { kind: "email"; email: string }
  | { kind: "none" }

/**
 * Who paid, from the session alone. A signed-in checkout stamps the user id
 * (client_reference_id and metadata.userId); a guest checkout stamps neither,
 * and the only identity is the email Stripe collected.
 */
export function buyerLookupFor(session: BuyerSource): BuyerLookup {
  const id = session.client_reference_id ?? session.metadata?.userId
  if (typeof id === "string" && id.length > 0) return { kind: "user", id }
  const raw = session.customer_details?.email ?? session.customer_email
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : ""
  if (email) return { kind: "email", email }
  return { kind: "none" }
}

/**
 * A Purchase row that existed BEFORE the checkout session was created cannot
 * have come from it: the buyer already owned the product and has now paid
 * again. Rows created after the session began belong to it - the webhook and
 * the claim route race, and either may have landed first.
 */
export function isDuplicateGrant(existingCreatedAt: Date, sessionCreatedUnix: number): boolean {
  return existingCreatedAt.getTime() < sessionCreatedUnix * 1000
}

/**
 * Was this account born from this checkout? An account created at or after
 * the session began can only have been created by the grant for this
 * purchase (whichever of the webhook or the claim route got there first).
 * One that predates the session belongs to someone who was already here,
 * and the thanks page must not show its keys or offer its password to
 * whoever holds the session id.
 */
export function isAccountFromSession(accountCreatedAt: Date, sessionCreatedUnix: number): boolean {
  return accountCreatedAt.getTime() >= sessionCreatedUnix * 1000
}

/** `welcome=1` makes the reset page read "Set your password". */
export function setPasswordPath(token: string): string {
  return `/reset-password?token=${encodeURIComponent(token)}&welcome=1`
}

/** The download route accepts the licence key as its credential (see
 *  app/api/products/[product]/download/route.ts). */
export function downloadHref(product: string, assetId: string, licenseKey: string): string {
  return `/api/products/${product}/download?asset=${assetId}&key=${encodeURIComponent(licenseKey)}`
}

export type DownloadLink = { id: string; label: string; href: string }

/** Every downloadable asset of a product, each linked with the key baked in.
 *  Used by the receipt email and the thanks page. */
export function downloadsFor(product: string, licenseKey: string): DownloadLink[] {
  const def = PRODUCTS[product]
  if (!def) return []
  return def.assets.map((a) => ({ id: a.id, label: a.label, href: downloadHref(product, a.id, licenseKey) }))
}
