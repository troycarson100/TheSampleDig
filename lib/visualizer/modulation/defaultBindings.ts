import type { Binding } from "./AudioReactiveBinding"
import { WAVE_PREVIEW_TEMPLATE_ID } from "@/lib/visualizer/previewTemplate"

const wavePreviewDefaults: Binding[] = [
  {
    id: "wb-glow-energy",
    source: "energy",
    target: "glowIntensity",
    amount: 0.25,
    smoothing: 0.55,
    invert: false,
  },
  {
    id: "wb-stroke-mid",
    source: "mid",
    target: "strokeWidth",
    amount: 0.2,
    smoothing: 0.45,
    invert: false,
  },
  {
    id: "wb-cream-section",
    source: "sectionProgress",
    target: "creamMix",
    amount: 0.12,
    smoothing: 0.7,
    invert: false,
  },
]

const DEFAULT_BINDINGS_BY_TEMPLATE: Record<string, Binding[]> = {
  [WAVE_PREVIEW_TEMPLATE_ID]: wavePreviewDefaults,
}

export function getDefaultBindingsForTemplate(templateId: string): Binding[] {
  const list = DEFAULT_BINDINGS_BY_TEMPLATE[templateId]
  return list ? list.map((b) => ({ ...b, id: `${b.id}` })) : []
}
