"use client"

import AbCompare, { type AbExample, type AbStyles } from "@/components/plugin-page/AbCompare"
import styles from "./fltr-ab.module.css"
import peaksData from "./ab-peaks.json"

const EXAMPLES = peaksData.examples as AbExample[]

/** The fltr'd half, filled with the morph bar's own pink -> violet -> cyan, so
    the half being judged wears the plugin's colours and the dry half does not.
    The gradient is keyed on the player's id so two players on one page could
    never share, or fight over, one definition. */
function MorphHalf({ d, uid }: { d: string; uid: string }) {
  const id = `${uid}-morph`
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff5a8c" />
          <stop offset="0.5" stopColor="#9d7bff" />
          <stop offset="1" stopColor="#3fd8e6" />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#${id})`} />
    </>
  )
}

/** fltr's before-and-after, directly under its hero: drums dry, then through
    fltr. The player is shared with drft's; the look is fltr-ab.module.css. */
export default function FltrAbSection() {
  return (
    <AbCompare
      examples={EXAMPLES}
      audioBase="/fltr/ab"
      title="Hear it in action"
      id="fltr-ab"
      styles={styles as unknown as AbStyles}
      Wet={MorphHalf}
      sectionProps={{ "data-fltr-ab": "" }}
      unitProps={{ "data-fltr-ab-unit": "" }}
    />
  )
}
