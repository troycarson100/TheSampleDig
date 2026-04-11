/**
 * Single source of truth for Dig page "How to use" instructions and key commands.
 * Update this file whenever the dig workflow or shortcuts change.
 */

export interface KeyCommand {
  keys: string
  description: string
}

export interface HowToSection {
  title: string
  items: string[]
}

/** Key commands (chop mode / dig page). Keep in sync with SamplePlayer and useChopMode. */
export const DIG_KEY_COMMANDS: KeyCommand[] = [
  { keys: "Space", description: "Add a chop point on the timeline (or stop recording when recording)" },
  { keys: "R", description: "Start or stop recording your chop sequence; first pad hit starts the clock" },
  { keys: "Q", description: "Toggle quantize on/off for chops and recording" },
  { keys: "X", description: "Clear the recorded loop" },
  { keys: "Shift + Space", description: "Play or pause the video / loop playback" },
  { keys: "Shift + Click", description: "Remove an individual chop (click a timeline marker while holding Shift)" },
  { keys: "", description: "Play the chop at it's assigned key (or record that pad when recording)" },
]

/** Brief how-to steps. Update when the workflow changes. */
export const DIG_HOW_TO_SECTIONS: HowToSection[] = [
  {
    title: "Getting a sample",
    items: [
      "Choose genre and era (or leave as Any) and click the dice to roll a random sample.",
      "Use the back arrow to return to the previous video.",
    ],
  },
  {
    title: "Chop mode",
    items: [
      "With Chop Mode on, press Space to drop chop points on the timeline as the video plays.",
      "Each chop is mapped to a key (A, S, D, …). Press a key to jump the video to that chop and play from there.",
      "Drag the markers on the red timeline bar to move chops; Shift+click a marker to remove it. Drag a chop key onto another to swap them (letters stay in place; colors swap).",
      "Drag the playhead (white line) on the timeline to seek, or click anywhere on the timeline to jump there.",
      "On the timeline: pinch, or Cmd+scroll (Mac) / Ctrl+scroll to zoom in/out. When zoomed, drag or use two-finger horizontal scroll to pan left/right; a quick click (without dragging) still seeks to that spot.",
    ],
  },
  {
    title: "Record a loop",
    items: [
      "Pro only: recording chop loops, saving loop copies, and loading saved loops. If you are signed in without Pro, you can still use Chop Mode (pads and timeline chops) — the loop strip stays locked.",
      "Press R to start recording, then play the chop keys in time. Press R or Space to stop.",
      "Your sequence becomes a loop you can play with Shift+Space. Use Q to quantize, X to clear the loop.",
      "Save the sample (heart) to keep chops and loop in My Samples.",
    ],
  },
]
