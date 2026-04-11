"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useGoProModal } from "@/components/GoProModalContext"

export type GateType = "signup" | "pro"

export interface FeatureGateModalProps {
  open: boolean
  type: GateType
  featureName?: string
  onClose: () => void
}

const PRO_FEATURES = [
  "Drum Break filter",
  "Loop, Quantize & Save Chop Loops",
  "Sample Notes",
  "History (up to 1,000 tracks)",
  "Playlists",
  "No ads*",
]

const FREE_FEATURES = [
  "Save samples to your crate",
  "Roll dice & discover tracks",
  "Genre & era filters",
  "Chop Mode",
]

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function FeatureGateModal({ open, type, featureName, onClose }: FeatureGateModalProps) {
  const [mounted, setMounted] = useState(false)
  const { openProModal } = useGoProModal()
  useEffect(() => setMounted(true), [])

  if (!open) return null

  const isSignup = type === "signup"

  const title = isSignup
    ? "Create a free account"
    : `Unlock ${featureName ?? "this feature"}`

  const subtitle = isSignup
    ? "Sign up free to save your discoveries and build your crate."
    : "This is a Sample Roll Pro feature. Upgrade to unlock:"

  const features = isSignup ? FREE_FEATURES : PRO_FEATURES

  const overlay = (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-modal-title"
    >
      <div
        className="theme-vinyl relative w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto"
        style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--muted-light)", color: "var(--rust)" }}
              >
                <LockIcon />
              </div>
              <div>
                <h2
                  id="gate-modal-title"
                  className="font-semibold leading-tight"
                  style={{ fontFamily: "var(--font-halant), Georgia, serif", fontSize: "17px" }}
                >
                  {title}
                </h2>
                <p
                  className="text-sm mt-0.5 leading-snug"
                  style={{ color: "var(--muted)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                >
                  {subtitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition hover:opacity-70"
              style={{ background: "var(--muted-light)" }}
              aria-label="Close"
            >
              <svg className="w-4 h-4" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Feature list */}
          <ul className="flex flex-col gap-2">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                <span
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(184, 92, 56, 0.12)", color: "var(--rust)" }}
                >
                  <CheckIcon />
                </span>
                {f}
              </li>
            ))}
          </ul>

          {!isSignup && (
            <p
              className="text-xs leading-snug -mt-1"
              style={{ color: "var(--muted)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              *Does not include YouTube advertisements
            </p>
          )}

          {/* CTAs */}
          {isSignup ? (
            <div className="flex flex-col gap-2.5 mt-1">
              <Link
                href="/register"
                className="w-full py-3 rounded-xl text-sm font-semibold text-center no-underline transition hover:opacity-90"
                style={{ background: "var(--rust)", color: "#fff", fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase" }}
                onClick={onClose}
              >
                Create free account
              </Link>
              <Link
                href="/login"
                className="w-full py-3 rounded-xl text-sm font-medium text-center no-underline border transition hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--foreground)", fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase" }}
                onClick={onClose}
              >
                Sign in
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mt-1">
              <button
                type="button"
                className="pro-gradient-btn pro-gradient-btn--block pro-gradient-btn--lg w-full text-center cursor-pointer border-0 font-inherit"
                onClick={() => {
                  onClose()
                  openProModal()
                }}
              >
                TRY PRO FREE
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-xs transition hover:opacity-80"
                style={{ color: "var(--muted)", fontFamily: "var(--font-ibm-mono), IBM Plex Mono, monospace" }}
              >
                Maybe later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(overlay, document.body)
}
