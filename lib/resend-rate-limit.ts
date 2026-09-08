/**
 * Sliding-window hit counter keyed by an arbitrary string (an email, an IP).
 *
 * In-memory and per-instance on purpose: the resend endpoint is cheap to
 * serve and low-value to abuse, so best-effort limiting is enough and a
 * shared store would be more machinery than the problem deserves. A refused
 * hit is not recorded, so hammering does not push the window out.
 *
 * Memory is bounded: once the map holds `sweepAt` keys, the next call drops
 * every key whose hits have all aged out of the window, so the map can only
 * grow past `sweepAt` by the number of keys genuinely active in one window.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly sweepAt: number = 1000,
  ) {}

  /** Number of keys currently held. Exposed for tests. */
  get size(): number {
    return this.hits.size
  }

  /** Records a hit and reports whether it was within the limit. */
  allow(key: string): boolean {
    const t = this.now()
    if (this.hits.size >= this.sweepAt) this.sweep(t)
    const recent = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs)
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(t)
    this.hits.set(key, recent)
    return true
  }

  private sweep(t: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((h) => t - h >= this.windowMs)) this.hits.delete(key)
    }
  }
}
