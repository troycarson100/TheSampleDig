import { test } from "node:test"
import assert from "node:assert/strict"
import { bundleParts, bundleSubject, bundleVariant, setPrices } from "./bundle-email-logic"
import { BPH, fillBundleEmail, renderBundleEmailTemplate, type BundleFill } from "./bundle-email-html"
import { COMPLETE_SET_PRICE } from "./complete-set-logic"
import { PRICING } from "./products"

const who = { emailMarketingOptIn: true, productUpdateOptIn: true, owns: [] as string[], code: "SR10ABCDEF", codeRedeemed: false }

test("bundleParts: owns nothing - the bundle, and the code if unused", () => {
  assert.deepEqual(bundleParts(who), { offer: "bundle", code: true, missing: ["fltr", "shft", "drft"] })
  assert.equal((bundleParts({ ...who, codeRedeemed: true }) as { code: boolean }).code, false)
  assert.equal((bundleParts({ ...who, code: null }) as { code: boolean }).code, false)
})

test("bundleParts: owns one or two - the rest of the set", () => {
  assert.deepEqual(bundleParts({ ...who, owns: ["drft"] }), { offer: "set", code: true, missing: ["fltr", "shft"] })
  assert.deepEqual(bundleParts({ ...who, owns: ["shft", "fltr"], code: null }), { offer: "set", code: false, missing: ["drft"] })
})

test("bundleParts: owns all three, or unsubscribed - not sent", () => {
  assert.equal(bundleParts({ ...who, owns: ["shft", "drft", "fltr"] }), "owns-everything")
  assert.equal(bundleParts({ ...who, productUpdateOptIn: false }), "opted-out")
})

test("setPrices: the complete-set price against the usual one", () => {
  assert.deepEqual(setPrices(["drft", "fltr"]), { price: COMPLETE_SET_PRICE[2], was: PRICING.drft.price + PRICING.fltr.price })
  assert.deepEqual(setPrices(["fltr"]), { price: COMPLETE_SET_PRICE[1], was: PRICING.fltr.price })
})

test("bundleSubject and bundleVariant follow the offer", () => {
  assert.ok(bundleSubject({ offer: "bundle", code: false, missing: ["shft", "drft", "fltr"] }).includes(`$${PRICING.bundle.price}`))
  assert.ok(bundleSubject({ offer: "set", code: false, missing: ["fltr"] }).includes(`fltr for $${COMPLETE_SET_PRICE[1]}`))
  assert.equal(bundleVariant({ offer: "set", code: true, missing: ["fltr"] }), "set+code")
})

const tpl = renderBundleEmailTemplate({ amountOffCents: 1000, codeExpires: "October 31", setEnds: "October 31" })
const TWO = COMPLETE_SET_PRICE[2]
const ONE = COMPLETE_SET_PRICE[1]
const fill = (o: Partial<BundleFill>) =>
  fillBundleEmail(tpl, {
    offer: "bundle", owns: [], missing: ["shft", "drft", "fltr"], code: null, offerUrl: null, setUrl: null,
    setPrice: null, setWas: null, unsubscribeUrl: "https://x/u?a=1&b=2", ...o,
  })

test("fill: fltr leads - in the heading and in the plugin sections", () => {
  const html = fill({})
  assert.ok(html.includes("fltr + shft + drft"))
  assert.ok(html.indexOf("Get fltr &middot;") < html.indexOf("Get shft &middot;") && html.indexOf("Get shft &middot;") < html.indexOf("Get drft &middot;"))
})

test("fill: owns nothing - the bundle at its price, every plugin with its price, no set", () => {
  const html = fill({})
  assert.ok(html.includes(`$${PRICING.bundle.price}`) && html.includes(`Save $${PRICING.bundle.compareAt - PRICING.bundle.price}`))
  assert.ok(html.includes("Get all three"))
  assert.doesNotMatch(html, /Complete your set/)
  assert.doesNotMatch(html, /In your collection/)
  for (const n of ["shft", "drft", "fltr"]) assert.ok(html.includes(`Get ${n} &middot; $29`), n)
})

test("fill: owns nothing with a code - the code, and the bundle at the code's price", () => {
  const html = fill({ code: "SR10ABCDEF", offerUrl: "https://x/fltr?promo=SR10ABCDEF" })
  assert.ok(html.includes("SR10ABCDEF"))
  assert.ok(html.includes(`it's <strong>$${PRICING.bundle.price - 10}</strong>`))
  assert.match(html, /\$10 off<\/span> anything/)
  assert.ok(html.includes("/shft?promo=SR10ABCDEF"), "plugin links carry the code")
})

test("fill: owns one - the set at its price, the owned plugin marked, the others priced", () => {
  const html = fill({ offer: "set", owns: ["shft"], missing: ["drft", "fltr"], setUrl: "https://x/set?t=a&b=c", setPrice: TWO, setWas: 58 })
  assert.ok(html.includes("You have shft. Add") && html.includes("fltr + drft") && html.includes(`$${TWO}`) && html.includes("$58"))
  assert.ok(html.includes("https://x/set?t=a&amp;b=c"))
  assert.ok(html.includes(`Get both for $${TWO}`))
  assert.equal((html.match(/In your collection/g) ?? []).length, 1)
  assert.doesNotMatch(html, /Get shft &middot;/)
  assert.doesNotMatch(html, /Get all three/)
})

test("fill: owns two - the last one, said as one", () => {
  const html = fill({ offer: "set", owns: ["shft", "drft"], missing: ["fltr"], setUrl: "https://x/s", setPrice: ONE, setWas: 29 })
  assert.ok(html.includes(`Get it for $${ONE}`))
  assert.equal((html.match(/In your collection/g) ?? []).length, 2)
})

test("fill: no set link, no set part - and never a dead button", () => {
  const html = fill({ offer: "set", owns: ["shft"], missing: ["drft", "fltr"], setUrl: null, setPrice: 39, setWas: 58 })
  assert.doesNotMatch(html, /Complete your set/)
  assert.doesNotMatch(fill({ code: "SR10ABCDEF" }), /Use my \$10 code/)
})

test("fill: no marker or placeholder is left in any version", () => {
  const versions = [
    fill({}),
    fill({ code: "C", offerUrl: "o" }),
    fill({ offer: "set", owns: ["drft"], missing: ["shft", "fltr"], setUrl: "s", setPrice: 39, setWas: 58, code: "C", offerUrl: "o" }),
    fill({ offer: "none", owns: ["drft"], missing: ["shft", "fltr"] }),
  ]
  for (const html of versions) {
    assert.doesNotMatch(html, /<!--\/?[a-z-]+-->/)
    for (const ph of Object.values(BPH)) assert.ok(!html.includes(ph), ph)
  }
})
