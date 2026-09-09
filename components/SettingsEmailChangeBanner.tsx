"use client"

import { useSearchParams } from "next/navigation"

/**
 * The outcome of clicking a confirmation link. Rendered whether or not the
 * visitor is signed in: a guest buyer with no password confirms while signed
 * out and still has to be told it worked.
 */
export default function SettingsEmailChangeBanner() {
  const params = useSearchParams()
  const changed = params.get("email-changed")
  const problem = params.get("email-change")

  if (changed) {
    return (
      <div
        className="rounded-lg border px-4 py-3 mb-4 text-sm"
        style={{ borderColor: "rgba(22,163,74,0.3)", background: "rgba(22,163,74,0.08)", color: "#166534" }}
      >
        Done - your account email has been changed. Sign in with your new address from now on.
      </div>
    )
  }

  if (problem === "expired") {
    return (
      <div
        className="rounded-lg border px-4 py-3 mb-4 text-sm"
        style={{ borderColor: "rgba(234,179,8,0.4)", background: "rgba(234,179,8,0.1)", color: "#854d0e" }}
      >
        That confirmation link has expired or has already been used. Request a new one below.
      </div>
    )
  }

  if (problem === "taken") {
    return (
      <div
        className="rounded-lg border px-4 py-3 mb-4 text-sm"
        style={{ borderColor: "rgba(234,179,8,0.4)", background: "rgba(234,179,8,0.1)", color: "#854d0e" }}
      >
        That address was claimed by another account before you confirmed, so nothing changed. Reply
        to your receipt and we&apos;ll sort it out.
      </div>
    )
  }

  return null
}
