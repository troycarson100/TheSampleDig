"use client"

import { useSession } from "next-auth/react"

export function useIsPro(): boolean {
  const { data: session } = useSession()
  return session?.user?.isPro === true
}
