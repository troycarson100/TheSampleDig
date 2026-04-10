"use client"

import { useSession } from "next-auth/react"

/**
 * Client-side Pro gates (playlists, etc.) use this hook.
 *
 * By default **subscription gating is off** — everyone can use Pro UI features
 * (good for local testing and until you turn enforcement on).
 *
 * Set `NEXT_PUBLIC_REQUIRE_PRO_SUBSCRIPTION=true` in production when you want
 * `session.user.isPro` to control access.
 */
const REQUIRE_PRO =
  String(process.env.NEXT_PUBLIC_REQUIRE_PRO_SUBSCRIPTION ?? "").toLowerCase() === "true"

export function useIsPro(): boolean {
  if (!REQUIRE_PRO) return true
  const { data: session } = useSession()
  return session?.user?.isPro === true
}
