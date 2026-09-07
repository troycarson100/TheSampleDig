/**
 * Sliding-window hit counter keyed by an arbitrary string (an email, an IP).
 *
 * In-memory and per-instance on purpose: the resend endpoint is cheap to
 * serve and low-value to abuse, so best-effort limiting is enough and a
 * shared store would be more machinery than the problem deserves. A refused
 * hit is not recorded, so hammering does not push the window out.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit and reports whether it was within the limit. */
  allow(key: string): boolean {
    const t = this.now()
    const recent = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs)
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(t)
    this.hits.set(key, recent)
    return true
  }
}
