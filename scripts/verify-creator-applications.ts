/**
 * Runs the creator-program applications end to end against the LOCAL
 * database: applying (and the form's guards, through the dev server),
 * approving into a creator at 25% in their own country, declining, and that
 * Stripe onboarding opens the account in that country (Stripe test mode).
 *
 *   npm run dev                 # in another terminal
 *   npx tsx scripts/verify-creator-applications.ts
 *
 * Mail is switched off for the run, so nothing is sent to anyone. Seeds only
 * creator-verify-*@example.com rows and deletes them - and any Stripe test
 * account it opened - when done, pass or fail.
 */
import "./load-env"
import "./ensure-not-production-db"

const BASE = process.env.BASE_URL || "http://localhost:3000"
let failures = 0
function check(label: string, ok: boolean, detail: unknown = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${!ok && detail !== "" ? ` - ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`)
  if (!ok) failures++
}
const TAG = "creator-verify"
const address = (who: string) => `${TAG}-${who}@example.com`

async function main() {
  // Before lib/email.ts loads, so every send fails closed instead of mailing.
  // Emptied, not deleted: lib/email.ts treats empty as unset, and dotenv
  // would refill a deleted one.
  for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) process.env[k] = ""
  const { prisma } = await import("@/lib/db")
  const { submitApplication, approveApplication, declineApplication } = await import("@/lib/affiliate-application")
  const { ensureOnboardingUrl } = await import("@/lib/affiliate-stripe")
  const Stripe = (await import("stripe")).default
  const opened: string[] = []

  const base = { message: "I make beat videos and would love to cover fltr.", plugin: "fltr" }
  try {
    console.log("\nthe form, through the dev server (nothing valid is sent, so nothing is mailed)")
    const post = (body: unknown) => fetch(`${BASE}/api/creators/apply`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.1` }, body: JSON.stringify(body) })
    const good = { ...base, name: "Form Person", email: address("form"), country: "GB" }
    const r1 = await post({ ...good, country: "BR" })
    check("a country Stripe can't pay is refused", r1.status === 400, r1.status)
    const r2 = await post({ ...good, email: "nope" })
    check("a bad email is refused", r2.status === 400, r2.status)
    const r3 = await post({ ...good, plugin: "pro" })
    check("an unknown plugin is refused", r3.status === 400, r3.status)
    const r4 = await post({ ...good, website: "http://spam" })
    check("a bot filling the hidden field is told ok, and nothing is saved", r4.status === 200 && (await prisma.affiliateApplication.count({ where: { email: address("form") } })) === 0)

    console.log("\napplying")
    await submitApplication({ ...base, name: "Ana Maker", email: address("ana"), country: "IL" })
    const again = await submitApplication({ ...base, name: "Ana Maker", email: address("ana"), country: "IL", message: "hello??" })
    check("a second application while one is open changes nothing", again.duplicate && (await prisma.affiliateApplication.count({ where: { email: address("ana") } })) === 1)
    await submitApplication({ ...base, name: "Bo Declined", email: address("bo"), country: "US", plugin: "all" })
    // Someone already holding the code Ana's name suggests.
    const holder = await prisma.affiliate.create({ data: { code: "ana-maker", name: "Holder", email: address("holder"), dashboardToken: `${TAG}-holder-token` } })

    console.log("\napproving")
    const ana = await prisma.affiliateApplication.findFirstOrThrow({ where: { email: address("ana") } })
    const user = await prisma.user.create({ data: { email: address("ana").toUpperCase(), passwordHash: "x" } })
    const ok = await approveApplication(ana.id)
    check("approve makes the creator", ok.ok && Boolean(ok.affiliate), ok)
    const made = ok.ok && ok.affiliate ? await prisma.affiliate.findUnique({ where: { id: ok.affiliate.id } }) : null
    check("at 25%, as a percent", made?.commissionType === "percent" && made?.commissionPercent === 25, made)
    check("in the country they applied from", made?.country === "IL", made?.country)
    check("with a code of their own, not the one already taken", Boolean(made?.code && made.code !== "ana-maker" && made.code.startsWith("ana-maker")), made?.code)
    check("linked to their Sample Roll account, whatever its case", made?.userId === user.id)
    check("their application points at them", (await prisma.affiliateApplication.findUnique({ where: { id: ana.id } }))?.affiliateId === made?.id)
    check("the email failing is reported, not hidden", ok.ok && ok.emailed === false)
    check("a second approve is refused, and makes no second creator", !(await approveApplication(ana.id)).ok && (await prisma.affiliate.count({ where: { email: address("ana") } })) === 1)

    console.log("\ndeclining")
    const bo = await prisma.affiliateApplication.findFirstOrThrow({ where: { email: address("bo") } })
    check("decline files it", (await declineApplication(bo.id)).ok && (await prisma.affiliateApplication.findUnique({ where: { id: bo.id } }))?.status === "declined")
    check("and makes no creator", (await prisma.affiliate.count({ where: { email: address("bo") } })) === 0)
    check("a declined one can't then be approved", !(await approveApplication(bo.id)).ok)
    check("they can apply again later", !(await submitApplication({ ...base, name: "Bo Declined", email: address("bo"), country: "US" })).duplicate)

    console.log("\nStripe onboarding opens the account in their country (test mode)")
    const key = process.env.STRIPE_SECRET_KEY
    if (!key?.startsWith("sk_test_")) {
      console.log("  note  no Stripe test key - skipping")
    } else if (made) {
      try {
        const url = await ensureOnboardingUrl(made.id, `${BASE}/affiliate/${made.dashboardToken}`)
        const acct = (await prisma.affiliate.findUnique({ where: { id: made.id } }))?.stripeAccountId
        if (acct) opened.push(acct)
        const account = acct ? await new Stripe(key).accounts.retrieve(acct) : null
        check("an Israeli creator gets an Israeli, payout-only account", account?.country === "IL" && account?.tos_acceptance?.service_agreement === "recipient" && url.startsWith("https://"), { country: account?.country, agreement: account?.tos_acceptance?.service_agreement })
        // And a US one keeps the default agreement, which is all a US account can have.
        await prisma.affiliate.update({ where: { id: holder.id }, data: { country: "US" } })
        await ensureOnboardingUrl(holder.id, `${BASE}/affiliate/x`)
        const us = (await prisma.affiliate.findUnique({ where: { id: holder.id } }))?.stripeAccountId
        if (us) opened.push(us)
        const usAccount = us ? await new Stripe(key).accounts.retrieve(us) : null
        check("a US creator gets a US account on the default agreement", usAccount?.country === "US" && usAccount?.tos_acceptance?.service_agreement !== "recipient", { country: usAccount?.country, agreement: usAccount?.tos_acceptance?.service_agreement })
      } catch (e) {
        check("onboarding opens", false, e instanceof Error ? e.message : e)
      }
    }
  } finally {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (stripeKey?.startsWith("sk_test_")) for (const id of opened) await new Stripe(stripeKey).accounts.del(id).catch(() => {})
    const apps = await prisma.affiliateApplication.deleteMany({ where: { email: { startsWith: `${TAG}-` } } })
    const affs = await prisma.affiliate.deleteMany({ where: { email: { startsWith: `${TAG}-` } } })
    const users = await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}-`.toUpperCase() } } })
    const users2 = await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}-` } } })
    console.log(`\n  cleanup: removed ${apps.count} applications, ${affs.count} creators, ${users.count + users2.count} accounts, ${opened.length} Stripe test accounts`)
    await prisma.$disconnect()
  }
  console.log(failures ? `\nverify-creator-applications: ${failures} failed` : "\nverify-creator-applications: all passed")
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
