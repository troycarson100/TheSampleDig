import { Prisma, type PrismaClient } from "@prisma/client"

// Finding an account by its email, whatever case the email was stored in.
//
// Two ways of doing this were wrong, and this file exists so nothing goes back
// to either:
//
//  - Prisma's `mode: "insensitive"` compiles to ILIKE with the value unescaped,
//    so "%" and "_" in a typed address are live wildcards: "rev_y@x.com"
//    matches "revXy@x.com", and "%@%.%" matches anyone. On the sign-in and
//    purchase paths that is a password checked against, or a payment granted
//    to, the wrong account.
//  - A plain equals on a lowercased value, which replaced it, assumed every
//    stored email was lowercase. Some are not - accounts from before emails
//    were normalised on write - and every one of those could no longer sign
//    in, reset its password, or have a purchase found (found on 2026-09-30,
//    the day it went live).
//
// Here the comparison is lower(email) = the lowercased address, as a bound
// parameter: case never matters, and nothing in the address is a pattern.

/** An email as the site compares it: trimmed and lowercased. */
export const normalizeEmail = (raw: unknown): string => String(raw ?? "").trim().toLowerCase()

type Db = Pick<PrismaClient, "$queryRaw">

/**
 * The ids of every account with this email, ignoring case. Almost always one
 * or none. Where two accounts differ only by case, the one stored exactly as
 * typed (lowercase) comes first, then the oldest - so callers that take the
 * first get a stable, sensible answer.
 *
 * `exceptId` leaves one account out, for "is this address taken by anyone
 * else?".
 */
export async function accountIdsByEmail(db: Db, raw: unknown, exceptId?: string): Promise<string[]> {
  const email = normalizeEmail(raw)
  if (!email) return []
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM users
    WHERE lower(email) = ${email}
    ${exceptId ? Prisma.sql`AND id <> ${exceptId}` : Prisma.empty}
    ORDER BY (email = ${email}) DESC, created_at ASC`
  return rows.map((r) => r.id)
}

/** The account with this email, ignoring case, or null. See accountIdsByEmail. */
export async function accountIdByEmail(db: Db, raw: unknown, exceptId?: string): Promise<string | null> {
  return (await accountIdsByEmail(db, raw, exceptId))[0] ?? null
}
