/**
 * Runs the member-offer reminder end to end against the LOCAL database, with
 * Stripe and the mail server replaced by fakes: who is listed, which of the
 * two emails each person gets, what a batch does about someone who bought or
 * whose mail failed since the list was made, and that nobody is mailed twice.
 *
 *   npx tsx scripts/verify-offer-reminder.ts
 *
 * It seeds its own accounts (reminder-verify-*@example.com), an offer and its
 * codes, and deletes every row it made when it is done, pass or fail. It
 * refuses to run if the local database already holds the member offer or the
 * reminder: those would be someone's real test data.
 */
import "./load-env"
import "./ensure-not-production-db"
import type { Transporter } from "nodemailer"
import { prisma } from "@/lib/db"
import { MEMBER_OFFER } from "@/lib/member-offer-logic"
import { OFFER_REMINDER, reminderPrices } from "@/lib/offer-reminder-logic"
import {
  claimOfferReminder,
  offerReminderPreview,
  sendOfferReminderBatch,
  type ReminderDeps,
} from "@/lib/offer-reminder"

let failures = 0
function check(label: string, condition: boolean, detail: unknown = "") {
  if (condition) console.log(`ok    ${label}`)
  else {
    failures++
    console.log(`FAIL  ${label}${detail === "" ? "" : `  ->  ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`)
  }
}

const TAG = "reminder-verify"
const address = (who: string) => `${TAG}-${who}@example.com`

// who            owns at claim   code      then, before their batch
// nothing        -               unused    -                     -> bundle email
// shft           shft            unused    -                     -> fltr email
// hasfltr        fltr            unused                          left off: owns fltr
// used           drft            USED                            left off: used the code
// optout         -               unused    (unsubscribed)        left off: opted out
// unsent         -               never mailed a code             left off: no code
// buysfltr       -               unused    buys fltr             skipped at send
// buysshft       -               unused    buys shft             fltr email, not the bundle
// usescode       -               unused    uses the code         skipped at send
// bounces        -               unused    mail fails once       sent on resume
const PEOPLE = ["nothing", "shft", "hasfltr", "used", "optout", "unsent", "buysfltr", "buysshft", "usescode", "bounces"] as const
type Who = (typeof PEOPLE)[number]
const OWNS: Partial<Record<Who, string[]>> = { shft: ["shft"], hasfltr: ["fltr"], used: ["drft"] }

type Mail = { to: string; subject: string; html: string; headers: Record<string, string> }

async function main() {
  // Unsubscribe links are signed with this. A run with only .env.local (as in
  // a worktree, which has no .env) has none; any value will do for a link
  // nobody follows.
  process.env.NEXTAUTH_SECRET ||= "verify-offer-reminder"

  if (await prisma.memberOffer.findUnique({ where: { slug: MEMBER_OFFER.slug } })) {
    throw new Error(`The local database already has the offer ${MEMBER_OFFER.slug}. Not touching it.`)
  }
  if (await prisma.memberOfferReminder.findUnique({ where: { slug: OFFER_REMINDER.slug } })) {
    throw new Error(`The local database already has the reminder ${OFFER_REMINDER.slug}. Not touching it.`)
  }

  const ids = {} as Record<Who, string>
  const codes = {} as Record<Who, string>
  let offerId = ""

  // Stripe, faked: which promotion codes have been used.
  const usedPromotionCodes = new Set<string>()
  // The mail server, faked: everything "sent", and who to bounce once.
  const outbox: Mail[] = []
  const bounceOnce = new Set<string>()
  const deps: ReminderDeps = {
    redeemedCodes: async () => new Set(usedPromotionCodes),
    isRedeemed: async (id) => usedPromotionCodes.has(id),
    openTransporter: () =>
      ({
        sendMail: async (mail: Mail) => {
          if (bounceOnce.delete(mail.to)) throw new Error("550 mailbox unavailable (faked)")
          outbox.push(mail)
        },
        close: () => {},
      }) as unknown as Transporter,
  }
  const mailTo = (who: Who) => outbox.filter((m) => m.to === address(who))

  try {
    // ---- seed ----
    for (const who of PEOPLE) {
      const user = await prisma.user.create({
        data: {
          email: address(who),
          passwordHash: "x",
          emailMarketingOptIn: who !== "optout",
          purchases: { create: (OWNS[who] ?? []).map((product) => ({ product })) },
        },
      })
      ids[who] = user.id
      codes[who] = `SR10${who.toUpperCase().slice(0, 6).padEnd(6, "2")}`
    }
    const offer = await prisma.memberOffer.create({
      data: {
        slug: MEMBER_OFFER.slug,
        amountOffCents: MEMBER_OFFER.amountOffCents,
        couponId: "coupon_verify",
        cutoffAt: new Date(),
        expiresAt: new Date(Date.now() + 20 * 86_400_000),
        subject: "verify",
        bodyHtml: "verify",
        codes: {
          create: PEOPLE.map((who) => ({
            userId: ids[who],
            email: address(who),
            code: codes[who],
            promotionCodeId: `promo_${who}`,
            sentAt: who === "unsent" ? null : new Date(),
          })),
        },
      },
    })
    offerId = offer.id
    usedPromotionCodes.add("promo_used")

    // ---- before anything is sent ----
    const before = await offerReminderPreview(new Date(), deps)
    check("preview: lists the six who have a code and have done nothing with it", before.recipientCount === 6, before.recipientCount)
    check("preview: five own nothing, one owns a plugin", before.byVariant.bundle === 5 && before.byVariant.fltr === 1, before.byVariant)
    check(
      "preview: says why the others are left out",
      before.excluded?.redeemed === 1 && before.excluded["owns-fltr"] === 1 && before.excluded["opted-out"] === 1,
      before.excluded,
    )
    check("preview: nothing is claimed by looking", before.reminder === null && before.unavailable === null, before.unavailable)
    check("preview: mails nobody", outbox.length === 0, outbox.length)

    // ---- claim ----
    const claim = await claimOfferReminder("admin@example.com", new Date(), deps)
    check("claim: starts, with the same six", claim.ok && claim.recipientCount === 6, claim)
    const again = await claimOfferReminder("admin@example.com", new Date(), deps)
    check("claim: a second press is refused", !again.ok && /already been started/.test(again.error), again)
    check("claim: mails nobody by itself", outbox.length === 0, outbox.length)
    if (!claim.ok) throw new Error("claim failed; nothing further to check")

    // ---- things change between the list being made and the batch ----
    await prisma.purchase.create({ data: { userId: ids.buysfltr, product: "fltr" } })
    await prisma.purchase.create({ data: { userId: ids.buysshft, product: "shft" } })
    usedPromotionCodes.add("promo_usescode")
    bounceOnce.add(address("bounces"))

    const first = await sendOfferReminderBatch(claim.reminderId, new Date(), deps)
    check("batch 1: three sent, two dropped, one failed", first.sent === 3 && first.skipped === 2 && first.failed === 1, first)
    check("batch 1: not done while the failure is outstanding", first.done === false, first.done)

    const prices = reminderPrices()
    const nothing = mailTo("nothing")[0]
    check("owns nothing: gets the bundle email", Boolean(nothing) && nothing.subject.includes(`All three plugins for ${prices.bundleWithCode}`), nothing?.subject)
    check("owns nothing: their own code, in the email and on its link",
      Boolean(nothing) && nothing.html.includes(codes.nothing) && nothing.html.includes(`/fltr?promo=${codes.nothing}`))
    check("owns nothing: no placeholder left unfilled", Boolean(nothing) && !nothing.html.includes("{{"), nothing?.html.match(/\{\{[^}]*\}\}/)?.[0])
    check("owns nothing: a one-click unsubscribe of their own",
      Boolean(nothing) && /unsubscribe\?token=/.test(nothing.headers["List-Unsubscribe"] ?? "") && nothing.html.includes(nothing.headers["List-Unsubscribe"].slice(1, -1)),
      nothing?.headers)
    const shft = mailTo("shft")[0]
    check("owns shft: gets the fltr email, with no bundle in it",
      Boolean(shft) && shft.subject.startsWith("fltr for") && !/all three|bundle/i.test(shft.html.replace(/<[^>]+>/g, " ")), shft?.subject)
    const buysshft = mailTo("buysshft")[0]
    check("bought shft since the list: gets the fltr email, not the bundle they were down for",
      Boolean(buysshft) && buysshft.subject.startsWith("fltr for"), buysshft?.subject)
    check("bought fltr since the list: not mailed", mailTo("buysfltr").length === 0)
    check("used the code since the list: not mailed", mailTo("usescode").length === 0)
    for (const who of ["hasfltr", "used", "optout", "unsent"] as const) {
      check(`${who}: never on the list, never mailed`, mailTo(who).length === 0)
    }
    check("bounced: not counted as sent", mailTo("bounces").length === 0)

    // ---- resume ----
    const second = await sendOfferReminderBatch(claim.reminderId, new Date(), deps)
    check("batch 2: the one that failed goes on the retry, and that is the end", second.sent === 1 && second.done === true, second)
    check("bounced: mailed once it works", mailTo("bounces").length === 1)
    const third = await sendOfferReminderBatch(claim.reminderId, new Date(), deps)
    check("batch 3: nothing left, nothing sent", third.attempted === 0 && third.sent === 0 && third.done === true, third)

    const after = await offerReminderPreview(new Date(), deps)
    check("afterwards: four sent, two left out at the last moment, finished",
      after.reminder?.sentCount === 4 && after.reminder.skippedCount === 2 && Boolean(after.reminder.completedAt), after.reminder)
    const perPerson = new Map<string, number>()
    for (const m of outbox) perPerson.set(m.to, (perPerson.get(m.to) ?? 0) + 1)
    check("nobody was mailed twice", [...perPerson.values()].every((n) => n === 1) && outbox.length === 4, [...perPerson])

    // ---- two tabs pressing Resume at once ----
    await prisma.memberOfferReminderSend.updateMany({ where: { reminderId: claim.reminderId }, data: { sentAt: null, skippedAt: null, failedAt: null } })
    await prisma.memberOfferReminder.update({ where: { id: claim.reminderId }, data: { completedAt: null } })
    outbox.length = 0
    await Promise.all([
      sendOfferReminderBatch(claim.reminderId, new Date(), deps),
      sendOfferReminderBatch(claim.reminderId, new Date(), deps),
    ])
    const twice = new Map<string, number>()
    for (const m of outbox) twice.set(m.to, (twice.get(m.to) ?? 0) + 1)
    check("two batches at once: still one email each", outbox.length === 4 && [...twice.values()].every((n) => n === 1), [...twice])

    // ---- an expired offer sends nothing ----
    await prisma.memberOffer.update({ where: { id: offerId }, data: { expiresAt: new Date(Date.now() - 1000) } })
    let refused = ""
    await sendOfferReminderBatch(claim.reminderId, new Date(), deps).catch((e: Error) => { refused = e.message })
    check("an offer that has run out: the batch refuses", /expired/.test(refused), refused)
  } finally {
    // ---- cleanup: every row this made, and nothing else ----
    if (offerId) await prisma.memberOffer.delete({ where: { id: offerId } }).catch(() => {}) // codes, reminder and its list cascade
    const mine = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}-` } }, select: { id: true } })
    await prisma.purchase.deleteMany({ where: { userId: { in: mine.map((u) => u.id) } } })
    await prisma.user.deleteMany({ where: { id: { in: mine.map((u) => u.id) } } })
    const left =
      (await prisma.user.count({ where: { email: { startsWith: `${TAG}-` } } })) +
      (await prisma.memberOffer.count({ where: { slug: MEMBER_OFFER.slug } })) +
      (await prisma.memberOfferReminder.count({ where: { slug: OFFER_REMINDER.slug } }))
    check("cleanup: every seeded row is gone", left === 0, left)
    await prisma.$disconnect()
  }
}

main()
  .then(() => {
    console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) FAILED`)
    process.exit(failures === 0 ? 0 : 1)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
