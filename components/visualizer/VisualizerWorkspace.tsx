"use client"

import Link from "next/link"
import { useEffect } from "react"
import { AudioDropZone } from "@/components/visualizer/AudioDropZone"
import { TransportControls } from "@/components/visualizer/TransportControls"
import { WaveformDisplay } from "@/components/visualizer/WaveformDisplay"
import { useAudioEngineStore } from "@/hooks/visualizer/useAudioEngine"
import { useModulationFrame } from "@/hooks/visualizer/useModulationFrame"
import { ParameterPanel } from "@/components/visualizer/ParameterPanel"
import { VIZ_COLORS } from "@/lib/visualizer/constants/design-tokens"

const GOLD = VIZ_COLORS.gold
const CREAM = VIZ_COLORS.cream

export function VisualizerWorkspace() {
  const enabled = process.env.NEXT_PUBLIC_VISUALIZER_ENABLED === "true"
  const dispose = useAudioEngineStore((s) => s.dispose)
  const loadStage = useAudioEngineStore((s) => s.loadStage)
  const duration = useAudioEngineStore((s) => s.duration)

  useEffect(() => {
    return () => dispose()
  }, [dispose])

  useModulationFrame()

  if (!enabled) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <div
          className="max-w-md rounded-lg border px-8 py-10 text-center shadow-[0_0_0_1px_rgba(201,169,78,0.08)] backdrop-blur-sm"
          style={{
            borderColor: `${GOLD}40`,
            backgroundColor: "#2A1F14CC",
            fontFamily: "var(--font-body), system-ui, sans-serif",
          }}
        >
          <p
            className="mb-2 text-xs uppercase tracking-[0.2em]"
            style={{ color: `${GOLD}E6` }}
          >
            SampleRoll
          </p>
          <h1
            className="mb-4 text-3xl font-normal tracking-tight sm:text-4xl"
            style={{ fontFamily: "var(--font-heading), Georgia, serif", color: GOLD }}
          >
            Beat Visualizer
          </h1>
          <p className="mb-8 text-sm leading-relaxed" style={{ color: `${CREAM}E6` }}>
            We&apos;re polishing the experience. Check back soon — or head to Dig for fresh
            samples in the meantime.
          </p>
          <Link
            href="/dig"
            className="inline-flex items-center justify-center rounded-md border px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              borderColor: `${GOLD}66`,
              backgroundColor: `${GOLD}1A`,
              color: CREAM,
            }}
          >
            Go to Dig
          </Link>
        </div>
      </main>
    )
  }

  const audioReady = loadStage === "ready" && duration > 0

  return (
    <main className="flex min-h-screen flex-col px-0 pb-12 pt-8">
      <div className="mb-8 text-center">
        <h1
          className="text-3xl font-normal tracking-tight sm:text-4xl"
          style={{ fontFamily: "var(--font-heading), Georgia, serif", color: GOLD }}
        >
          Beat Visualizer
        </h1>
        <p className="mt-1 text-sm" style={{ color: CREAM, fontFamily: "var(--font-body), sans-serif" }}>
          Drop a track. Make it visual.
        </p>
      </div>

      {!audioReady ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <AudioDropZone />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <WaveformDisplay />
            <TransportControls />
          </div>
          <ParameterPanel />
        </div>
      )}
    </main>
  )
}
