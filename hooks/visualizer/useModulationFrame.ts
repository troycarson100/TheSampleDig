"use client"

import { useEffect, useRef } from "react"
import { useAudioEngineStore } from "@/hooks/visualizer/useAudioEngine"
import { useVisualizerStudioStore } from "@/hooks/visualizer/useVisualizerStudioStore"
import {
  applyAudioModulation,
  buildModulationContext,
  createModulationState,
  resetModulationStateForBindings,
  type ModulationState,
} from "@/lib/visualizer/modulation/AudioReactiveBinding"

/** Drives audio-reactive params each frame; writes effectiveParams to the studio store. */
export function useModulationFrame() {
  const bindings = useVisualizerStudioStore((s) => s.bindings)
  const setEffectiveStore = useVisualizerStudioStore.setState

  const modStateRef = useRef<ModulationState | null>(null)
  const lastTRef = useRef<number | null>(null)

  useEffect(() => {
    modStateRef.current = createModulationState()
  }, [])

  useEffect(() => {
    const st = modStateRef.current
    if (st) resetModulationStateForBindings(st, bindings)
  }, [bindings])

  useEffect(() => {
    let raf: number
    const tick = (t: number) => {
      const last = lastTRef.current
      lastTRef.current = t
      const dt = last != null ? Math.min(0.1, Math.max(0, (t - last) / 1000)) : 1 / 60

      const audio = useAudioEngineStore.getState()
      const studio = useVisualizerStudioStore.getState()
      const modState = modStateRef.current ?? createModulationState()
      modStateRef.current = modState

      const bands =
        audio.frequencyBands.length >= 6
          ? audio.frequencyBands
          : Array(8).fill(audio.isPlaying ? 0.02 : 0)
      const energy =
        bands.length > 0 ? bands.reduce((a, b) => a + b, 0) / bands.length : 0

      const ctx = buildModulationContext(
        {
          bands,
          energy,
          currentTime: audio.currentTime,
          duration: audio.duration,
          bpm: audio.bpm,
          beats: audio.beats,
          sections: audio.sections,
        },
        modState,
        dt
      )

      const effective =
        studio.bindings.length === 0
          ? { ...studio.baseParams }
          : applyAudioModulation(
              studio.baseParams,
              studio.bindings,
              ctx,
              modState,
              studio.paramDefs,
              dt
            )

      setEffectiveStore({ effectiveParams: effective })
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  // zustand setState is stable; loop reads latest store via getState().
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [])
}
