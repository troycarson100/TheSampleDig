"use client"

import AbCompare, { type AbExample, type AbStyles } from "@/components/plugin-page/AbCompare"
import styles from "./drft.module.css"
import peaksData from "./ab-peaks.json"

const EXAMPLES = peaksData.examples as AbExample[]

/** The engaged half, drawn as three offset copies in the wordmark's own
    orange -> coral -> pink ramp. Screened together they fringe the way chroma
    bleeds off a worn tape, and the overlap blows out toward white. The clean
    half deliberately gets none of this - that contrast is the whole section. */
function ChromaHalf({ d }: { d: string }) {
  return (
    <>
      <path d={d} transform="translate(-2.5 0)" className={styles.abChromaA} />
      <path d={d} transform="translate(2.5 0)" className={styles.abChromaB} />
      <path d={d} className={styles.abChromaCore} />
    </>
  )
}

/** drft's before-and-after, under its hero. The player is shared with fltr's
    (components/plugin-page/AbCompare.tsx); what is drft's is here and in
    drft.module.css. */
export default function DrftAbSection() {
  return (
    <AbCompare
      examples={EXAMPLES}
      audioBase="/drft/ab"
      title="Hear it in action"
      id="drft-ab"
      styles={styles as unknown as AbStyles}
      Wet={ChromaHalf}
      sectionProps={{ "data-drft-ab": "" }}
      unitProps={{ "data-drft-ab-unit": "" }}
    />
  )
}
