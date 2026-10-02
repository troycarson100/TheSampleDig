/**
 * Gift links: claimed with one tap, theirs alone after that.
 *
 *   npm run dev                 # in another terminal
 *   npx tsx scripts/verify-gift-links.ts
 *
 * Seeds throwaway gift links and one throwaway account in the LOCAL database,
 * drives /gift/<code> and its API as separate visitors (separate cookie jars),
 * and deletes every gift, account and purchase it made at the end, whatever
 * happened. Never sends an email: the "save to my account" link is minted
 * here, the way the email route mints it. Refuses to run against production
 * (ensure-not-production-db).
 */
import "./load-env"
import "./ensure-not-production-db"
import bcrypt from "bcryptjs"
import { request as pwRequest, type APIRequestContext } from "playwright"
import { prisma } from "../lib/db"
import { generateCompCode } from "../lib/comp-code"
import { giftPath, isGiftPlaceholderEmail } from "../lib/gift-link-logic"

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures: string[] = []
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${!ok && detail ? ` — ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

const startedAt = new Date()
const stamp = startedAt.getTime().toString(36)
const EXISTING = `gift-probe-existing-${stamp}@example.com`
const NEW_EMAIL = `gift-probe-new-${stamp}@example.com`
const PASSWORD = `probe-${stamp}-pw`

const giftIds: string[] = []
const userIds = new Set<string>()
const contexts: APIRequestContext[] = []

async function visitor() {
  const ctx = await pwRequest.newContext({ baseURL: BASE })
  contexts.push(ctx)
  return ctx
}

async function seedGift(data: { product: string; message?: string; revokedAt?: Date; expiresAt?: Date }) {
  const row = await prisma.compCode.create({
    data: { code: generateCompCode(), kind: "link", note: `verify-gift-links ${stamp}`, ...data },
  })
  giftIds.push(row.id)
  return { ...row, slug: giftPath(row.code).slice("/gift/".length) }
}

async function ownerOf(giftId: string) {
  const row = await prisma.compCode.findUnique({ where: { id: giftId }, select: { redeemedByUserId: true } })
  if (row?.redeemedByUserId) userIds.add(row.redeemedByUserId)
  return row?.redeemedByUserId ?? null
}

async function keysOf(userId: string) {
  const rows = await prisma.purchase.findMany({ where: { userId }, select: { product: true, licenseKey: true } })
  return Object.fromEntries(rows.map((r) => [r.product, r.licenseKey]))
}

async function mintSave(userId: string, email: string) {
  const token = `probe${stamp}${Math.random().toString(36).slice(2)}`
  await prisma.user.update({
    where: { id: userId },
    data: { pendingEmail: email, emailChangeToken: token, emailChangeExpires: new Date(Date.now() + 3_600_000) },
  })
  return token
}

async function main() {
  const verified = new Date()
  const existing = await prisma.user.create({
    data: { email: EXISTING, passwordHash: await bcrypt.hash(PASSWORD, 10), emailVerified: verified, passwordSetAt: verified },
  })
  userIds.add(existing.id)
  await prisma.purchase.create({ data: { userId: existing.id, product: "shft", licenseKey: `SHFT-PRB${stamp}`.slice(0, 19) } })
  const existingShftKey = (await keysOf(existing.id)).shft

  try {
    // ---------------------------------------------------------------- claim
    console.log("\nclaiming")
    const gift = await seedGift({ product: "bundle", message: `Probe message ${stamp}` })
    const a = await visitor()
    const b = await visitor()

    const preview = await a.get(`/gift/${gift.slug}`, { headers: { "user-agent": "facebookexternalhit/1.1" } })
    const previewHtml = await preview.text()
    check("the page opens with a Claim button and the message", preview.ok() && previewHtml.includes("Claim your gift") && previewHtml.includes(`Probe message ${stamp}`))
    check("and says what it gives", previewHtml.includes("shft + drft + fltr"))
    check("opening it (as a link preview would) claims nothing", (await ownerOf(gift.id)) === null)
    check("its referrer policy keeps the private link from leaking", /<meta name="referrer" content="no-referrer"/.test(previewHtml))

    const claim = await a.post(`/api/gift/${gift.slug}/claim`)
    const { token } = (await claim.json()) as { token?: string }
    check("Claim succeeds", claim.ok() && typeof token === "string", `HTTP ${claim.status()}`)
    const setCookie = claim.headers()["set-cookie"] ?? ""
    check("and sets an httpOnly cookie for this gift", setCookie.includes(`sr_gift_${gift.id}=`) && /httponly/i.test(setCookie))

    const placeholder = await ownerOf(gift.id)
    const account = placeholder ? await prisma.user.findUnique({ where: { id: placeholder } }) : null
    check("the gift sits on an account at an address no mail can reach", isGiftPlaceholderEmail(account?.email))
    check("which no bulk email will ever pick up", account?.emailMarketingOptIn === false && account?.productUpdateOptIn === false)
    const keys = placeholder ? await keysOf(placeholder) : {}
    check("with all three plugins, each with its own key", ["shft", "drft", "fltr"].every((p) => keys[p]), JSON.stringify(keys))

    const mine = await (await a.get(`/gift/${gift.slug}`)).text()
    check("the claimer sees their keys", Object.values(keys).every((k) => k && mine.includes(k)))
    check("and the downloads", mine.includes(`/api/products/fltr/download?asset=`))
    check("and their private link", token ? mine.includes(`?k=${encodeURIComponent(token)}`) : false)

    const dl = await a.get(`/api/products/drft/download?asset=installer&key=${encodeURIComponent(keys.drft ?? "")}`, { maxRedirects: 0 })
    check("a download link works with the gift's key", dl.status() === 302, `HTTP ${dl.status()}`)

    // ---------------------------------------------------------------- others
    console.log("\nanyone else")
    const second = await b.post(`/api/gift/${gift.slug}/claim`)
    check("a second Claim is refused", second.status() === 409, `HTTP ${second.status()}`)
    const theirs = await (await b.get(`/gift/${gift.slug}`)).text()
    check("someone else opening the link is told it's claimed", theirs.includes("already been claimed"))
    check("and sees no keys", !Object.values(keys).some((k) => k && theirs.includes(k)))
    const wrong = await (await b.get(`/gift/${gift.slug}?k=not-the-token`)).text()
    check("a made-up private link shows no keys", wrong.includes("already been claimed") && !Object.values(keys).some((k) => k && wrong.includes(k)))
    const viaPrivate = await (await b.get(`/gift/${gift.slug}?k=${encodeURIComponent(token ?? "")}`)).text()
    check("the private link opens it on another device", Object.values(keys).every((k) => k && viaPrivate.includes(k)))

    const noToken = await b.post(`/api/gift/${gift.slug}/email`, { data: { email: NEW_EMAIL } })
    check("someone without the token can't have it emailed", noToken.status() === 403, `HTTP ${noToken.status()}`)
    const badEmail = await a.post(`/api/gift/${gift.slug}/email`, { data: { email: "not an email" } })
    check("an address that isn't one is refused", badEmail.status() === 400, `HTTP ${badEmail.status()}`)

    // A signed-in account typing the code in at /redeem gets nothing.
    const s = await visitor()
    const { csrfToken } = await (await s.get("/api/auth/csrf")).json()
    await s.post("/api/auth/callback/credentials", {
      form: { csrfToken, email: EXISTING, password: PASSWORD, json: "true", callbackUrl: `${BASE}/` },
      maxRedirects: 0,
    })
    const fresh = await seedGift({ product: "fltr" })
    const redeem = await s.post("/api/comps/redeem", { data: { code: fresh.code } })
    check("a gift link's code can't be redeemed at /redeem", redeem.status() === 404, `HTTP ${redeem.status()}`)
    check("so it's still there to claim", (await ownerOf(fresh.id)) === null)
    const admin = await s.get("/api/admin/gifts")
    check("the admin gift list is closed to non-admins", admin.status() === 403, `HTTP ${admin.status()}`)
    const adminMake = await s.post("/api/admin/gifts", { data: { product: "bundle" } })
    check("and so is making one", adminMake.status() === 403, `HTTP ${adminMake.status()}`)

    // ---------------------------------------------------------------- race
    console.log("\ntwo at once")
    const race = await seedGift({ product: "drft" })
    const [r1, r2] = await Promise.all([
      (await visitor()).post(`/api/gift/${race.slug}/claim`),
      (await visitor()).post(`/api/gift/${race.slug}/claim`),
    ])
    check("of two simultaneous Claims exactly one wins", [r1.status(), r2.status()].sort().join() === "200,409", `${r1.status()}, ${r2.status()}`)
    await ownerOf(race.id)
    const raceAccounts = await prisma.user.count({ where: { email: { endsWith: "@gifts.sampleroll.invalid" }, createdAt: { gte: race.createdAt } } })
    check("and the loser leaves no empty account behind", raceAccounts === 1, `${raceAccounts} gift accounts`)

    // ---------------------------------------------------------------- cancelled / expired
    console.log("\ncancelled and expired")
    const revoked = await seedGift({ product: "shft", revokedAt: new Date() })
    check("a cancelled link says so", (await (await b.get(`/gift/${revoked.slug}`)).text()).includes("has been cancelled"))
    check("and can't be claimed", (await b.post(`/api/gift/${revoked.slug}/claim`)).status() === 410)
    const expired = await seedGift({ product: "shft", expiresAt: new Date(Date.now() - 1000) })
    check("an expired link says so", (await (await b.get(`/gift/${expired.slug}`)).text()).includes("has expired"))
    check("and can't be claimed", (await b.post(`/api/gift/${expired.slug}/claim`)).status() === 410)
    check("nothing was granted for either", (await ownerOf(revoked.id)) === null && (await ownerOf(expired.id)) === null)

    // ---------------------------------------------------------------- save to a new address
    console.log("\nsaving to a new email")
    const saveNew = await mintSave(placeholder!, NEW_EMAIL)
    const confirmNew = await b.get(`/api/gift/confirm?token=${saveNew}&gift=${gift.slug}`, { maxRedirects: 0 })
    const to = confirmNew.headers()["location"] ?? ""
    check("confirming goes straight on to set a password", confirmNew.status() === 303 && to.includes("/reset-password?token=") && to.includes("welcome=1"), `${confirmNew.status()} ${to}`)
    const moved = await prisma.user.findUnique({ where: { id: placeholder! } })
    check("the gift's account now has that address, verified", moved?.email === NEW_EMAIL && Boolean(moved?.emailVerified))
    check("its keys are unchanged", JSON.stringify(await keysOf(placeholder!)) === JSON.stringify(keys))
    const saved = await (await a.get(`/gift/${gift.slug}`)).text()
    check("the gift page says where it's saved, keys still there", saved.includes(`Saved to <strong>${NEW_EMAIL}</strong>`) && Object.values(keys).every((k) => k && saved.includes(k)))
    const reused = await b.get(`/api/gift/confirm?token=${saveNew}&gift=${gift.slug}`, { maxRedirects: 0 })
    check("the save link only works once", (reused.headers()["location"] ?? "").includes("saved=expired"))
    const again = await a.post(`/api/gift/${gift.slug}/email`, { data: { email: "other@example.com" } })
    check("once saved, it can't be emailed elsewhere", again.status() === 409, `HTTP ${again.status()}`)

    // ---------------------------------------------------------------- save into an existing account
    console.log("\nsaving into an account that already exists")
    const giftTwo = await seedGift({ product: "bundle" })
    const c = await visitor()
    await c.post(`/api/gift/${giftTwo.slug}/claim`)
    const placeholderTwo = (await ownerOf(giftTwo.id))!
    const keysTwo = await keysOf(placeholderTwo)
    const saveExisting = await mintSave(placeholderTwo, EXISTING.toUpperCase())
    const confirmExisting = await c.get(`/api/gift/confirm?token=${saveExisting}&gift=${giftTwo.slug}`, { maxRedirects: 0 })
    check("confirming sends them back to the gift, saved", (confirmExisting.headers()["location"] ?? "").endsWith(`/gift/${giftTwo.slug}?saved=merged`))
    const after = await keysOf(existing.id)
    check("the account gets the plugins it didn't have, with the gift's keys", after.drft === keysTwo.drft && after.fltr === keysTwo.fltr, JSON.stringify(after))
    check("and keeps its own shft key", after.shft === existingShftKey)
    check("the gift now points at that account", (await ownerOf(giftTwo.id)) === existing.id)
    const mergedPage = await (await c.get(`/gift/${giftTwo.slug}?saved=merged`)).text()
    check("the gift page sends them to sign in rather than showing that account's keys", mergedPage.includes("Your gift is on your account") && !mergedPage.includes(existingShftKey ?? "-none-"))
    check("and doesn't show the moved keys either", !mergedPage.includes(keysTwo.drft ?? "-none-"))

    // ---------------------------------------------------------------- reopen
    console.log("\nreopened by an admin")
    // What /api/admin/gifts/[id]/reopen does (it needs an admin session).
    await prisma.compCode.update({ where: { id: race.id }, data: { claimTokenHash: null } })
    const raceOwner = (await ownerOf(race.id))!
    const raceKeys = await keysOf(raceOwner)
    const d = await visitor()
    check("a reopened link offers Claim again", (await (await d.get(`/gift/${race.slug}`)).text()).includes("Claim your gift"))
    const reclaim = await d.post(`/api/gift/${race.slug}/claim`)
    check("and can be claimed", reclaim.ok(), `HTTP ${reclaim.status()}`)
    check("onto the same account", (await ownerOf(race.id)) === raceOwner)
    check("with the same keys", JSON.stringify(await keysOf(raceOwner)) === JSON.stringify(raceKeys))
    const reclaimed = await (await d.get(`/gift/${race.slug}`)).text()
    check("the new claimer sees them", reclaimed.includes(raceKeys.drft ?? "-none-"))
  } finally {
    for (const ctx of contexts) await ctx.dispose().catch(() => {})
    // Cleanup, whatever happened: every gift seeded here, every account they
    // made (purchases go with them), and the throwaway existing account.
    for (const id of giftIds) await ownerOf(id)
    const gifts = await prisma.compCode.deleteMany({ where: { id: { in: giftIds } } })
    const users = await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: [...userIds] } },
          { email: { in: [EXISTING, NEW_EMAIL] } },
          // A gift account a lost race should already have dropped.
          { email: { endsWith: "@gifts.sampleroll.invalid" }, createdAt: { gte: startedAt } },
        ],
      },
    })
    console.log(`\n  cleanup: removed ${gifts.count} gift links and ${users.count} throwaway accounts (with their purchases)`)
    await prisma.$disconnect()
  }
  console.log(failures.length ? `\nverify-gift-links: ${failures.length} failed` : "\nverify-gift-links: all passed")
  process.exit(failures.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
