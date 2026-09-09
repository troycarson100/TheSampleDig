"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import EmailChangeForm from "./EmailChangeForm"

export default function SettingsEmailChange() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)

  if (status === "loading") {
    return (
      <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </p>
      </div>
    )
  }

  if (status !== "authenticated" || !session?.user?.email) {
    return (
      <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm mb-2" style={{ color: "var(--muted)" }}>
          Sign in to change the email on your account.
        </p>
        <Link
          href="/login?callbackUrl=/settings"
          className="text-sm font-medium underline"
          style={{ color: "var(--foreground)" }}
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--foreground)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
          >
            Change email for account
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
            Currently {session.user.email}. Your purchases, licence keys and downloads move with
            the account - we&apos;ll email the new address to confirm it first.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 text-sm font-medium underline cursor-pointer"
            style={{ color: "var(--foreground)", background: "none", border: "none" }}
          >
            Change
          </button>
        )}
      </div>
      {open && <EmailChangeForm currentEmail={session.user.email} />}
    </div>
  )
}
