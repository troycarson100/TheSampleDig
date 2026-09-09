// Pure decisions for moving an account to a new email address. No Prisma, no
// next/headers, relative imports only, so `npx tsx --test` loads it directly.
// The database work lives in lib/email-change.ts and the two route handlers.

/**
 * Canonicalise a requested address, or null if it is not usable. Deliberately
 * the same shape check /api/plugins/resend-key applies - an @ with something
 * either side, no spaces, within the 254-character limit - rather than a
 * clever regex. The confirmation link is the real validation: an address that
 * cannot receive mail never becomes the account's.
 */
export function normalizeNewEmail(input: unknown): string | null {
  if (typeof input !== "string") return null
  const email = input.trim().toLowerCase()
  if (!email || email.length > 254) return null
  if (/\s/.test(email)) return null
  const at = email.indexOf("@")
  if (at <= 0 || at !== email.lastIndexOf("@") || at === email.length - 1) return null
  return email
}

export type EmailChangeDecision =
  | { action: "send" }
  | { action: "refuse"; reason: "invalid" | "unchanged" | "taken" }

/** What the caller sees for each refusal. `taken` points at support rather
 *  than offering a merge: both accounts may own products, and reconciling
 *  that is a judgement call. */
export const EMAIL_CHANGE_REFUSAL: Record<"invalid" | "unchanged" | "taken", string> = {
  invalid: "That doesn't look like an email address.",
  unchanged: "That's already the address on this account.",
  taken: "That address already has an account - reply to your receipt and we'll merge them.",
}

/**
 * `takenByAnotherAccount` is resolved by the caller, which does the lookup.
 * Checked again at confirm time, because another account can claim the
 * address while a change is pending.
 */
export function decideEmailChange(
  currentEmail: string,
  requested: string | null,
  takenByAnotherAccount: boolean,
): EmailChangeDecision {
  if (!requested) return { action: "refuse", reason: "invalid" }
  if (requested === currentEmail.trim().toLowerCase()) {
    return { action: "refuse", reason: "unchanged" }
  }
  if (takenByAnotherAccount) return { action: "refuse", reason: "taken" }
  return { action: "send" }
}
