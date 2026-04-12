/** Linear mix between two #RRGGBB colors (no alpha). */

export function mixHex(hexA: string, hexB: string, t: number): string {
  const c = (hex: string) => {
    const h = hex.replace("#", "")
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    }
  }
  const a = c(hexA)
  const b = c(hexB)
  const u = Math.max(0, Math.min(1, t))
  const r = Math.round(a.r + (b.r - a.r) * u)
  const g = Math.round(a.g + (b.g - a.g) * u)
  const bl = Math.round(a.b + (b.b - a.b) * u)
  const to = (n: number) => n.toString(16).padStart(2, "0")
  return `#${to(r)}${to(g)}${to(bl)}`
}
