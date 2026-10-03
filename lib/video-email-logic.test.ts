import { test } from "node:test"
import assert from "node:assert/strict"
import { setMissing, videoParts, videoSubject, videoVariant, type VideoCandidate } from "./video-email-logic"
import { PH, fillVideoEmail, renderVideoEmailTemplate } from "./video-email-html"
import { COMPLETE_SET_PRICE } from "./complete-set-logic"

const SET = `$${COMPLETE_SET_PRICE[2]}`

const base: VideoCandidate = { emailMarketingOptIn: true, productUpdateOptIn: true, owns: [], code: "SR10ABCDEF", codeRedeemed: false }

test("videoParts: an unused code, owning nothing - the code", () => {
  assert.deepEqual(videoParts(base), { code: true, set: false })
})

test("videoParts: owning exactly one plugin - the set offer, and the code if unused", () => {
  assert.deepEqual(videoParts({ ...base, owns: ["shft"] }), { code: true, set: true })
  assert.deepEqual(videoParts({ ...base, owns: ["fltr"], codeRedeemed: true }), { code: false, set: true })
  assert.deepEqual(videoParts({ ...base, owns: ["drft"], code: null }), { code: false, set: true })
})

test("videoParts: owning two - the code if unused, never the set offer", () => {
  assert.deepEqual(videoParts({ ...base, owns: ["shft", "drft"] }), { code: true, set: false })
  assert.equal(videoParts({ ...base, owns: ["shft", "drft"], codeRedeemed: true }), "nothing-to-offer")
})

test("videoParts: a used code and nothing else - not sent", () => {
  assert.equal(videoParts({ ...base, codeRedeemed: true }), "nothing-to-offer")
  assert.equal(videoParts({ ...base, code: null }), "nothing-to-offer")
})

test("videoParts: owning all three - nothing to offer", () => {
  assert.equal(videoParts({ ...base, owns: ["shft", "drft", "fltr"] }), "nothing-to-offer")
})

test("videoParts: either email switch off - not sent, whatever they could have had", () => {
  assert.equal(videoParts({ ...base, owns: ["shft"], emailMarketingOptIn: false }), "opted-out")
  assert.equal(videoParts({ ...base, productUpdateOptIn: false }), "opted-out")
})

test("videoVariant and videoSubject follow the parts", () => {
  assert.equal(videoVariant({ code: true, set: true }), "code+set")
  assert.equal(videoVariant({ code: false, set: true }), "set")
  assert.ok(videoSubject({ code: false, set: true }).includes(SET))
  assert.match(videoSubject({ code: true, set: false }), /\$10 code/)
})

test("setMissing: the two they don't have", () => {
  assert.deepEqual(setMissing(["drft"]), ["shft", "fltr"])
})

const tpl = renderVideoEmailTemplate({ amountOffCents: 1000, codeExpires: "October 31", setEnds: "October 31" })
const fill = (o: Partial<Parameters<typeof fillVideoEmail>[1]>) =>
  fillVideoEmail(tpl, {
    code: null, offerUrl: null, setUrl: null, setOwned: null, setNames: null, ownsNone: false,
    unsubscribeUrl: "https://x/unsub?t=1&u=2", ...o,
  })

test("fillVideoEmail: everyone gets the video, with a play image linking to it", () => {
  const html = fill({ code: "SR10ABCDEF", offerUrl: "https://x/fltr?promo=SR10ABCDEF" })
  assert.match(html, /youtube\.com\/watch\?v=GLvR3ZmPgws/)
  assert.match(html, /email\/fltr-video\.jpg/)
})

test("fillVideoEmail: the code part only, with the pitch for someone who owns nothing", () => {
  const html = fill({ code: "SR10ABCDEF", offerUrl: "https://x/o", ownsNone: true })
  assert.match(html, /SR10ABCDEF/)
  assert.match(html, /all three plugins for \$49/)
  assert.doesNotMatch(html, /any plugin you don't have yet/)
  assert.doesNotMatch(html, /Get both for/)
  assert.match(html, />Your code - until/)
  assert.match(html, /\$10 off<\/span> anything/)
})

test("fillVideoEmail: the set part only, naming what they own and what they'd get", () => {
  const html = fill({ setUrl: "https://x/set?t=a&b=c", setOwned: "drft", setNames: "shft + fltr" })
  assert.ok(html.includes(`You have drft. Get shft + fltr for ${SET}`))
  assert.match(html, /https:\/\/x\/set\?t=a&amp;b=c/)
  assert.doesNotMatch(html, /Use my \$10 code/)
})

test("fillVideoEmail: both parts, the code offered as the alternative", () => {
  const html = fill({ code: "SR10ABCDEF", offerUrl: "https://x/o", setUrl: "https://x/s", setOwned: "shft", setNames: "drft + fltr" })
  assert.ok(html.includes(`Get both for ${SET}`))
  assert.match(html, />Or use your code - until/)
  assert.match(html, /any plugin you don't have yet/)
})

test("fillVideoEmail: no markers or placeholders are left behind", () => {
  for (const html of [fill({}), fill({ code: "C", offerUrl: "o" }), fill({ setUrl: "s", setOwned: "a", setNames: "b" })]) {
    assert.doesNotMatch(html, /<!--\/?[a-z-]+-->/)
    for (const ph of Object.values(PH)) assert.ok(!html.includes(ph), ph)
  }
})

test("fillVideoEmail: a part without its link is left out rather than drawn with a dead button", () => {
  assert.doesNotMatch(fill({ setOwned: "shft", setNames: "drft + fltr" }), /Get both for/)
  assert.doesNotMatch(fill({ code: "SR10ABCDEF" }), /Use my \$10 code/)
})
