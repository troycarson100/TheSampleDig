import {
  normalizeAffiliateCode,
  computeCommissionCents,
  attributionCandidates,
  isSelfReferral,
  canInstantPayout,
} from "../lib/affiliate-logic"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ok  ${name}`)
  } else {
    failures++
    console.error(`FAIL  ${name}\n      expected ${e}\n      got      ${a}`)
  }
}

// normalizeAffiliateCode: lowercase, strip whitespace, [a-z0-9-] 2-32 chars
check("normalize basic", normalizeAffiliateCode("SynthDad"), "synthdad")
check("normalize trims + inner spaces", normalizeAffiliateCode("  SYNTH DAD  "), "synthdad")
check("normalize keeps hyphens/digits", normalizeAffiliateCode("beat-lab-99"), "beat-lab-99")
check("normalize rejects symbols", normalizeAffiliateCode("synth_dad!"), null)
check("normalize rejects too short", normalizeAffiliateCode("x"), null)
check("normalize rejects 33 chars", normalizeAffiliateCode("a".repeat(33)), null)
check("normalize rejects null", normalizeAffiliateCode(null), null)
check("normalize rejects empty", normalizeAffiliateCode("   "), null)

// computeCommissionCents: round half up on the cent
check("commission 30% of $39", computeCommissionCents(3900, 30), 1170)
check("commission 30% of $19", computeCommissionCents(1900, 30), 570)
check("commission rounds", computeCommissionCents(3333, 30), 1000) // 999.9 -> 1000
check("commission 0 amount", computeCommissionCents(0, 30), 0)
check("commission clamps negative", computeCommissionCents(-500, 30), 0)

// attributionCandidates: typed code first, cookie second, invalid dropped, dupes collapsed
check(
  "candidates typed beats cookie",
  attributionCandidates({ typedCode: "SynthDad", cookieCode: "beatlab" }),
  [{ code: "synthdad", source: "code" }, { code: "beatlab", source: "link" }]
)
check(
  "candidates invalid typed falls back",
  attributionCandidates({ typedCode: "!!", cookieCode: "beatlab" }),
  [{ code: "beatlab", source: "link" }]
)
check(
  "candidates same code collapses to typed",
  attributionCandidates({ typedCode: "beatlab", cookieCode: "BeatLab" }),
  [{ code: "beatlab", source: "code" }]
)
check("candidates none", attributionCandidates({ typedCode: null, cookieCode: undefined }), [])

// isSelfReferral: email match (case-insensitive) or userId match
const aff = { affiliateEmail: "Creator@Example.com", affiliateUserId: "u_1" }
check("self by email", isSelfReferral({ ...aff, buyerEmail: "creator@example.com", buyerUserId: "u_9" }), true)
check("self by userId", isSelfReferral({ ...aff, buyerEmail: "other@x.com", buyerUserId: "u_1" }), true)
check("not self", isSelfReferral({ ...aff, buyerEmail: "other@x.com", buyerUserId: "u_9" }), false)
check("null buyer fields", isSelfReferral({ ...aff, buyerEmail: null, buyerUserId: null }), false)
check(
  "no affiliate userId",
  isSelfReferral({ affiliateEmail: "a@b.c", affiliateUserId: null, buyerEmail: null, buyerUserId: "u_1" }),
  false
)

// canInstantPayout: all conditions must hold; each disqualifier alone blocks
const payable = {
  refundedAt: null,
  stripeTransferId: null,
  payoutId: null,
  stripeAccountId: "acct_1",
  stripePayoutsEnabled: true,
}
check("instant payout allowed", canInstantPayout(payable), true)
check("instant blocked: refunded", canInstantPayout({ ...payable, refundedAt: new Date(0) }), false)
check("instant blocked: already transferred", canInstantPayout({ ...payable, stripeTransferId: "tr_1" }), false)
check("instant blocked: already paid manually", canInstantPayout({ ...payable, payoutId: "po_1" }), false)
check("instant blocked: no account", canInstantPayout({ ...payable, stripeAccountId: null }), false)
check("instant blocked: payouts disabled", canInstantPayout({ ...payable, stripePayoutsEnabled: false }), false)

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log("\nAll affiliate-logic tests passed")
