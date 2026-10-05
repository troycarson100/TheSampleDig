/**
 * Runs the bundle email (the fourth member email) end to end against the
 * LOCAL database, with Stripe's code lookups and the mail server faked: who
 * gets which offer, what changes for someone who bought between the list and
 * the send, and that its complete-set links open checkouts at $39 and $19
 * (Stripe test mode, through the dev server).
 *
 *   npm run dev                 # in another terminal
 *   npx tsx scripts/verify-bundle-email.ts
 *
 * Seeds its own accounts (bundle-verify-*@example.com), the member offer and
 * its codes, and deletes every row it made when done, pass or fail. Every
 * other local account that takes email is listed and "mailed" too - into the
 * fake outbox, nowhere else - and is only read. Refuses to run if the local
 * database already holds the member offer or this email.
 */
import "./load-env"
import "./ensure-not-production-db"
import type { Transporter } from "nodemailer"
import Stripe from "stripe"
import { prisma } from "@/lib/db"
import { MEMBER_OFFER } from "@/lib/member-offer-logic"
import type { ReminderDeps } from "@/lib/offer-reminder"
import { BUNDLE_EMAIL } from "@/lib/bundle-email-logic"
import { claimBundleEmail, sendBundleEmailBatch, bundleEmailPreview } from "@/lib/bundle-email"

const BASE = process.env.BASE_URL || "http://localhost:3000"
let failures = 0
function check(label: string, ok: boolean, detail: unknown = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${!ok && detail !== "" ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`)
  if (!ok) failures++
}

const TAG = "bundle-verify"
const address = (who: string) => `${TAG}-${who}@example.com`

// who        owns          code       before their batch     -> gets
// nothing    -             unused     -                      bundle + code
// nocode     -             none       -                      bundle
// one        shft          unused     -                      set ($39) + code
// two        shft, drft    used       -                      set ($19)
// all        all three     unused                            left off: owns everything
// optout     -             unused     (unsubscribed)         not considered
// buysone    -             unused     buys shft              set ($39), not the bundle
// buysrest   shft, drft    none       buys fltr              skipped
const PEOPLE = ["nothing", "nocode", "one", "two", "all", "optout", "buysone", "buysrest"] as const
type Who = (typeof PEOPLE)[number]
const OWNS: Record<Who, string[]> = {
  nothing: [], nocode: [], one: ["shft"], two: ["shft", "drft"], all: ["shft", "drft", "fltr"],
  optout: [], buysone: [], buysrest: ["shft", "drft"],
}
const HAS_CODE = (who: Who) => !["nocode", "buysrest"].includes(who)

type Mail = { to: string; subject: string; html: string }

async function main() {
  process.env.NEXTAUTH_SECRET ||= "verify-bundle-email"
  if (await prisma.memberOffer.findUnique({ where: { slug: MEMBER_OFFER.slug } })) throw new Error("The local database already has the member offer. Not touching it.")
  if (await prisma.memberOfferReminder.findUnique({ where: { slug: BUNDLE_EMAIL.slug } })) throw new Error("The local database already has the bundle email. Not touching it.")

  const ids = {} as Record<Who, string>
  const code = (who: Who) => `SR10B${who.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5).padEnd(5, "Z")}`
  const used = new Set<string>(["promo_two"])
  const outbox: Mail[] = []
  const deps: ReminderDeps = {
    redeemedCodes: async () => new Set(used),
    isRedeemed: async (id) => used.has(id),
    openTransporter: () => ({ sendMail: async (m: Mail) => void outbox.push(m), close: () => {} }) as unknown as Transporter,
  }
  const mailTo = (who: Who) => outbox.filter((m) => m.to === address(who))
  let offerId = ""

  try {
    for (const who of PEOPLE) {
      const u = await prisma.user.create({
        data: { email: address(who), passwordHash: "x", emailMarketingOptIn: who !== "optout", purchases: { create: OWNS[who].map((product) => ({ product })) } },
      })
      ids[who] = u.id
    }
    const offer = await prisma.memberOffer.create({
      data: {
        slug: MEMBER_OFFER.slug, amountOffCents: 1000, couponId: "coupon_verify", cutoffAt: new Date(),
        expiresAt: new Date(Date.now() + 20 * 86_400_000), subject: "verify", bodyHtml: "verify",
        codes: { create: PEOPLE.filter(HAS_CODE).map((who) => ({ userId: ids[who], email: address(who), code: code(who), promotionCodeId: `promo_${who}`, sentAt: new Date() })) },
      },
    })
    offerId = offer.id

    console.log("\nthe list")
    const preview = await bundleEmailPreview(new Date(), deps)
    check("it can be sent", preview.unavailable === null, preview.unavailable)
    check("three versions to preview", preview.samples.length === 3)
    const claim = await claimBundleEmail("verify@example.com", new Date(), deps)
    check("the send starts", claim.ok, claim)
    if (!claim.ok) return
    const rows = await prisma.memberOfferReminderSend.findMany({ where: { reminderId: claim.id, userId: { in: Object.values(ids) } } })
    const listed = (who: Who) => rows.find((r) => r.userId === ids[who])
    check("owns nothing, code unused: bundle + code", listed("nothing")?.variant === "bundle+code")
    check("owns nothing, no code: bundle", listed("nocode")?.variant === "bundle")
    check("owns one, code unused: set + code", listed("one")?.variant === "set+code")
    check("owns two, code used: set", listed("two")?.variant === "set" && listed("two")?.code === "")
    check("owns all three: left off", !listed("all"))
    check("unsubscribed: left off", !listed("optout"))
    check("a second start is refused", !(await claimBundleEmail("verify@example.com", new Date(), deps)).ok)

    await prisma.purchase.create({ data: { userId: ids.buysone, product: "shft" } })
    await prisma.purchase.create({ data: { userId: ids.buysrest, product: "fltr" } })

    console.log("\nthe send")
    let guard = 0
    for (let b = await sendBundleEmailBatch(claim.id, new Date(), deps); !b.done && guard < 200; guard++) b = await sendBundleEmailBatch(claim.id, new Date(), deps)
    check("everyone listed is mailed once", (["nothing", "nocode", "one", "two", "buysone"] as Who[]).every((w) => mailTo(w).length === 1), Object.fromEntries(PEOPLE.map((w) => [w, mailTo(w).length])))
    const nothing = mailTo("nothing")[0]?.html ?? ""
    check("owns nothing: the bundle at $59, $49 with their code", nothing.includes("$59") && nothing.includes("it's <strong>$49</strong>") && nothing.includes(code("nothing")))
    check("owns nothing, no code: the bundle, no code part", Boolean(mailTo("nocode")[0]?.html.includes("Get all three") && !mailTo("nocode")[0]?.html.includes("Use my $10 code")))
    const one = mailTo("one")[0]?.html ?? ""
    check("owns one: drft + fltr for $39, shft marked owned", one.includes("You have shft. Add") && one.includes("fltr + drft") && one.includes("Get both for $39") && one.includes("In your collection"))
    check("its subject names the deal", Boolean(mailTo("one")[0]?.subject.includes("fltr + drft for $39")))
    const two = mailTo("two")[0]?.html ?? ""
    check("owns two, code used: fltr for $19, no code", two.includes("Get it for $19") && !two.includes("Use my $10 code"))
    check("bought a plugin since the list: the set offer, not the bundle", Boolean(mailTo("buysone")[0]?.html.includes("Get both for $39") && !mailTo("buysone")[0]?.html.includes("Get all three")))
    check("bought the last one since: not mailed", mailTo("buysrest").length === 0)
    check("no placeholder reaches anyone", outbox.every((m) => !/\{\{[A-Z_]+\}\}|<!--\/?[a-z-]+-->/.test(m.html)))
    check("the send is marked finished", Boolean((await prisma.memberOfferReminder.findUnique({ where: { id: claim.id } }))?.completedAt))

    console.log("\nthe complete-set links (Stripe test mode, through the dev server)")
    const key = process.env.STRIPE_SECRET_KEY
    if (!key?.startsWith("sk_test_")) {
      console.log("  note  no Stripe test key - skipping the checkouts")
    } else {
      const stripe = new Stripe(key)
      for (const [who, cents, products] of [["one", 3900, "drft,fltr"], ["two", 1900, "fltr"]] as const) {
        const link = mailTo(who)[0]?.html.match(/href="([^"]*\/api\/cart\/complete-set\?t=[^"]+)"/)?.[1]?.replace(/&amp;/g, "&")
        const res = link ? await fetch(link.replace(/^https?:\/\/[^/]+/, BASE), { redirect: "manual" }) : null
        const sid = res?.headers.get("location")?.match(/cs_test_[A-Za-z0-9]+/)?.[0]
        const s = sid ? await stripe.checkout.sessions.retrieve(sid) : null
        check(`${who}: the link opens a $${cents / 100} checkout for ${products}, bound to them`, s?.amount_total === cents && s?.metadata?.products === products && s?.customer_email === address(who), { total: s?.amount_total, products: s?.metadata?.products })
        if (sid) await stripe.checkout.sessions.expire(sid).catch(() => {})
      }
    }
  } finally {
    const reminder = await prisma.memberOfferReminder.findUnique({ where: { slug: BUNDLE_EMAIL.slug } })
    if (reminder) await prisma.memberOfferReminder.delete({ where: { id: reminder.id } })
    if (offerId) await prisma.memberOffer.delete({ where: { id: offerId } })
    const users = await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}-` } } })
    console.log(`\n  cleanup: removed the bundle email and its list, the seeded offer and codes, and ${users.count} seeded accounts`)
    await prisma.$disconnect()
  }
  console.log(failures ? `\nverify-bundle-email: ${failures} failed` : "\nverify-bundle-email: all passed")
  process.exit(failures ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
