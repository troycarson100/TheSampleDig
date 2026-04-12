/** Beat Visualizer shared types */

export interface AudioState {
  isPlaying: boolean
  currentTime: number
  duration: number
  bpm: number | null
  beats: number[]
  sections: { start: number; end: number; label?: string }[]
  frequencyBands: number[]
}

export type VisualizerParams = Record<string, unknown>

export interface VisualizerTemplate {
  id: string
  name: string
  category: string
  thumbnail: string
  defaultParams: VisualizerParams
  shaderCode?: string
}

export type SceneTransition = Record<string, unknown>

export interface Scene {
  id: string
  templateId: string
  startTime: number
  endTime: number
  params: VisualizerParams
  modulations: Modulation[]
  transition: SceneTransition
}

export type ModulationType = "lfo" | "envelope" | "beatSync"

export interface Modulation {
  id: string
  type: ModulationType
  target: string
  params: Record<string, unknown>
}

/** Typical vertical export: 1080×1920 @ 30 or 60 fps */
export type ExportFps = 30 | 60

export type ExportQuality = "draft" | "standard" | "high"

export interface ExportConfig {
  width: number
  height: number
  fps: ExportFps
  quality: ExportQuality
}

export interface ProjectState {
  scenes: Scene[]
  audioState: AudioState
  exportConfig: ExportConfig
  activeSceneId: string | null
}
