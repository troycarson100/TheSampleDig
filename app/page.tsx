import PrelaunchContent from "@/app/prelaunch/PrelaunchContent"
import HomeBlogTeaser from "@/components/HomeBlogTeaser"

export const metadata = {
  title: "Sample Roll — Crate Digging, Simplified",
  description: "Sample Roll — discover rare vinyl samples. Find samples that matter.",
}

export default function HomePage() {
  return (
    <PrelaunchContent>
      <HomeBlogTeaser />
    </PrelaunchContent>
  )
}
