import { test } from "node:test"
import assert from "node:assert/strict"
import type { ChartPoint } from "./attribution-chart"
import {
  resolveRange,
  bucketsForRange,
  seriesFor,
  shiftDayKey,
  daySpan,
  zoomRange,
  zoomRangeAt,
  panRange,
  todayKeyIn,
  isDayKey,
  sliceDaily,
  sliceHourly,
  pickPoints,
  withUsableSpan,
  OFFLINE_MIN_SPAN_DAYS,
  MAX_SPAN_DAYS,
  REPORT_TZ,
} from "./attribution-chart"

const HOUR = 60 * 60 * 1000
// 2026-09-08 12:00Z is 2026-09-08 05:00 in Pacific.
const NOW = new Date("2026-09-08T12:00:00Z")
const TODAY = "2026-09-08"

test("todayKeyIn reads the date in the reporting zone, not UTC", () => {
  assert.equal(todayKeyIn(NOW), TODAY)
  // Pacific is 7 hours behind in September, so 06:30Z on the 8th is still
  // 23:30 on the 7th there - while 07:30Z has already ticked over.
  assert.equal(todayKeyIn(new Date("2026-09-08T06:30:00Z")), "2026-09-07")
  assert.equal(todayKeyIn(new Date("2026-09-08T07:30:00Z")), "2026-09-08")
})

test("isDayKey rejects malformed and impossible dates", () => {
  assert.equal(isDayKey("2026-09-08"), true)
  assert.equal(isDayKey("2026-02-31"), false)
  assert.equal(isDayKey("2026-13-01"), false)
  assert.equal(isDayKey("drop-table"), false)
  assert.equal(isDayKey(undefined), false)
})

test("shiftDayKey and daySpan agree across a month boundary", () => {
  assert.equal(shiftDayKey("2026-09-01", -1), "2026-08-31")
  assert.equal(shiftDayKey("2026-08-31", 1), "2026-09-01")
  assert.equal(daySpan("2026-09-08", "2026-09-08"), 1)
  assert.equal(daySpan("2026-09-02", "2026-09-08"), 7)
})

test("resolveRange defaults to the last 30 days", () => {
  const r = resolveRange({}, NOW)
  assert.equal(r.to, TODAY)
  assert.equal(daySpan(r.from, r.to), 30)
  assert.equal(r.granularity, "day")
})

test("resolveRange treats days as a shorthand for the last N days", () => {
  const r = resolveRange({ days: "7" }, NOW)
  assert.equal(r.from, "2026-09-02")
  assert.equal(r.to, TODAY)
})

test("resolveRange prefers an explicit from/to over days", () => {
  const r = resolveRange({ days: "90", from: "2026-08-01", to: "2026-08-10" }, NOW)
  assert.equal(r.from, "2026-08-01")
  assert.equal(r.to, "2026-08-10")
})

test("resolveRange falls back to the default for junk input", () => {
  for (const input of [
    { from: "drop-table", to: "2026-09-01" },
    { from: "2026-09-01", to: "not-a-date" },
    { from: "2026-09-08", to: "2026-09-01" }, // reversed
    { days: "banana" },
  ]) {
    const r = resolveRange(input, NOW)
    assert.equal(daySpan(r.from, r.to), 30, JSON.stringify(input))
  }
})

test("resolveRange never lets a window run past today", () => {
  const r = resolveRange({ from: "2026-09-01", to: "2027-01-01" }, NOW)
  assert.equal(r.to, TODAY)
})

test("resolveRange caps an absurdly wide window", () => {
  const r = resolveRange({ from: "2000-01-01", to: TODAY }, NOW)
  assert.equal(daySpan(r.from, r.to), MAX_SPAN_DAYS)
})

test("a short window switches to hourly buckets", () => {
  assert.equal(resolveRange({ days: "1" }, NOW).granularity, "hour")
  assert.equal(resolveRange({ days: "2" }, NOW).granularity, "hour")
  assert.equal(resolveRange({ days: "3" }, NOW).granularity, "day")
})

test("zoomRange narrows and widens about the centre", () => {
  const inn = zoomRange("2026-08-10", "2026-09-08", 0.5, TODAY)
  assert.equal(daySpan(inn.from, inn.to), 15)
  const out = zoomRange(inn.from, inn.to, 2, TODAY)
  assert.equal(daySpan(out.from, out.to), 30)
})

test("zooming in always moves, even from a single day", () => {
  const r = zoomRange(TODAY, TODAY, 0.5, TODAY)
  assert.equal(daySpan(r.from, r.to), 1)
  const wider = zoomRange(TODAY, TODAY, 2, TODAY)
  assert.ok(daySpan(wider.from, wider.to) > 1)
})

test("zoomRangeAt holds the day under the cursor in place", () => {
  // Zooming at the very left edge keeps the left edge.
  const left = zoomRangeAt("2026-08-01", "2026-08-30", 0.5, 0, "2026-09-08")
  assert.equal(left.from, "2026-08-01")
  assert.equal(daySpan(left.from, left.to), 15)

  // Zooming at the very right edge keeps the right edge.
  const right = zoomRangeAt("2026-08-01", "2026-08-30", 0.5, 1, "2026-09-08")
  assert.equal(right.to, "2026-08-30")
  assert.equal(daySpan(right.from, right.to), 15)
})

test("zoomRangeAt survives a nonsense anchor", () => {
  for (const anchor of [Number.NaN, -5, 12]) {
    const r = zoomRangeAt("2026-08-01", "2026-08-30", 0.5, anchor, "2026-09-08")
    assert.equal(daySpan(r.from, r.to), 15, String(anchor))
  }
})

test("zoomRange stays inside the allowed span and never passes today", () => {
  let r = { from: "2026-09-01", to: TODAY }
  for (let i = 0; i < 20; i++) r = zoomRange(r.from, r.to, 2, TODAY)
  assert.equal(daySpan(r.from, r.to), MAX_SPAN_DAYS)
  assert.equal(r.to, TODAY)
})

test("panRange slides the window without changing its width", () => {
  const start = { from: "2026-08-10", to: "2026-08-19" }
  const back = panRange(start.from, start.to, -0.5, TODAY)
  assert.equal(daySpan(back.from, back.to), 10)
  assert.equal(back.to, "2026-08-14")
})

test("panning forward stops at today and keeps the window width", () => {
  let r = { from: "2026-08-10", to: "2026-08-19" }
  for (let i = 0; i < 10; i++) r = panRange(r.from, r.to, 0.5, TODAY)
  assert.equal(r.to, TODAY)
  assert.equal(daySpan(r.from, r.to), 10)
})

test("a daily window has one bucket per day, oldest first", () => {
  const b = bucketsForRange(resolveRange({ days: "7" }, NOW))
  assert.equal(b.length, 7)
  assert.equal(b[0].key, "2026-09-02")
  assert.equal(b[6].key, TODAY)
  assert.equal(b[6].label, "Sep 8")
})

test("buckets are contiguous - each one ends exactly where the next begins", () => {
  const b = bucketsForRange(resolveRange({ days: "30" }, NOW))
  for (let i = 1; i < b.length; i++) {
    assert.equal(b[i - 1].end.getTime(), b[i].start.getTime())
  }
})

test("a late-evening Pacific timestamp stays on its own Pacific day", () => {
  const b = bucketsForRange(resolveRange({ days: "7" }, NOW))
  // 23:30 on Sep 6 in Pacific is already Sep 7 in UTC. Bucketing the raw
  // instant would file this sale under the wrong day.
  const counts = seriesFor(b, [new Date("2026-09-07T06:30:00Z")])
  const sixth = b.findIndex((x) => x.key === "2026-09-06")
  assert.equal(counts[sixth], 1)
  assert.equal(counts[sixth + 1], 0)
})

test("the day the clocks go back is 25 hours long", () => {
  // US DST ends 2026-11-01.
  const b = bucketsForRange(resolveRange({ from: "2026-10-28", to: "2026-11-02" }, new Date("2026-11-02T12:00:00Z")))
  const day = b.find((x) => x.key === "2026-11-01")
  assert.ok(day)
  assert.equal((day.end.getTime() - day.start.getTime()) / HOUR, 25)
})

test("the day the clocks go forward is 23 hours long", () => {
  // US DST begins 2026-03-08.
  const b = bucketsForRange(resolveRange({ from: "2026-03-04", to: "2026-03-09" }, new Date("2026-03-09T12:00:00Z")))
  const day = b.find((x) => x.key === "2026-03-08")
  assert.ok(day)
  assert.equal((day.end.getTime() - day.start.getTime()) / HOUR, 23)
})

test("a 90-day window spanning a DST change has no duplicate or missing days", () => {
  const b = bucketsForRange(resolveRange({ days: "90" }, new Date("2026-12-01T12:00:00Z")))
  assert.equal(b.length, 90)
  assert.equal(new Set(b.map((x) => x.key)).size, 90)
})

test("an hourly window covers each whole day in one-hour buckets", () => {
  const b = bucketsForRange(resolveRange({ days: "1" }, NOW))
  assert.equal(b.length, 24)
  for (const x of b) assert.equal((x.end.getTime() - x.start.getTime()) / HOUR, 1)
  assert.equal(b[0].key, "2026-09-08T00")
  assert.equal(b[0].label, "12 AM")
  assert.equal(b[23].key, "2026-09-08T23")
})

test("an hourly window across the fall-back day has 25 buckets for it", () => {
  const b = bucketsForRange(
    resolveRange({ from: "2026-11-01", to: "2026-11-01" }, new Date("2026-11-02T12:00:00Z"))
  )
  assert.equal(b.length, 25)
})

test("seriesFor counts each timestamp into exactly one bucket", () => {
  const b = bucketsForRange(resolveRange({ days: "7" }, NOW))
  const counts = seriesFor(b, [
    new Date("2026-09-04T16:00:00Z"),
    new Date("2026-09-04T17:30:00Z"),
    new Date("2026-09-05T06:59:00Z"), // 23:59 Pacific on the 4th
  ])
  const fourth = b.findIndex((x) => x.key === "2026-09-04")
  assert.equal(counts[fourth], 3)
  assert.equal(counts.reduce((a, c) => a + c, 0), 3)
})

test("timestamps outside the window are dropped, not clamped into the end buckets", () => {
  const b = bucketsForRange(resolveRange({ days: "7" }, NOW))
  const counts = seriesFor(b, [new Date("2026-01-01T00:00:00Z"), new Date("2027-01-01T00:00:00Z")])
  assert.equal(counts.reduce((a, c) => a + c, 0), 0)
})

test("seriesFor handles empty input on both sides", () => {
  assert.deepEqual(seriesFor([], [new Date()]), [])
  const b = bucketsForRange(resolveRange({ days: "3" }, NOW))
  assert.deepEqual(seriesFor(b, []), [0, 0, 0])
})

test("an invalid date cannot corrupt the counts", () => {
  const b = bucketsForRange(resolveRange({ days: "3" }, NOW))
  assert.deepEqual(seriesFor(b, [new Date("nonsense")]), [0, 0, 0])
})

test("the reporting timezone is the one the page prints its timestamps in", () => {
  assert.equal(REPORT_TZ, "America/Los_Angeles")
})

// --- client-side windowing over preloaded data ---

const pt = (key: string): ChartPoint => ({ key, label: key, landings: 1, signups: 0, sales: 0 })
const DAILY = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"].map(pt)
const HOURLY = ["2026-09-04T22", "2026-09-04T23", "2026-09-05T00", "2026-09-05T01"].map(pt)

test("sliceDaily returns the inclusive window", () => {
  assert.deepEqual(
    sliceDaily(DAILY, "2026-09-02", "2026-09-04").map((p) => p.key),
    ["2026-09-02", "2026-09-03", "2026-09-04"]
  )
})

test("sliceDaily clamps to what it actually holds", () => {
  assert.equal(sliceDaily(DAILY, "2020-01-01", "2030-01-01").length, 5)
  assert.deepEqual(sliceDaily(DAILY, "2027-01-01", "2027-01-02"), [])
  assert.deepEqual(sliceDaily([], "2026-09-01", "2026-09-02"), [])
})

test("sliceHourly keeps only the hours inside the day range", () => {
  assert.deepEqual(
    sliceHourly(HOURLY, "2026-09-05", "2026-09-05").map((p) => p.key),
    ["2026-09-05T00", "2026-09-05T01"]
  )
  assert.equal(sliceHourly(HOURLY, "2026-09-04", "2026-09-05").length, 4)
})

test("pickPoints uses hourly only for a short window inside the hourly range", () => {
  const hourlyFrom = "2026-09-04"
  assert.equal(pickPoints(DAILY, HOURLY, hourlyFrom, "2026-09-05", "2026-09-05").granularity, "hour")
  // Short, but older than the preloaded hourly data.
  assert.equal(pickPoints(DAILY, HOURLY, hourlyFrom, "2026-09-01", "2026-09-01").granularity, "day")
  // Inside the hourly range but too wide for hourly.
  assert.equal(pickPoints(DAILY, HOURLY, hourlyFrom, "2026-09-01", "2026-09-05").granularity, "day")
})

test("withUsableSpan allows a single day inside the hourly range", () => {
  const r = withUsableSpan("2026-09-05", "2026-09-05", "2026-09-04", "2026-09-08")
  assert.equal(daySpan(r.from, r.to), 1)
})

test("withUsableSpan widens a too-narrow window outside the hourly range", () => {
  const r = withUsableSpan("2026-08-01", "2026-08-01", "2026-09-04", "2026-09-08")
  assert.equal(daySpan(r.from, r.to), OFFLINE_MIN_SPAN_DAYS)
})

test("withUsableSpan never widens past today", () => {
  const r = withUsableSpan("2026-09-08", "2026-09-08", "2026-09-30", "2026-09-08")
  assert.equal(r.to, "2026-09-08")
  assert.equal(daySpan(r.from, r.to), OFFLINE_MIN_SPAN_DAYS)
})
