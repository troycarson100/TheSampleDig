"use client"

import { usePathname } from "next/navigation"
import Footer from "./Footer"

export default function ConditionalFooter() {
  const pathname = usePathname()
  if (pathname === "/prelaunch") return null
  return <Footer />
}
