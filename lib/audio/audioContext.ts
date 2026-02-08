/**
 * Singleton AudioContext for the app (beat engine and future chop preview).
 * Create/resume on first call (call from user gesture, e.g. first Play).
 */

let audioContext: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (typeof window === "undefined") {
    throw new Error("getAudioContext() must be called in the browser")
  }
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === "suspended") {
    audioContext.resume()
  }
  return audioContext
}

export function getAudioContextOrNull(): AudioContext | null {
  if (typeof window === "undefined") return null
  return audioContext
}
