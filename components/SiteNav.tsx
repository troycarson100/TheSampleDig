"use client"

import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"

export default function SiteNav() {
  const { data: session } = useSession()

  return (
    <nav className="grid grid-cols-3 items-center w-full gap-4 py-4">
      <div className="flex gap-8">
        <Link href="/dig" className="text-[15px] font-medium text-[var(--foreground)]/90 hover:text-[var(--foreground)] transition" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
          Dig
        </Link>
        {session && (
          <Link href="/profile" className="text-[15px] font-medium text-[var(--foreground)]/90 hover:text-[var(--foreground)] transition" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
            My Samples
          </Link>
        )}
      </div>
      <Link href="/dig" className="flex items-center justify-center" aria-label="Sample Roll – Home">
        <Image
          src="/sample-roll-logo.svg"
          alt="Sample Roll"
          width={445}
          height={146}
          className="h-[52px] sm:h-[60px] w-auto object-contain"
          priority
        />
      </Link>
      <div className="flex justify-end">
        {session ? (
          <Link
            href="/api/auth/signout"
            className="px-5 py-2 rounded-[var(--radius-button)] bg-[var(--primary)] text-[var(--primary-foreground)] text-[15px] font-medium hover:opacity-90 transition"
            style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
          >
            Sign out
          </Link>
        ) : (
          <Link
            href="/login"
            className="px-5 py-2 rounded-[var(--radius-button)] bg-[var(--primary)] text-[var(--primary-foreground)] text-[15px] font-medium hover:opacity-90 transition"
            style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  )
}
