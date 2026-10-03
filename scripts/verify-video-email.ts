/**
 * Runs the fltr video email end to end against the LOCAL database, with
 * Stripe's code lookups and the mail server faked: who is listed, what each
 * person's email holds, what a batch does about someone whose plugins or code
 * changed since the list was made, and that the $39 link in it opens a $39
 * checkout (Stripe test mode, through the dev server).
 *
 *   npm run dev                 # in another terminal
 *   npx tsx scripts/verify-video-email.ts
 *
 * Seeds its own accounts (video-verify-*@example.com), the member offer and
 * its codes, and deletes every row it made when done, pass or fail. Other
 * local accounts that own one plugin are listed and "mailed" too - into the
 * fake outbox, nowhere else - and are only read. Refuses to run if the local
 * database already holds the member offer or this email.
 */
import "./load-env"
import "./ensure-not-production-db"
import type { Transporter } from "nodemailer"
import Stripe from "stripe"
import { prisma } from "@/lib/db"
import { MEMBER_OFFER } from "@/lib/member-offer-logic"
import type { ReminderDeps } from "@/lib/offer-reminder"
import { VIDEO_EMAIL } from "@/lib/video-email-logic"
import { claimVideoEmail, sendVideoEmailBatch, videoEmailPreview } from "@/lib/video-email"

const BASE = process.env.BASE_URL || "http://localhost:3000"
let failures = 0
function check(label: string, ok: boolean, detail: unknown = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${!ok && detail !== "" ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`)
  if (!ok) failures++
}

const TAG = "video-verify"
const address = (who: string) => `${TAG}-${who}@example.com`

// who        owns          code       before their batch          -> gets
// nothing    -             unused     -                           code (bundle pitch)
// one        shft          unused     -                           code + $39
// oneused    fltr          used       -                           $39
// nocode     drft          none       -                           $39
// two        shft, drft    unused     -                           code
// twoused    shft, drft    used                                   left off: nothing to offer
// optout     shft          unused     (unsubscribed)              left off: opted out
// buysmore   shft          unused     buys drft                   code only - no $39 for two owned
// usescode   -             unused     uses the code               skipped
const PEOPLE = ["nothing", "one", "oneused", "nocode", "two", "twoused", "optout", "buysmore", "usescode"] as const
type Who = (typeof PEOPLE)[number]
const OWNS: Record<Who, string[]> = {
  nothing: [], one: ["shft"], oneused: ["fltr"], nocode: ["drft"], two: ["shft", "drft"], twoused: ["shft", "drft"],
  optout: ["shft"], buysmore: ["shft"], usescode: [],
}
const HAS_CODE = (who: Who) => who !== "nocode"
const USED_AT_CLAIM: Who[] = ["oneused", "twoused"]

type Mail = { to: string; subject: string; html: string }

async function main() {
  process.env.NEXTAUTH_SECRET ||= "verify-video-email"
  if (await prisma.memberOffer.findUnique({ where: { slug: MEMBER_OFFER.slug } })) throw new Error("The local database already has the member offer. Not touching it.")
  if (await prisma.memberOfferReminder.findUnique({ where: { slug: VIDEO_EMAIL.slug } })) throw new Error("The local database already has the video email. Not touching it.")

  const ids = {} as Record<Who, string>
  const code = (who: Who) => `SR10V${who.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5).padEnd(5, "Z")}`
  const used = new Set<string>(USED_AT_CLAIM.map((w) => `promo_${w}`))
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
        codes: {
          create: PEOPLE.filter(HAS_CODE).map((who) => ({ userId: ids[who], email: address(who), code: code(who), promotionCodeId: `promo_${who}`, sentAt: new Date() })),
        },
      },
    })
    offerId = offer.id

    console.log("\nthe list")
    const preview = await videoEmailPreview(new Date(), deps)
    check("it can be sent", preview.unavailable === null, preview.unavailable)
    check("three versions to preview", preview.samples.length === 3)
    const claim = await claimVideoEmail("verify@example.com", new Date(), deps)
    check("the send starts", claim.ok, claim)
    if (!claim.ok) return
    const rows = await prisma.memberOfferReminderSend.findMany({ where: { reminderId: claim.id, userId: { in: Object.values(ids) } } })
    const listed = (who: Who) => rows.find((r) => r.userId === ids[who])
    check("nothing-owned with an unused code is down for the code", listed("nothing")?.variant === "code")
    check("an owner of one with an unused code is down for both", listed("one")?.variant === "code+set")
    check("an owner of one who used their code is down for the $39 offer", listed("oneused")?.variant === "set" && listed("oneused")?.code === "")
    check("an owner of one with no code at all is down for the $39 offer", listed("nocode")?.variant === "set")
    check("an owner of two with an unused code is down for the code", listed("two")?.variant === "code")
    check("an owner of two whose code is used is left off", !listed("twoused"))
    check("an unsubscribed account is left off", !listed("optout"))
    const again = await claimVideoEmail("verify@example.com", new Date(), deps)
    check("a second start is refused", !again.ok)

    // Between the list and the send.
    await prisma.purchase.create({ data: { userId: ids.buysmore, product: "drft" } })
    used.add("promo_usescode")

    console.log("\nthe send")
    let guard = 0
    for (let b = await sendVideoEmailBatch(claim.id, new Date(), deps); !b.done && guard < 50; guard++) b = await sendVideoEmailBatch(claim.id, new Date(), deps)
    const one = mailTo("one")[0]
    check("everyone listed is mailed once", (["nothing", "one", "oneused", "nocode", "two", "buysmore"] as Who[]).every((w) => mailTo(w).length === 1))
    check("every email links the video and shows its play image", outbox.filter((m) => m.to.startsWith(TAG)).every((m) => m.html.includes(VIDEO_EMAIL.videoUrl) && m.html.includes("fltr-video.jpg")))
    check("nothing-owned gets their code and the bundle pitch, no $39", mailTo("nothing")[0]?.html.includes(code("nothing")) && mailTo("nothing")[0]?.html.includes("all three plugins for $49") && !mailTo("nothing")[0]?.html.includes("Get both for"))
    check("an owner of one gets both, the code as the alternative", Boolean(one?.html.includes("You have shft. Get drft + fltr for $39") && one?.html.includes(code("one")) && one?.html.includes("Or use your code")))
    check("its subject leads with the $39 offer", Boolean(one?.subject.includes("$39")))
    check("used code: the $39 offer, no code", Boolean(mailTo("oneused")[0]?.html.includes("You have fltr. Get shft + drft for $39") && !mailTo("oneused")[0]?.html.includes("Use my $10 code")))
    check("an owner of two gets the code, not the $39 offer", Boolean(mailTo("two")[0]?.html.includes(code("two")) && !mailTo("two")[0]?.html.includes("Get both for")))
    check("bought a second plugin since: code only, the $39 offer dropped", Boolean(mailTo("buysmore")[0] && !mailTo("buysmore")[0].html.includes("Get both for") && mailTo("buysmore")[0].html.includes(code("buysmore"))))
    check("used the code since and nothing else to offer: not mailed", mailTo("usescode").length === 0)
    check("no placeholder reaches anyone", outbox.every((m) => !/\{\{[A-Z_]+\}\}|<!--\/?[a-z-]+-->/.test(m.html)))
    const finished = await prisma.memberOfferReminder.findUnique({ where: { id: claim.id } })
    check("the send is marked finished", Boolean(finished?.completedAt))

    console.log("\nthe $39 link (Stripe test mode, through the dev server)")
    const link = one?.html.match(/href="([^"]*\/api\/cart\/complete-set\?t=[^"]+)"/)?.[1]?.replace(/&amp;/g, "&")
    check("the email carries a $39 link", Boolean(link))
    if (link && process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
      const res = await fetch(link.replace(/^https?:\/\/[^/]+/, BASE), { redirect: "manual" })
      const to = res.headers.get("location") ?? ""
      check("it opens a Stripe checkout", res.status === 303 && to.startsWith("https://checkout.stripe.com/"), `${res.status} ${to.slice(0, 60)}`)
      const sid = to.match(/cs_test_[A-Za-z0-9]+/)?.[0]
      if (sid) {
        const s = await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(sid)
        check("for $39, drft + fltr, bound to the account's email", s.amount_total === 3900 && s.metadata?.products === "drft,fltr" && s.customer_email === address("one"), { total: s.amount_total, products: s.metadata?.products, email: s.customer_email })
        await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.expire(sid).catch(() => {})
      }
    } else {
      console.log("  note  no Stripe test key - skipping the checkout")
    }
  } finally {
    const reminder = await prisma.memberOfferReminder.findUnique({ where: { slug: VIDEO_EMAIL.slug } })
    if (reminder) await prisma.memberOfferReminder.delete({ where: { id: reminder.id } })
    if (offerId) await prisma.memberOffer.delete({ where: { id: offerId } })
    const users = await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}-` } } })
    console.log(`\n  cleanup: removed the video email and its list, the seeded offer and codes, and ${users.count} seeded accounts`)
    await prisma.$disconnect()
  }
  console.log(failures ? `\nverify-video-email: ${failures} failed` : "\nverify-video-email: all passed")
  process.exit(failures ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
