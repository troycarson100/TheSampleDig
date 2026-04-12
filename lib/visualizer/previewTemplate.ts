/** Single built-in preview template until WebGL templates land (Step 2.2+). */

export const WAVE_PREVIEW_TEMPLATE_ID = "wave-preview" as const

export interface PreviewParamDef {
  key: string
  label: string
  min: number
  max: number
  defaultValue: number
  step: number
}

export const WAVE_PREVIEW_PARAMS: PreviewParamDef[] = [
  {
    key: "glowIntensity",
    label: "Glow",
    min: 0,
    max: 1,
    defaultValue: 0.35,
    step: 0.01,
  },
  {
    key: "strokeWidth",
    label: "Line weight",
    min: 0.5,
    max: 4,
    defaultValue: 1.25,
    step: 0.05,
  },
  {
    key: "creamMix",
    label: "Cream mix",
    min: 0,
    max: 1,
    defaultValue: 0.15,
    step: 0.01,
  },
]

export function wavePreviewDefaults(): Record<string, number> {
  return Object.fromEntries(WAVE_PREVIEW_PARAMS.map((p) => [p.key, p.defaultValue]))
}

export function getPreviewParamDef(key: string): PreviewParamDef | undefined {
  return WAVE_PREVIEW_PARAMS.find((p) => p.key === key)
}
