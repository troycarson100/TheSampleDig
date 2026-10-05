import { memberOfferUrl } from "@/lib/email"
import {
  SAMPLE_UNSUBSCRIBE,
  campaignPreview,
  claimCampaign,
  sendCampaignBatch,
  sendCampaignTest,
  type Campaign,
  type CampaignBatch,
  type CampaignClaim,
  type CampaignPreview,
} from "@/lib/member-campaign"
import type { ReminderDeps } from "@/lib/offer-reminder"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import { fillVideoEmail, renderVideoEmailTemplate } from "@/lib/video-email-html"
import { VIDEO_EMAIL, setMissing, videoParts, videoSubject, videoVariant, type VideoParts } from "@/lib/video-email-logic"

// The fltr video email (the third member email), as a campaign on the shared
// machinery in lib/member-campaign.ts. The rules are in video-email-logic.ts,
// the drawing in video-email-html.ts.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
const EXAMPLE_CODE = "SR10TEST00"
const names = (ids: readonly PluginId[]) => ids.map((id) => PLUGINS[id].name).join(" + ")

export const VIDEO_CAMPAIGN: Campaign<VideoParts> = {
  slug: VIDEO_EMAIL.slug,
  offerSlug: VIDEO_EMAIL.offerSlug,
  candidates: "code-holders-and-owners",
  setEndsAt: VIDEO_EMAIL.setEndsAt,
  parts: (p) => videoParts(p),
  wantsSet: (p) => p.set,
  withoutSet: (p) => (p.code ? { code: true, set: false } : "nothing-to-offer"),
  variant: videoVariant,
  variants: ["code", "set", "code+set"],
  subject: videoSubject,
  template: renderVideoEmailTemplate,
  fill: (tpl, p, person, links) =>
    fillVideoEmail(tpl, {
      code: p.code ? person.code : null,
      offerUrl: p.code ? links.offerUrl : null,
      setUrl: p.set ? links.setUrl : null,
      setOwned: p.set ? names(person.owns) : null,
      setNames: p.set ? names(setMissing(person.owns)) : null,
      ownsNone: person.owns.length === 0,
      unsubscribeUrl: links.unsubscribeUrl,
    }),
  samples: (tpl) => {
    const example = (p: VideoParts, ownsNone: boolean) =>
      fillVideoEmail(tpl, {
        code: p.code ? EXAMPLE_CODE : null,
        offerUrl: p.code ? memberOfferUrl(EXAMPLE_CODE) : null,
        // A test's set button goes to the fltr page: a real link is one account's own.
        setUrl: p.set ? `${APP_URL}/fltr` : null,
        setOwned: p.set ? "shft" : null,
        setNames: p.set ? "drft + fltr" : null,
        ownsNone,
        unsubscribeUrl: SAMPLE_UNSUBSCRIBE,
      })
    return [
      { variant: "code (owns nothing)", subject: videoSubject({ code: true, set: false }), html: example({ code: true, set: false }, true) },
      { variant: "set (owns one, code used)", subject: videoSubject({ code: false, set: true }), html: example({ code: false, set: true }, false) },
      { variant: "code+set (owns one)", subject: videoSubject({ code: true, set: true }), html: example({ code: true, set: true }, false) },
    ]
  },
}

export type VideoEmailPreview = CampaignPreview
export type VideoBatch = CampaignBatch

export const videoEmailPreview = (now?: Date, deps?: ReminderDeps) => campaignPreview(VIDEO_CAMPAIGN, now, deps)
export const claimVideoEmail = (sentByEmail: string | null, now?: Date, deps?: ReminderDeps): Promise<CampaignClaim> =>
  claimCampaign(VIDEO_CAMPAIGN, sentByEmail, now, deps)
export const sendVideoEmailBatch = (id: string, now?: Date, deps?: ReminderDeps) => sendCampaignBatch(VIDEO_CAMPAIGN, id, now, deps)
export const sendVideoEmailTest = (to: string, unsubscribeFor: string) => sendCampaignTest(VIDEO_CAMPAIGN, to, unsubscribeFor)
