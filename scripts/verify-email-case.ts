/**
 * Accounts are found by email ignoring case, and never as a pattern.
 *
 *   npm run dev                 # in another terminal
 *   npx tsx scripts/verify-email-case.ts
 *
 * Makes two throwaway accounts in the LOCAL database - one stored with a
 * capital ("Case-Probe-...@example.com"), one whose lowercase address a
 * wildcard would also match - drives sign-in, the owned lookup, register and
 * forgot-password against the dev server, and deletes both accounts (and
 * their purchase) at the end, whatever happened. Refuses to run against
 * production (ensure-not-production-db).
 *
 * Written the day an exact-lowercase match went live and locked out every
 * account stored with a capital letter (2026-09-30).
 */
import "./load-env"
import "./ensure-not-production-db"
import bcrypt from "bcryptjs"
import { request as pwRequest } from "playwright"
import { prisma } from "../lib/db"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures: string[] = []
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${!ok && detail ? ` — ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

const stamp = Date.now().toString(36)
const STORED = `Case-Probe-${stamp}@Example.com` // as an old account might be stored
const TYPED = STORED.toLowerCase()
const PASSWORD = `probe-${stamp}-pw`
// A second account the "_" in a pattern would match if the lookup were ILIKE.
const NEIGHBOUR = `case-probeX${stamp}@example.com`
const PATTERN = `case-probe_${stamp}@example.com`

async function signIn(email: string, password: string): Promise<string | null> {
  const ctx = await pwRequest.newContext({ baseURL: BASE })
  try {
    const { csrfToken } = await (await ctx.get("/api/auth/csrf")).json()
    await ctx.post("/api/auth/callback/credentials", {
      form: { csrfToken, email, password, json: "true", callbackUrl: `${BASE}/` },
      maxRedirects: 0,
    })
    const session = await (await ctx.get("/api/auth/session")).json()
    return session?.user?.email ?? null
  } finally {
    await ctx.dispose()
  }
}

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10)
  const verified = new Date()
  const stored = await prisma.user.create({
    data: { email: STORED, passwordHash: hash, emailVerified: verified, passwordSetAt: verified },
  })
  const neighbour = await prisma.user.create({
    data: { email: NEIGHBOUR, passwordHash: hash, emailVerified: verified, passwordSetAt: verified },
  })
  await prisma.purchase.create({ data: { userId: stored.id, product: "shft" } })
  try {
    check("signs in with the address typed in lowercase, though stored with capitals", (await signIn(TYPED, PASSWORD)) !== null)
    check("signs in with the address typed exactly as stored", (await signIn(STORED, PASSWORD)) !== null)
    check("signs in with the address typed in capitals", (await signIn(TYPED.toUpperCase(), PASSWORD)) !== null)
    check("the wrong password is still refused", (await signIn(TYPED, "not-the-password")) === null)
    const viaPattern = await signIn(PATTERN, PASSWORD)
    check("an address with \"_\" in it is not a pattern that finds someone else's account", viaPattern === null, `signed in as ${viaPattern}`)
    const viaPercent = await signIn("%@%.%", PASSWORD)
    check("\"%@%.%\" signs nobody in", viaPercent === null, `signed in as ${viaPercent}`)

    const ctx = await pwRequest.newContext({ baseURL: BASE })
    const owned = await (await ctx.post("/api/cart/owned", { data: { email: TYPED } })).json()
    check("what the account owns is found from the lowercase address", JSON.stringify(owned.owned) === '["shft"]', JSON.stringify(owned))

    const reg = await ctx.post("/api/auth/register", { data: { email: TYPED, password: PASSWORD, name: "probe" } })
    check("a second account for the same address in other letters is refused", reg.status() === 409, `HTTP ${reg.status()}`)
    const dupes = await prisma.user.count({ where: { email: { in: [TYPED, STORED] } } })
    check("and none was made", dupes === 1, `${dupes} accounts`)

    await ctx.post("/api/auth/forgot-password", { data: { email: TYPED } })
    const after = await prisma.user.findUnique({ where: { id: stored.id }, select: { passwordResetToken: true } })
    check("a reset from the lowercase address reaches the account stored with capitals", Boolean(after?.passwordResetToken))
    const neighbourAfter = await prisma.user.findUnique({ where: { id: neighbour.id }, select: { passwordResetToken: true } })
    check("and not any other account", !neighbourAfter?.passwordResetToken)
    await ctx.dispose()
  } finally {
    // Cleanup, whatever happened: both throwaway accounts, the purchase, and
    // anything register made despite the check above.
    await prisma.purchase.deleteMany({ where: { userId: { in: [stored.id, neighbour.id] } } })
    const gone = await prisma.user.deleteMany({ where: { OR: [{ id: { in: [stored.id, neighbour.id] } }, { email: { in: [TYPED, STORED, NEIGHBOUR] } }] } })
    console.log(`  cleanup: removed ${gone.count} throwaway accounts and their purchase`)
    await prisma.$disconnect()
  }
  console.log(failures.length ? `\nverify-email-case: ${failures.length} failed` : "\nverify-email-case: all passed")
  process.exit(failures.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
