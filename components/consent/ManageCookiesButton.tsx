"use client"

import { useConsent } from "./ConsentProvider"

/** Clears the stored choice and brings the banner back. */
export default function ManageCookiesButton() {
  const { reopen } = useConsent()
  return (
    <button
      type="button"
      onClick={reopen}
      className="text-sm px-4 py-2 rounded font-medium"
      style={{ background: "var(--primary)", color: "var(--background)" }}
    >
      Manage cookie preferences
    </button>
  )
}
