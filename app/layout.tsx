import type { Metadata } from "next"
import { Geist, Geist_Mono, Halant, DM_Serif_Display, Bebas_Neue, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import RootBody from "@/components/RootBody"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const halant = Halant({
  variable: "--font-halant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
})

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
})

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: ["400"],
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
})

export const metadata: Metadata = {
  title: "Sample Roll - Discover Rare Vinyl Samples",
  description: "Find and save rare vinyl samples for beat making",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${halant.variable} ${dmSerif.variable} ${bebasNeue.variable} ${ibmPlexMono.variable} font-sans antialiased flex flex-col min-h-screen theme-vinyl`}
      >
        <RootBody>{children}</RootBody>
      </body>
    </html>
  )
}
