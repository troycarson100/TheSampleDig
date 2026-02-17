/**
 * Persist resume state for populate so we start from the next page we haven't searched,
 * instead of re-walking pages 1..N every run (saves quota).
 */

import { readFile, writeFile } from "fs/promises"
import path from "path"

export interface PopulateResumeState {
  templateIndex: number
  pageToken: string | null
}

const STATE_FILE = path.join(process.cwd(), ".populate-resume-state.json")

export async function loadPopulateResumeState(): Promise<PopulateResumeState | null> {
  try {
    const raw = await readFile(STATE_FILE, "utf-8")
    const data = JSON.parse(raw) as PopulateResumeState
    if (typeof data.templateIndex !== "number" || data.templateIndex < 0) return null
    return {
      templateIndex: data.templateIndex,
      pageToken: typeof data.pageToken === "string" ? data.pageToken : null,
    }
  } catch {
    return null
  }
}

export async function savePopulateResumeState(state: PopulateResumeState): Promise<void> {
  try {
    await writeFile(STATE_FILE, JSON.stringify(state), "utf-8")
  } catch (e) {
    console.warn("[Populate] Failed to save resume state:", (e as Error).message)
  }
}

/** Clear resume state so next run starts from page 1 of template 0. */
export async function clearPopulateResumeState(): Promise<void> {
  try {
    const { unlink } = await import("fs/promises")
    await unlink(STATE_FILE)
  } catch {
    // ignore
  }
}
