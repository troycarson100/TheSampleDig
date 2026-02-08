/**
 * Singleton AudioContext for the app (beat engine and future chop preview).
 * Create/resume on first call. Must be awaited so context is running before playback
 * (call from user gesture, e.g. first Play).
 */

let audioContext: AudioContext | null = null

/** Returns the context after ensuring it is running. Await this before any playback. */
export async function getAudioContext(): Promise<AudioContext> {
  if (typeof window === "undefined") {
    throw new Error("getAudioContext() must be called in the browser")
  }
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume()
  }
  return audioContext
}

export function getAudioContextOrNull(): AudioContext | null {
  if (typeof window === "undefined") return null
  return audioContext
}
