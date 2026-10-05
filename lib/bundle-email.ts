import { memberOfferUrl } from "@/lib/email"
import {
  SAMPLE_UNSUBSCRIBE,
  campaignPreview,
  claimCampaign,
  sendCampaignBatch,
  sendCampaignTest,
  type Campaign,
  type CampaignClaim,
} from "@/lib/member-campaign"
import type { ReminderDeps } from "@/lib/offer-reminder"
import type { PluginId } from "@/lib/plugins"
import { fillBundleEmail, renderBundleEmailTemplate } from "@/lib/bundle-email-html"
import {
  BUNDLE_EMAIL,
  BUNDLE_VARIANTS,
  bundleParts,
  bundleSubject,
  bundleVariant,
  setPrices,
  type BundleParts,
} from "@/lib/bundle-email-logic"

// The bundle email (the fourth member email), as a campaign on the shared
// machinery in lib/member-campaign.ts. Rules in bundle-email-logic.ts, the
// drawing in bundle-email-html.ts.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
const EXAMPLE_CODE = "SR10TEST00"

export const BUNDLE_CAMPAIGN: Campaign<BundleParts> = {
  slug: BUNDLE_EMAIL.slug,
  offerSlug: BUNDLE_EMAIL.offerSlug,
  candidates: "everyone",
  setEndsAt: BUNDLE_EMAIL.endsAt,
  parts: (p) => bundleParts(p),
  wantsSet: (p) => p.offer === "set",
  withoutSet: (p) => ({ ...p, offer: "none" }),
  variant: bundleVariant,
  variants: BUNDLE_VARIANTS,
  subject: bundleSubject,
  template: renderBundleEmailTemplate,
  fill: (tpl, p, person, links) => {
    const prices = p.offer === "set" ? setPrices(p.missing) : null
    return fillBundleEmail(tpl, {
      offer: p.offer,
      owns: person.owns,
      missing: p.missing,
      code: p.code ? person.code : null,
      offerUrl: p.code ? links.offerUrl : null,
      setUrl: links.setUrl,
      setPrice: prices?.price ?? null,
      setWas: prices?.was ?? null,
      email: person.email,
      unsubscribeUrl: links.unsubscribeUrl,
    })
  },
  samples: (tpl) => {
    const example = (owns: PluginId[], code: boolean) => {
      const p = bundleParts({ emailMarketingOptIn: true, productUpdateOptIn: true, owns, code: code ? EXAMPLE_CODE : null, codeRedeemed: false })
      if (typeof p === "string") throw new Error("sample has nothing to offer")
      const prices = p.offer === "set" ? setPrices(p.missing) : null
      return {
        variant: `${bundleVariant(p)} (owns ${owns.length ? owns.join(", ") : "nothing"})`,
        subject: bundleSubject(p),
        html: fillBundleEmail(tpl, {
          offer: p.offer,
          owns,
          missing: p.missing,
          code: p.code ? EXAMPLE_CODE : null,
          offerUrl: p.code ? memberOfferUrl(EXAMPLE_CODE) : null,
          // A test's set button goes to the fltr page: a real link is one account's own.
          setUrl: p.offer === "set" ? `${APP_URL}/fltr` : null,
          setPrice: prices?.price ?? null,
          setWas: prices?.was ?? null,
          email: "you@example.com",
          unsubscribeUrl: SAMPLE_UNSUBSCRIBE,
        }),
      }
    }
    return [example([], true), example(["shft"], true), example(["shft", "drft"], false)]
  },
}

export const bundleEmailPreview = (now?: Date, deps?: ReminderDeps) => campaignPreview(BUNDLE_CAMPAIGN, now, deps)
export const claimBundleEmail = (sentByEmail: string | null, now?: Date, deps?: ReminderDeps): Promise<CampaignClaim> =>
  claimCampaign(BUNDLE_CAMPAIGN, sentByEmail, now, deps)
export const sendBundleEmailBatch = (id: string, now?: Date, deps?: ReminderDeps) => sendCampaignBatch(BUNDLE_CAMPAIGN, id, now, deps)
export const sendBundleEmailTest = (to: string, unsubscribeFor: string) => sendCampaignTest(BUNDLE_CAMPAIGN, to, unsubscribeFor)
