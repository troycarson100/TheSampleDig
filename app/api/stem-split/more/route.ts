import { NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"
import { existsSync, readdirSync } from "fs"

const STEM_OUTPUT_DIR = path.join(process.cwd(), ".stem-output")

const DRUMS_STEMS = [
  { id: "kick", label: "Kick" },
  { id: "snare", label: "Snare" },
  { id: "cymbals", label: "Cymbals" },
  { id: "toms", label: "Toms" },
] as const

const MELODIES_STEMS = [
  { id: "guitar", label: "Guitar" },
  { id: "piano", label: "Piano" },
  { id: "other", label: "Other instruments" },
] as const

const VOCALS_STEMS = [
  { id: "lead", label: "Lead Vocals" },
  { id: "backing", label: "Backing Vocals" },
] as const

type MoreType = "vocals" | "drums" | "melodies"

function runScript(
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd: process.cwd(), env: { ...process.env, ...env } })
    let stdout = ""
    let stderr = ""
    proc.stdout?.on("data", (d) => { stdout += d.toString() })
    proc.stderr?.on("data", (d) => { stderr += d.toString() })
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }))
    proc.on("error", (err) => resolve({ code: 1, stdout: "", stderr: err.message }))
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : ""
    const type = body.type as MoreType | undefined
    const safeJobId = path.basename(jobId)
    if (!jobId || jobId !== safeJobId) {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400 })
    }
    if (!type || !["vocals", "drums", "melodies"].includes(type)) {
      return NextResponse.json({ error: "Invalid type; use vocals, drums, or melodies" }, { status: 400 })
    }
    const jobDir = path.join(STEM_OUTPUT_DIR, safeJobId)
    if (!existsSync(jobDir)) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (type === "vocals") {
      const vocalsPath = path.join(jobDir, "vocals.wav")
      if (!existsSync(vocalsPath)) {
        return NextResponse.json(
          { error: "Vocals stem not found for this job. Run stem split first." },
          { status: 404 }
        )
      }
      const scriptPath = path.join(process.cwd(), "scripts", "stem-split-vocals.py")
      const pythonCmd = process.env.PYTHON ?? "python3"
      let result = await runScript(pythonCmd, [scriptPath, vocalsPath, jobDir])
      if (result.code !== 0 && /not found|ENOENT|command not found/i.test(result.stderr) && pythonCmd === "python3") {
        result = await runScript("python", [scriptPath, vocalsPath, jobDir])
      }
      if (result.code !== 0) {
        const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim()
        const notInstalled = /audio-separator not installed|No module named/i.test(details)
        return NextResponse.json(
          {
            error: notInstalled
              ? "Lead/backing vocal separation requires audio-separator. Install with: pip install \"audio-separator[cpu]\" (see STEM-SPLITTER-SETUP.md)."
              : "Vocal separation failed",
            details: details || undefined,
          },
          { status: 500 }
        )
      }
      const stems = VOCALS_STEMS.map(({ id, label }) => ({
        id,
        label,
        url: `/api/stems/${safeJobId}/${id}.wav`,
      }))
      return NextResponse.json({ available: true, stems })
    }

    if (type === "drums") {
      const drumsPath = path.join(jobDir, "drums.wav")
      if (!existsSync(drumsPath)) {
        return NextResponse.json(
          { error: "Drums stem not found for this job. Run stem split first." },
          { status: 404 }
        )
      }
      const scriptPath = path.join(process.cwd(), "scripts", "stem-split-drums.sh")
      const env = process.env.DRUMSEP_DIR ? { DRUMSEP_DIR: process.env.DRUMSEP_DIR } : undefined
      const result = await runScript("bash", [scriptPath, drumsPath, jobDir], env)
      if (result.code !== 0) {
        const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim()
        const notInstalled = /DrumSep not found|not installed/i.test(details)
        return NextResponse.json(
          {
            error: notInstalled
              ? "DrumSep not installed. See STEM-SPLITTER-SETUP.md for setup. Set DRUMSEP_DIR if installed elsewhere."
              : "Drum separation failed",
            details: details || undefined,
          },
          { status: 500 }
        )
      }
      const stems = DRUMS_STEMS.map(({ id, label }) => ({
        id,
        label,
        url: `/api/stems/${safeJobId}/${id}.wav`,
      }))
      return NextResponse.json({ available: true, stems })
    }

    if (type === "melodies") {
      const otherPath = path.join(jobDir, "other.wav")
      if (!existsSync(otherPath)) {
        return NextResponse.json(
          { error: "Melody stem not found for this job. Run stem split first." },
          { status: 404 }
        )
      }
      // Use original full mix when available so 6-stem gets full song (better guitar/piano separation)
      const inputFile = readdirSync(jobDir).find((f) => f.startsWith("input."))
      const melodyInputPath = inputFile ? path.join(jobDir, inputFile) : otherPath
      const scriptPath = path.join(process.cwd(), "scripts", "stem-split-melodies.py")
      const pythonCmd = process.env.PYTHON ?? "python3"
      let result = await runScript(pythonCmd, [scriptPath, melodyInputPath, jobDir])
      if (result.code !== 0 && /not found|ENOENT|command not found/i.test(result.stderr) && pythonCmd === "python3") {
        result = await runScript("python", [scriptPath, otherPath, jobDir])
      }
      if (result.code !== 0) {
        const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim()
        return NextResponse.json(
          { error: "Melody separation failed", details: details || undefined },
          { status: 500 }
        )
      }
      const stems = MELODIES_STEMS.map(({ id, label }) => ({
        id,
        label,
        url: `/api/stems/${safeJobId}/${id}.wav`,
      }))
      return NextResponse.json({ available: true, stems })
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  } catch (e) {
    console.error("[stem-split/more]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 }
    )
  }
}
