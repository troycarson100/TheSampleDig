"use client"

import { useState } from "react"

// A confirm button rather than an unsubscribe-on-load page: mail clients and
// corporate link scanners prefetch every URL in a message, and an on-load
// unsubscribe would quietly opt people out who never clicked.
export default function UnsubscribeConfirm({ token, email }: { token: string; email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")

  async function confirm() {
    setState("sending")
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      setState(res.ok ? "done" : "error")
    } catch {
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-2">You&apos;re unsubscribed</h1>
        <p className="text-sm opacity-70 mb-6">
          {email} won&apos;t get any more update emails. You&apos;ll still get receipts, licence keys
          and password resets - those aren&apos;t marketing and can&apos;t be turned off.
        </p>
        <p className="text-sm opacity-70">
          Changed your mind? Turn &quot;New version alerts&quot; back on any time in{" "}
          <a href="/settings" className="underline">
            Settings
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Unsubscribe from update emails?</h1>
      <p className="text-sm opacity-70 mb-6">
        {email} will stop hearing when a new version of your plugins ships. Receipts, licence keys
        and password resets are unaffected.
      </p>
      <button
        onClick={confirm}
        disabled={state === "sending"}
        className="px-6 py-3 rounded-lg bg-black text-white font-medium disabled:opacity-50"
      >
        {state === "sending" ? "Unsubscribing..." : "Unsubscribe"}
      </button>
      {state === "error" && (
        <p className="text-sm text-red-500 mt-4">
          That didn&apos;t work. Reply to any of our emails and we&apos;ll take you off by hand.
        </p>
      )}
    </div>
  )
}
