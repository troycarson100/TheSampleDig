import type { Metadata } from "next"
import { Playfair_Display, DM_Sans } from "next/font/google"
import "./generator.css"

const playfairGenerate = Playfair_Display({
  subsets: ["latin"],
  style: ["italic", "normal"],
  variable: "--font-generate-heading",
  display: "swap",
})

const dmSansGenerate = DM_Sans({
  subsets: ["latin"],
  variable: "--font-generate-body",
  display: "swap",
})

export const metadata: Metadata = {
  title: "AI Sample Pack Generator | SampleRoll",
}

export default function GenerateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`generate-shell ${playfairGenerate.variable} ${dmSansGenerate.variable} min-h-screen`}
      style={{ backgroundColor: "#111110" }}
    >
      {children}
    </div>
  )
}
