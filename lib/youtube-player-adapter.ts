/**
 * Thin adapter for the YouTube IFrame API.
 * Load the API once, then create an adapter from an iframe element.
 */

export interface YouTubePlayerAdapter {
  getCurrentTime(): number
  /** Duration in seconds; 0 until video metadata is loaded. */
  getDuration(): number
  seekTo(seconds: number): void
  play(): void
  pause(): void
  /** 1 = playing, 2 = paused, 0 = ended, 3 = buffering, 5 = cued, -1 = unstarted */
  getPlayerState(): number
  /** 0–100. Used for soft-start when playing chops to reduce click. */
  getVolume(): number
  setVolume(volume: number): void
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: { events?: { onReady?: (e: { target: YTPlayerInstance }) => void } }
      ) => void
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YTPlayerInstance {
  getCurrentTime: () => number
  getDuration: () => number
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  playVideo: () => void
  pauseVideo: () => void
  getPlayerState: () => number
  getVolume: () => number
  setVolume: (volume: number) => void
}

let apiReadyResolve: (() => void) | null = null
const apiReadyPromise = new Promise<void>((resolve) => {
  apiReadyResolve = resolve
})

export function loadYouTubeIframeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.YT?.Player) {
    apiReadyResolve?.()
    return apiReadyPromise
  }
  const prev = window.onYouTubeIframeAPIReady
  window.onYouTubeIframeAPIReady = () => {
    prev?.()
    apiReadyResolve?.()
  }
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const tag = document.createElement("script")
    tag.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(tag)
  }
  return apiReadyPromise
}

export function createAdapterFromIframe(
  iframe: HTMLIFrameElement | null,
  onReady: (adapter: YouTubePlayerAdapter) => void
): () => void {
  if (!iframe || !window.YT?.Player) return () => {}

  const player = new window.YT.Player(iframe, {
    events: {
      onReady: (e: { target: YTPlayerInstance }) => {
        const target = e.target
        onReady({
          getCurrentTime: () => target.getCurrentTime(),
          getDuration: () => target.getDuration(),
          seekTo: (seconds: number) => target.seekTo(seconds, true),
          play: () => target.playVideo(),
          pause: () => target.pauseVideo(),
          getPlayerState: () => target.getPlayerState(),
          getVolume: () => target.getVolume(),
          setVolume: (volume: number) => target.setVolume(volume),
        })
      },
    },
  })

  return () => {
    if (typeof (player as any).destroy === "function") (player as any).destroy()
  }
}
