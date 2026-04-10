"use client"

import { usePathname } from "next/navigation"
import SessionProvider from "@/components/SessionProvider"
import ConditionalFooter from "@/components/ConditionalFooter"
import { GoProModalProvider } from "@/components/GoProModalContext"

export default function RootBody({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Standalone landing pages — no session or main app footer
  if (
    pathname === "/prelaunch" ||
    pathname?.startsWith("/prelaunch/") ||
    pathname === "/coming-soon" ||
    pathname?.startsWith("/coming-soon/")
  ) {
    return <>{children}</>
  }
  return (
    <SessionProvider>
      <GoProModalProvider>
        <div className="flex flex-col min-h-screen">
          {children}
          <ConditionalFooter />
        </div>
      </GoProModalProvider>
    </SessionProvider>
  )
}
