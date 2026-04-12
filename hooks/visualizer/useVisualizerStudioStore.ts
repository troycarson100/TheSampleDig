"use client"

import { create } from "zustand"
import type { Binding } from "@/lib/visualizer/modulation/AudioReactiveBinding"
import { getDefaultBindingsForTemplate } from "@/lib/visualizer/modulation/defaultBindings"
import {
  WAVE_PREVIEW_TEMPLATE_ID,
  wavePreviewDefaults,
  type PreviewParamDef,
  WAVE_PREVIEW_PARAMS,
} from "@/lib/visualizer/previewTemplate"

export interface VisualizerStudioState {
  templateId: string
  paramDefs: PreviewParamDef[]
  baseParams: Record<string, number>
  bindings: Binding[]
  /** Last computed output (for waveform + panel readout) */
  effectiveParams: Record<string, number>
  setBaseParam: (key: string, value: number) => void
  setBindings: (bindings: Binding[]) => void
  setTemplate: (id: string) => void
  resetToTemplateDefaults: () => void
}

function cloneBindingsFor(id: string): Binding[] {
  return getDefaultBindingsForTemplate(id).map((b) => ({ ...b }))
}

export const useVisualizerStudioStore = create<VisualizerStudioState>((set, get) => ({
  templateId: WAVE_PREVIEW_TEMPLATE_ID,
  paramDefs: WAVE_PREVIEW_PARAMS,
  baseParams: wavePreviewDefaults(),
  bindings: cloneBindingsFor(WAVE_PREVIEW_TEMPLATE_ID),
  effectiveParams: wavePreviewDefaults(),

  setBaseParam: (key, value) =>
    set((s) => ({
      baseParams: { ...s.baseParams, [key]: value },
    })),

  setBindings: (bindings) => set({ bindings }),

  setTemplate: (id) => {
    const paramDefs = WAVE_PREVIEW_PARAMS
    const base = wavePreviewDefaults()
    set({
      templateId: id,
      paramDefs,
      baseParams: base,
      bindings: cloneBindingsFor(id),
      effectiveParams: { ...base },
    })
  },

  resetToTemplateDefaults: () => {
    const { templateId } = get()
    const base = wavePreviewDefaults()
    set({
      baseParams: base,
      bindings: cloneBindingsFor(templateId),
      effectiveParams: { ...base },
    })
  },
}))
