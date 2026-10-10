import { test } from "node:test"
import assert from "node:assert/strict"
import { fillVideoEmail2, renderVideoEmail2Template } from "./video-email-2-html"
import { VIDEO_EMAIL_2, videoSubject2 } from "./video-email-2-logic"
import { VIDEO_EMAIL, videoSubject } from "./video-email-logic"
import { PLUGIN_ORDER } from "./plugins"
import { PRICING } from "./products"
import { COMPLETE_SET_PRICE } from "./complete-set-logic"

const tpl = renderVideoEmail2Template({ amountOffCents: 1000, codeExpires: "October 30", setEnds: "October 31" })
const fill = (o: Partial<Parameters<typeof fillVideoEmail2>[1]>) =>
  fillVideoEmail2(tpl, {
    code: null, offerUrl: null, setUrl: null, setOwned: null, setNames: null, owns: [],
    unsubscribeUrl: "https://x/unsub?t=1&u=2", ...o,
  })
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

test("video 2: its own slug and video, the same offer as the third email", () => {
  assert.notEqual(VIDEO_EMAIL_2.slug, VIDEO_EMAIL.slug)
  assert.notEqual(VIDEO_EMAIL_2.videoUrl, VIDEO_EMAIL.videoUrl)
  assert.match(VIDEO_EMAIL_2.videoUrl, /youtube\.com\/watch\?v=KdBNYHwnRtI$/)
  assert.equal(VIDEO_EMAIL_2.offerSlug, VIDEO_EMAIL.offerSlug)
})

test("video 2: new subjects, short enough, that never repeat the third email's", () => {
  for (const p of [{ code: true, set: false }, { code: false, set: true }, { code: true, set: true }]) {
    assert.notEqual(videoSubject2(p), videoSubject(p))
    assert.ok(videoSubject2(p).length <= 60, videoSubject2(p))
  }
  assert.ok(videoSubject2({ code: false, set: true }).includes(`$${COMPLETE_SET_PRICE[2]}`))
  assert.match(videoSubject2({ code: true, set: false }), /\$10 code/)
})

test("video 2, owns nothing with a code: the video, all three plugins priced, the bundle with the code", () => {
  const html = fill({ code: "SR10ABCDEF", offerUrl: "https://x/fltr?promo=SR10ABCDEF" })
  const t = text(html)
  assert.match(html, /youtube\.com\/watch\?v=KdBNYHwnRtI/)
  assert.ok(html.includes("/email/shft-video.jpg"), "the shft video's own picture")
  for (const id of PLUGIN_ORDER) assert.ok(html.includes(`/email/${id}.jpg`), id)
  assert.ok(t.includes("The three plugins"))
  assert.ok(t.includes(`shft for $${PRICING.shft.price - 10} instead of $${PRICING.shft.price}`), t)
  assert.ok(t.includes(`all three plugins for $${PRICING.bundle.price - 10} instead of $${PRICING.bundle.price}`), t)
  assert.ok(t.includes("SR10ABCDEF"))
  assert.equal(t.includes("Complete your set"), false)
  assert.equal(html.includes("<!--"), false, "a marker was left in")
  assert.equal(html.includes("{{"), false, "a placeholder was left in")
})

test("video 2, owns shft with an unused code: the two missing plugins, the set offer, then the code", () => {
  const html = fill({
    code: "SR10ABCDEF", offerUrl: "https://x/fltr?promo=SR10ABCDEF",
    setUrl: "https://x/set?t=1", setOwned: "shft", setNames: "drft + fltr", owns: ["shft"],
  })
  const t = text(html)
  assert.equal(html.includes("/email/shft.jpg"), false, "the plugin they own is pictured")
  assert.ok(html.includes("/email/drft.jpg") && html.includes("/email/fltr.jpg"))
  assert.ok(t.includes("What you're missing"))
  assert.ok(t.includes(`You have shft. Get drft + fltr for $${COMPLETE_SET_PRICE[2]}`), t)
  assert.ok(t.includes("Or your code, still unused"))
  assert.equal(/all three/i.test(t), false, "the bundle was put to an owner")
  assert.equal(html.includes("<!--"), false)
})

test("video 2, owns shft, code used: the set offer alone, no code box", () => {
  const html = fill({ setUrl: "https://x/set?t=1", setOwned: "shft", setNames: "drft + fltr", owns: ["shft"] })
  const t = text(html)
  assert.ok(t.includes("Complete your set"))
  assert.equal(t.includes("off anything"), false)
  assert.equal(html.includes("{{"), false)
})

test("video 2: a set part with no link is left out rather than pointing nowhere", () => {
  const html = fill({ code: "SR10ABCDEF", offerUrl: "https://x/fltr?promo=SR10ABCDEF", setOwned: "shft", setNames: "drft + fltr", owns: ["shft"] })
  assert.equal(text(html).includes("Complete your set"), false)
})

test("video 2: no stylesheet, script or web font, and every picture says what it is", () => {
  assert.equal(/<style|<script|<link/i.test(tpl), false)
  for (const img of tpl.match(/<img[^>]*>/g) ?? []) assert.ok((img.match(/alt="([^"]*)"/)?.[1] ?? "").length > 5, img)
})
