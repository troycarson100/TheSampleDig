import type { Metadata } from "next"
import { Playfair_Display, DM_Sans } from "next/font/google"

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Beat Visualizer | SampleRoll",
}

export default function VisualizerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${playfairDisplay.variable} ${dmSans.variable} min-h-screen`}
      style={{ backgroundColor: "#1A1209" }}
    >
      {children}
    </div>
  )
}
