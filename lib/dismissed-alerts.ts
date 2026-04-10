/** localStorage key for alert ids the user dismissed (client-only). */
export const DISMISSED_ALERT_IDS_KEY = "sampleRollDismissedAlertIds"

export function readDismissedAlertIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(DISMISSED_ALERT_IDS_KEY)
    if (!raw) return []
    const p = JSON.parse(raw) as unknown
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

export function dismissAlertId(id: string): void {
  if (typeof window === "undefined") return
  const next = [...new Set([...readDismissedAlertIds(), id])]
  localStorage.setItem(DISMISSED_ALERT_IDS_KEY, JSON.stringify(next))
}

/** Fired from mobile nav so the bell popover can open without shared React state. */
export const OPEN_ALERTS_EVENT = "sampleRollOpenAlerts"
