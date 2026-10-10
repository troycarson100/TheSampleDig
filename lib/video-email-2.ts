import { memberOfferUrl } from "@/lib/email"
import { SAMPLE_UNSUBSCRIBE, type Campaign } from "@/lib/member-campaign"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import { fillVideoEmail2, renderVideoEmail2Template } from "@/lib/video-email-2-html"
import { VIDEO_EMAIL_2, videoSubject2 } from "@/lib/video-email-2-logic"
import { setMissing, videoParts, videoVariant, type VideoParts } from "@/lib/video-email-logic"

// The shft video email (the fifth member email), as a campaign on the shared
// machinery in lib/member-campaign.ts. Who gets what is the third email's rule;
// the video, the words, the subject and the row of plugins are its own.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
const EXAMPLE_CODE = "SR10TEST00"
const names = (ids: readonly PluginId[]) => ids.map((id) => PLUGINS[id].name).join(" + ")

export const VIDEO_2_CAMPAIGN: Campaign<VideoParts> = {
  slug: VIDEO_EMAIL_2.slug,
  offerSlug: VIDEO_EMAIL_2.offerSlug,
  candidates: "code-holders-and-owners",
  setEndsAt: VIDEO_EMAIL_2.setEndsAt,
  parts: (p) => videoParts(p),
  wantsSet: (p) => p.set,
  withoutSet: (p) => (p.code ? { code: true, set: false } : "nothing-to-offer"),
  variant: videoVariant,
  variants: ["code", "set", "code+set"],
  subject: videoSubject2,
  template: renderVideoEmail2Template,
  fill: (tpl, p, person, links) =>
    fillVideoEmail2(tpl, {
      code: p.code ? person.code : null,
      offerUrl: p.code ? links.offerUrl : `${APP_URL}${PLUGINS.shft.href}`,
      setUrl: p.set ? links.setUrl : null,
      setOwned: p.set ? names(person.owns) : null,
      setNames: p.set ? names(setMissing(person.owns)) : null,
      owns: person.owns,
      unsubscribeUrl: links.unsubscribeUrl,
    }),
  samples: (tpl) => {
    const example = (p: VideoParts, owns: PluginId[]) =>
      fillVideoEmail2(tpl, {
        code: p.code ? EXAMPLE_CODE : null,
        offerUrl: p.code ? memberOfferUrl(EXAMPLE_CODE) : `${APP_URL}${PLUGINS.shft.href}`,
        // A test's set button goes to the fltr page: a real link is one account's own.
        setUrl: p.set ? `${APP_URL}${PLUGINS.fltr.href}` : null,
        setOwned: p.set ? names(owns) : null,
        setNames: p.set ? names(setMissing(owns)) : null,
        owns,
        unsubscribeUrl: SAMPLE_UNSUBSCRIBE,
      })
    return [
      { variant: "code (owns nothing)", subject: videoSubject2({ code: true, set: false }), html: example({ code: true, set: false }, []) },
      { variant: "set (owns one, code used)", subject: videoSubject2({ code: false, set: true }), html: example({ code: false, set: true }, ["shft"]) },
      { variant: "code+set (owns one)", subject: videoSubject2({ code: true, set: true }), html: example({ code: true, set: true }, ["shft"]) },
    ]
  },
}
