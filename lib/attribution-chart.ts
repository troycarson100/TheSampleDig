/**
 * Time bucketing and window maths for the admin attribution chart.
 *
 * Pure: no Prisma, no next/headers, no clock reads. The caller passes `now`,
 * so `tsx --test` can load this and pin the calendar.
 *
 * Everything is bucketed in the reporting timezone, not UTC. The attribution
 * page prints its timestamps in Pacific, so a 6pm PT sale has to land in the
 * same bucket as the row the sales table shows for it - bucketing the instant
 * in UTC would push it into tomorrow.
 *
 * The visible window is carried in the URL as `from` and `to` day keys. Day
 * keys are plain YYYY-MM-DD strings and all the zoom/pan arithmetic on them is
 * done in UTC, where every day is exactly 24 hours. Only the final conversion
 * to a real instant consults the timezone, which is what keeps a DST day from
 * duplicating or skipping a date.
 */

export const REPORT_TZ = "America/Los_Angeles"

export const MIN_SPAN_DAYS = 1
export const MAX_SPAN_DAYS = 365
export const DEFAULT_SPAN_DAYS = 30
/** At or below this span the chart switches to hourly buckets. */
export const HOURLY_MAX_SPAN_DAYS = 2

/**
 * How much history the page ships to the browser up front, so zooming and
 * panning are pure client-side windowing rather than a round trip each time.
 * A year of daily counts is a few hundred numbers.
 */
export const CHART_HISTORY_DAYS = 365
/**
 * Hourly counts are only preloaded for the recent past - a year of them would
 * be 8,760 buckets. Zooming below the daily threshold outside this stops at
 * `OFFLINE_MIN_SPAN_DAYS` instead, since there is no hourly data to show.
 */
export const HOURLY_HISTORY_DAYS = 7
export const OFFLINE_MIN_SPAN_DAYS = 3

export type Granularity = "hour" | "day"

export type Bucket = {
  /** Stable identifier used in the ?bucket= query param. */
  key: string
  /** Short human label for the axis and tooltip, e.g. "Sep 6" or "2 PM". */
  label: string
  start: Date
  /** Exclusive. A bucket covers [start, end). */
  end: Date
}

/** What the client chart needs: no Date objects cross the boundary. */
export type ChartPoint = {
  key: string
  label: string
  landings: number
  signups: number
  sales: number
}

export type ResolvedRange = {
  /** Inclusive first day of the window, YYYY-MM-DD. */
  from: string
  /** Inclusive last day of the window, YYYY-MM-DD. */
  to: string
  granularity: Granularity
}

type Parts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** Wall-clock fields of an instant, as read in the given zone. */
function zonedParts(date: Date, timeZone: string): Parts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    // h23 rather than hour12:false - the latter reports midnight as "24" in
    // some engines, which would silently shift a bucket by a day.
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const p: Record<string, string> = {}
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  }
}

/** How far the zone sits from UTC at this instant, in milliseconds. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // The parts carry no milliseconds, so compare against a whole second.
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * The instant at which the given wall-clock time occurs in the zone.
 *
 * Two passes: the offset is looked up at a first guess, then re-checked at the
 * instant that guess produces. They differ only when the guess straddles a DST
 * transition, which is exactly when a single pass would be an hour out.
 */
function instantFromZoned(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string
): Date {
  const guess = Date.UTC(year, month - 1, day, hour)
  const first = zoneOffsetMs(new Date(guess), timeZone)
  const t = guess - first
  const second = zoneOffsetMs(new Date(t), timeZone)
  return new Date(second === first ? t : guess - second)
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Parse a YYYY-MM-DD day key, rejecting anything that is not a real date. */
function keyToUtc(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const d = new Date(Date.UTC(year, month - 1, day))
  // Rejects 2026-02-31 and friends, which Date.UTC would happily roll over.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
    return null
  }
  return d
}

function utcToKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function isDayKey(key: string | undefined | null): boolean {
  return !!key && keyToUtc(key) !== null
}

/** Today's date in the reporting zone, as a day key. */
export function todayKeyIn(now: Date, timeZone: string = REPORT_TZ): string {
  const p = zonedParts(now, timeZone)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** Move a day key by whole days. Calendar-safe: UTC days are always 24h. */
export function shiftDayKey(key: string, deltaDays: number): string {
  const base = keyToUtc(key)
  if (!base) return key
  return utcToKey(new Date(base.getTime() + deltaDays * 86400000))
}

/** Inclusive number of days from `from` to `to`. Same day is 1. */
export function daySpan(from: string, to: string): number {
  const a = keyToUtc(from)
  const b = keyToUtc(to)
  if (!a || !b) return 1
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

function clampRange(from: string, to: string, todayKey: string): { from: string; to: string } {
  // The future holds no data, so a window is never allowed to run past today.
  const hi = daySpan(to, todayKey) >= 1 ? to : todayKey
  let lo = daySpan(from, hi) >= 1 ? from : hi
  const span = daySpan(lo, hi)
  if (span > MAX_SPAN_DAYS) lo = shiftDayKey(hi, -(MAX_SPAN_DAYS - 1))
  if (span < MIN_SPAN_DAYS) lo = hi
  return { from: lo, to: hi }
}

/**
 * The window to render, from whatever the query string offered.
 *
 * `from`/`to` win when both are real dates in order; otherwise `days` is a
 * shorthand for "the last N days"; otherwise the default window. Anything
 * unparseable falls through to the default rather than erroring, because this
 * value comes straight from a URL somebody may have typed.
 */
export function resolveRange(
  input: { days?: string; from?: string; to?: string },
  now: Date,
  timeZone: string = REPORT_TZ
): ResolvedRange {
  const todayKey = todayKeyIn(now, timeZone)

  let from: string | null = null
  let to: string | null = null
  if (isDayKey(input.from) && isDayKey(input.to) && daySpan(input.from!, input.to!) >= 1) {
    from = input.from!
    to = input.to!
  }

  if (!from || !to) {
    const parsed = Number(input.days)
    const days = Number.isFinite(parsed)
      ? Math.min(MAX_SPAN_DAYS, Math.max(MIN_SPAN_DAYS, Math.floor(parsed)))
      : DEFAULT_SPAN_DAYS
    to = todayKey
    from = shiftDayKey(todayKey, -(days - 1))
  }

  const clamped = clampRange(from, to, todayKey)
  const span = daySpan(clamped.from, clamped.to)
  return {
    ...clamped,
    granularity: span <= HOURLY_MAX_SPAN_DAYS ? "hour" : "day",
  }
}

/**
 * Widen (factor > 1) or narrow (factor < 1) the window, holding the day at
 * `anchor` - a 0..1 position across the window - in place. Pinch-zooming
 * passes the cursor's position so the day under the fingers stays under them;
 * the buttons pass 0.5 and zoom about the centre.
 *
 * Clamped to the allowed span and never allowed to run past today.
 */
export function zoomRangeAt(
  from: string,
  to: string,
  factor: number,
  anchor: number,
  todayKey: string
): { from: string; to: string } {
  const span = daySpan(from, to)
  const wanted = Math.round(span * factor)
  const next = Math.min(MAX_SPAN_DAYS, Math.max(MIN_SPAN_DAYS, wanted))
  // Round away from the current span so a zoom always moves; at span 1 a
  // factor of 0.5 would otherwise round back to 1 and appear to do nothing.
  const stepped = next === span ? (factor < 1 ? span - 1 : span + 1) : next
  const finalSpan = Math.min(MAX_SPAN_DAYS, Math.max(MIN_SPAN_DAYS, stepped))
  const a = Number.isFinite(anchor) ? Math.min(1, Math.max(0, anchor)) : 0.5
  const nextFrom = shiftDayKey(from, Math.floor(a * span) - Math.floor(a * finalSpan))
  const nextTo = shiftDayKey(nextFrom, finalSpan - 1)
  // Widening a window that already ends near today would otherwise be trimmed
  // by the clamp and quietly lose a day each time, so it can never reach the
  // cap. Slide it back instead, keeping the width that was asked for.
  const endsAt = daySpan(nextTo, todayKey) >= 1 ? nextTo : todayKey
  return clampRange(shiftDayKey(endsAt, -(finalSpan - 1)), endsAt, todayKey)
}

/** Zoom about the middle of the window. */
export function zoomRange(
  from: string,
  to: string,
  factor: number,
  todayKey: string
): { from: string; to: string } {
  return zoomRangeAt(from, to, factor, 0.5, todayKey)
}

/**
 * Slide the window without changing its width. `fraction` is a share of the
 * current span: -0.5 moves half a window into the past.
 */
export function panRange(
  from: string,
  to: string,
  fraction: number,
  todayKey: string
): { from: string; to: string } {
  const span = daySpan(from, to)
  const step = Math.max(1, Math.round(Math.abs(span * fraction))) * Math.sign(fraction)
  const nextTo = shiftDayKey(to, step)
  // Panning must not silently resize the window when it hits today, so the
  // width is re-derived from the clamped end rather than from `from`.
  const clampedTo = daySpan(nextTo, todayKey) >= 1 ? nextTo : todayKey
  return clampRange(shiftDayKey(clampedTo, -(span - 1)), clampedTo, todayKey)
}

function dayLabel(start: Date, timeZone: string): string {
  return start.toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric" })
}

function hourLabel(start: Date, timeZone: string): string {
  return start.toLocaleTimeString("en-US", { timeZone, hour: "numeric", hour12: true })
}

const HOUR_MS = 60 * 60 * 1000

/**
 * The buckets covering a resolved window, oldest first.
 *
 * This list is the single source of truth for the chart: the drill-down looks
 * a bucket up by key rather than parsing the query param into a date, so an
 * unrecognised param can only ever mean "no bucket selected".
 */
export function bucketsForRange(range: ResolvedRange, timeZone: string = REPORT_TZ): Bucket[] {
  const first = keyToUtc(range.from)
  const last = keyToUtc(range.to)
  if (!first || !last) return []

  const dayStarts: { key: string; start: Date; end: Date }[] = []
  for (let d = new Date(first); d.getTime() <= last.getTime(); d = new Date(d.getTime() + 86400000)) {
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    const nextCal = new Date(d.getTime() + 86400000)
    dayStarts.push({
      key: utcToKey(d),
      start: instantFromZoned(y, m, day, 0, timeZone),
      end: instantFromZoned(
        nextCal.getUTCFullYear(),
        nextCal.getUTCMonth() + 1,
        nextCal.getUTCDate(),
        0,
        timeZone
      ),
    })
  }

  if (range.granularity === "day") {
    return dayStarts.map((d) => ({
      key: d.key,
      label: dayLabel(d.start, timeZone),
      start: d.start,
      end: d.end,
    }))
  }

  // Hourly: walk the real span in absolute hour steps, so a DST day yields 23
  // or 25 buckets rather than a duplicated or missing hour.
  const buckets: Bucket[] = []
  const spanStart = dayStarts[0].start
  const spanEnd = dayStarts[dayStarts.length - 1].end
  for (let t = spanStart.getTime(); t < spanEnd.getTime(); t += HOUR_MS) {
    const start = new Date(t)
    const p = zonedParts(start, timeZone)
    buckets.push({
      key: `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}`,
      label: hourLabel(start, timeZone),
      start,
      end: new Date(t + HOUR_MS),
    })
  }
  return buckets
}

/**
 * Count timestamps into buckets, returning one number per bucket.
 *
 * Buckets are contiguous and sorted, so this binary-searches the boundaries.
 * Anything outside the covered span is dropped rather than clamped into the
 * end buckets, which would invent a spike that never happened.
 */
export function seriesFor(buckets: Bucket[], dates: Date[]): number[] {
  const counts = new Array(buckets.length).fill(0)
  if (buckets.length === 0) return counts

  const spanStart = buckets[0].start.getTime()
  const spanEnd = buckets[buckets.length - 1].end.getTime()

  for (const date of dates) {
    const t = date.getTime()
    if (!Number.isFinite(t) || t < spanStart || t >= spanEnd) continue
    let lo = 0
    let hi = buckets.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (buckets[mid].start.getTime() <= t) lo = mid
      else hi = mid - 1
    }
    // Gaps are impossible for contiguous buckets, but a caller could pass a
    // hand-built list, so confirm the hit rather than trusting the search.
    if (t < buckets[lo].end.getTime()) counts[lo] += 1
  }
  return counts
}

/** The slice of preloaded daily points covering [from, to]. */
export function sliceDaily(points: ChartPoint[], from: string, to: string): ChartPoint[] {
  if (points.length === 0) return []
  const base = points[0].key
  const start = Math.max(0, daySpan(base, from) - 1)
  const end = Math.min(points.length - 1, daySpan(base, to) - 1)
  if (end < start) return []
  return points.slice(start, end + 1)
}

/**
 * The slice of preloaded hourly points whose day falls in [from, to].
 * Hourly keys are YYYY-MM-DDTHH, so the day part compares lexicographically.
 */
export function sliceHourly(points: ChartPoint[], from: string, to: string): ChartPoint[] {
  return points.filter((p) => {
    const day = p.key.slice(0, 10)
    return day >= from && day <= to
  })
}

/**
 * Widen a window that has been zoomed below what the preloaded data can show.
 * Inside the hourly window a single day is fine; outside it, a one-day slice
 * of daily buckets would be a single point, so it stops short of that.
 */
export function withUsableSpan(
  from: string,
  to: string,
  hourlyFrom: string,
  todayKey: string
): { from: string; to: string } {
  const min = from >= hourlyFrom ? MIN_SPAN_DAYS : OFFLINE_MIN_SPAN_DAYS
  if (daySpan(from, to) >= min) return clampRange(from, to, todayKey)
  const wantedTo = shiftDayKey(from, min - 1)
  const endsAt = daySpan(wantedTo, todayKey) >= 1 ? wantedTo : todayKey
  return clampRange(shiftDayKey(endsAt, -(min - 1)), endsAt, todayKey)
}

/**
 * Which preloaded series to draw for a window, and at what granularity.
 * Hourly only when the window is short *and* inside the preloaded hourly
 * range; otherwise daily.
 */
export function pickPoints(
  daily: ChartPoint[],
  hourly: ChartPoint[],
  hourlyFrom: string,
  from: string,
  to: string
): { points: ChartPoint[]; granularity: Granularity } {
  if (daySpan(from, to) <= HOURLY_MAX_SPAN_DAYS && from >= hourlyFrom) {
    return { points: sliceHourly(hourly, from, to), granularity: "hour" }
  }
  return { points: sliceDaily(daily, from, to), granularity: "day" }
}
