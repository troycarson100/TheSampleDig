export type CompCodeStatus = "open" | "redeemed" | "revoked" | "expired"

export interface CompCodeRow {
  redeemedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date | null
}

/** Precedence matters: a redeemed code stays "redeemed" even if it was also
 *  later revoked or its expiry has since passed — the history is what happened. */
export function compCodeStatus(row: CompCodeRow, now: Date = new Date()): CompCodeStatus {
  if (row.redeemedAt) return "redeemed"
  if (row.revokedAt) return "revoked"
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return "expired"
  return "open"
}

export type RedeemDecision =
  | { action: "redeem" }
  | { action: "refuse"; reason: "not_found" | "revoked" | "expired" | "already_redeemed" | "already_owned" }

/**
 * Pure decision, no I/O — the route (Task 8) does the lookups and hands the
 * results in. Code-level problems (revoked/expired/already redeemed) are
 * reported before account-level ones (already owns the product), so a
 * redeemer sees what's wrong with the CODE first.
 */
export function decideRedemption(
  row: CompCodeRow | null,
  alreadyOwnsProduct: boolean,
  now: Date = new Date(),
): RedeemDecision {
  if (!row) return { action: "refuse", reason: "not_found" }

  const status = compCodeStatus(row, now)
  if (status === "revoked") return { action: "refuse", reason: "revoked" }
  if (status === "expired") return { action: "refuse", reason: "expired" }
  if (status === "redeemed") return { action: "refuse", reason: "already_redeemed" }

  if (alreadyOwnsProduct) return { action: "refuse", reason: "already_owned" }

  return { action: "redeem" }
}
