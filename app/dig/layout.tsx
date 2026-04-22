import { DigAdSenseScript } from "@/components/ads/DigAdSenseScript"

export default function DigLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DigAdSenseScript />
      {children}
    </>
  )
}
