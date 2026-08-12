"use client"

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react"
import {
  readConsent,
  writeConsent,
  clearConsent,
  readCachedRegion,
  type ConsentRegion,
  type ConsentState,
} from "@/lib/consent"
import { ensureLandingPing } from "@/lib/landing-ping"

/**
 * Consent and region are external state — a cookie and a sessionStorage entry —
 * so they're modelled as an external store rather than mirrored into React with
 * setState-in-an-effect, which React 19 flags as a cascading-render hazard.
 *
 * Both snapshots are memoized in module scope so getSnapshot stays cheap and
 * returns a referentially stable value across renders.
 */

const listeners = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function emit(): void {
  for (const l of listeners) l()
}

let consentCache: ConsentState | undefined
let regionCache: ConsentRegion | null | undefined

function getConsent(): ConsentState {
  if (consentCache === undefined) consentCache = readConsent()
  return consentCache
}

function getRegion(): ConsentRegion | null {
  if (regionCache === undefined) regionCache = readCachedRegion()
  return regionCache
}

/** Server render and first hydration pass: nothing decided, nothing loaded. */
function getConsentServer(): ConsentState {
  return "unset"
}
function getRegionServer(): ConsentRegion | null {
  return null
}

function setConsentStore(state: "granted" | "denied" | null): void {
  if (state === null) {
    clearConsent()
  } else {
    writeConsent(state)
  }
  consentCache = undefined
  emit()
}

function setRegionStore(r: ConsentRegion): void {
  regionCache = r
  emit()
}

type ConsentContextValue = {
  consent: ConsentState
  region: ConsentRegion | null
  pixelAllowed: boolean
  showBanner: boolean
  accept: () => void
  reject: () => void
  reopen: () => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) throw new Error("useConsent must be used inside ConsentProvider")
  return ctx
}

export default function ConsentProvider({ children }: { children: React.ReactNode }) {
  const consent = useSyncExternalStore(subscribe, getConsent, getConsentServer)
  const region = useSyncExternalStore(subscribe, getRegion, getRegionServer)

  useEffect(() => {
    if (consent !== "unset") return // decided already; region is irrelevant
    if (getRegion()) return // cached from an earlier navigation in this tab

    let active = true
    ensureLandingPing()
      .then((r) => {
        if (active) setRegionStore(r)
      })
      .catch(() => {
        if (active) setRegionStore("strict")
      })
    return () => {
      active = false
    }
  }, [consent])

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      region,
      // Undecided visitors get the pixel only in a notice region. Region null
      // means "still resolving" — withhold until we know.
      pixelAllowed: consent === "granted" || (consent === "unset" && region === "notice"),
      showBanner: consent === "unset" && region !== null,
      accept: () => setConsentStore("granted"),
      reject: () => setConsentStore("denied"),
      reopen: () => setConsentStore(null),
    }),
    [consent, region]
  )

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}
