import { BUNDLE_OFFER_ENDS, PLUGIN_ORDER, PLUGINS, bundleWindow, type PluginId } from "./plugins"
import { PRICING } from "./products"
import { cartTotals } from "./cart-pricing"
import { formatCents, quotePromo, type PromoOffer } from "./cart-promo"
import { MEMBER_OFFER, formatOfferDate } from "./member-offer-logic"

// The second email about the member offer: the bundle sale and fltr, and the
// code they were already sent, to the people who have done nothing with it.
// The rules, pure: no Prisma, no Stripe, no mail. lib/offer-reminder.ts does
// the I/O with them, and lib/offer-reminder-email.ts draws the email.

/** One reminder: a second would be a new slug, and the database refuses to
 *  claim the same slug twice. */
export const OFFER_REMINDER = {
  slug: "members-10-off-2026-10-reminder-1",
  /** The offer whose codes it is about. */
  offerSlug: MEMBER_OFFER.slug,
} as const

/** The plugin the reminder is about, and so the one a reader must not already
 *  own. */
export const REMINDER_PLUGIN: PluginId = "fltr"

/**
 * Which of the two emails someone gets. The bundle price is every plugin in
 * one cart, so it is only on offer to someone who owns none of them; anyone
 * who owns one is told about fltr alone, never about a price they cannot have.
 */
export type ReminderVariant = "bundle" | "fltr"

export function reminderVariant(owns: readonly PluginId[]): ReminderVariant {
  return owns.length === 0 ? "bundle" : "fltr"
}

export interface ReminderCandidate {
  userId: string
  emailMarketingOptIn: boolean
  productUpdateOptIn: boolean
  /** The plugins this account owns now. */
  owns: readonly PluginId[]
  /** They were mailed a code in the offer. */
  codeSent: boolean
  /** Stripe says their code has been used. */
  codeRedeemed: boolean
}

/** Why someone is left off the list, for the admin page's account of it. */
export type ReminderExclusion = "no-code" | "redeemed" | "owns-fltr" | "opted-out"

/**
 * Why someone is not reminded, or null when they are. It goes to the people
 * the offer went to who still take email from us - both switches, the rule
 * every product email follows - and who have neither used their code nor
 * bought fltr. Someone who used the code on fltr counts as having used it.
 */
export function reminderExclusion(c: ReminderCandidate): ReminderExclusion | null {
  if (!c.codeSent) return "no-code"
  if (c.codeRedeemed) return "redeemed"
  if (c.owns.includes(REMINDER_PLUGIN)) return "owns-fltr"
  if (!c.emailMarketingOptIn || !c.productUpdateOptIn) return "opted-out"
  return null
}

export function isReminderRecipient(c: ReminderCandidate): boolean {
  return reminderExclusion(c) === null
}

export interface ReminderPrices {
  /** "$10" */
  amountOff: string
  /** All three: on the site, at list, and with the code. */
  bundle: string
  bundleWas: string
  /** What the bundle price takes off list, before the code. */
  bundleSaving: string
  bundleWithCode: string
  /** fltr alone: on the site, at list, and with the code. */
  fltr: string
  fltrWas: string
  fltrWithCode: string
}

/**
 * Every figure the email prints, worked out the way checkout works it out:
 * the cart's own totals with the code quoted on them, not sums done here. A
 * figure in an email is a promise, so if the code would not simply come off -
 * a minimum, a restriction - this throws rather than print a guess.
 */
export function reminderPrices(amountOffCents: number = MEMBER_OFFER.amountOffCents): ReminderPrices {
  const offer: PromoOffer = { code: "MEMBER", percentOff: null, amountOffCents, minimumCents: null, restricted: false }
  const withCode = (ids: readonly PluginId[]) => {
    const quote = quotePromo(cartTotals(ids), offer)
    if (quote.kind !== "applied" || quote.totalCents <= 0) throw new Error("The member code does not price this order.")
    return formatCents(quote.totalCents)
  }
  const all = cartTotals(PLUGIN_ORDER)
  if (!all.bundleApplied) throw new Error("All three plugins did not price as the bundle.")
  return {
    amountOff: formatCents(amountOffCents),
    bundle: formatCents(all.total * 100),
    bundleWas: formatCents(PRICING.bundle.compareAt * 100),
    bundleSaving: formatCents((PRICING.bundle.compareAt - all.total) * 100),
    bundleWithCode: withCode(PLUGIN_ORDER),
    fltr: formatCents(PRICING[REMINDER_PLUGIN].price * 100),
    fltrWas: formatCents(PRICING[REMINDER_PLUGIN].msrp * 100),
    fltrWithCode: withCode([REMINDER_PLUGIN]),
  }
}

/** The subject line: the price the reader can actually have. */
export function reminderSubject(variant: ReminderVariant, prices: ReminderPrices = reminderPrices()): string {
  return variant === "bundle"
    ? `All three plugins for ${prices.bundleWithCode}, with your member code`
    : `${PLUGINS[REMINDER_PLUGIN].name} for ${prices.fltrWithCode}, with your member code`
}

/** "October 31" while the bundle price still has a deadline ahead of it, or
 *  null - and then the email names no date rather than a past one. */
export function bundleEndsOn(now: Date = new Date(), raw: string | null = BUNDLE_OFFER_ENDS): string | null {
  const w = bundleWindow(now, raw)
  return w.live && w.endsAt ? formatOfferDate(w.endsAt) : null
}
