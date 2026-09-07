// Pure decisions for turning a paid Stripe Checkout Session into a grant. No
// Prisma, no next/headers, and relative imports only (like lib/license-key.ts),
// so `npx tsx --test` loads it directly; the DB work lives in
// lib/plugin-purchase-grant.ts.

/** `welcome=1` makes the reset page read "Set your password". */
export function setPasswordPath(token: string): string {
  return `/reset-password?token=${encodeURIComponent(token)}&welcome=1`
}
