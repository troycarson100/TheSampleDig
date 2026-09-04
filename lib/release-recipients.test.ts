import { test } from "node:test"
import assert from "node:assert/strict"
import { RELEASE_RECIPIENT_USER_FILTER } from "./release-recipients"

// Mirrors how Prisma applies a flat equality filter: every key in the filter
// must match the row. Keeps the assertions about WHO gets mailed rather than
// about the shape of an object.
type Flags = { productUpdateOptIn: boolean; emailMarketingOptIn: boolean }
const isRecipient = (user: Flags) =>
  (Object.entries(RELEASE_RECIPIENT_USER_FILTER) as [keyof Flags, boolean][]).every(
    ([key, wanted]) => user[key] === wanted
  )

test("release recipients: owner opted in to both gets the email", () => {
  assert.equal(isRecipient({ productUpdateOptIn: true, emailMarketingOptIn: true }), true)
})

test("release recipients: marketing opt-out is suppressed even with version alerts on", () => {
  assert.equal(isRecipient({ productUpdateOptIn: true, emailMarketingOptIn: false }), false)
})

test("release recipients: version-alerts opt-out is suppressed even with marketing on", () => {
  assert.equal(isRecipient({ productUpdateOptIn: false, emailMarketingOptIn: true }), false)
})
