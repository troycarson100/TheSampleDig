import { NextResponse } from "next/server"
import { writeFile, mkdir, unlink, copyFile } from "fs/promises"
import { spawn } from "child_process"
import path from "path"
import { randomBytes } from "crypto"
import { analyzeAudioFile } from "@/lib/audio-analysis"

const STEM_OUTPUT_DIR = path.join(process.cwd(), ".stem-output")
const STEM_ORDER = ["vocals", "drums", "bass", "other"] as const
const STEM_LABELS: Record<(typeof STEM_ORDER)[number], string> = {
  vocals: "Vocal",
  drums: "Drums",
  other: "Melody",
  bass: "Bass",
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    const ext = path.extname(file.name) || ".mp3"
    const jobId = randomBytes(8).toString("hex")
    await mkdir(STEM_OUTPUT_DIR, { recursive: true })
    const inputPath = path.join(STEM_OUTPUT_DIR, `${jobId}_input${ext}`)
    const outputDir = path.join(STEM_OUTPUT_DIR, jobId)
    await mkdir(outputDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(inputPath, buffer)
    const scriptPath = path.join(process.cwd(), "scripts", "stem-split.py")
    const pythonCmd = process.env.PYTHON ?? "python3"
    const runScript = (cmd: string): Promise<{ code: number; stdout: string; stderr: string }> =>
      new Promise((resolve) => {
        const proc = spawn(cmd, [scriptPath, inputPath, outputDir], {
          cwd: process.cwd(),
        })
        let stdout = ""
        let stderr = ""
        proc.stdout?.on("data", (d) => { stdout += d.toString() })
        proc.stderr?.on("data", (d) => { stderr += d.toString() })
        proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }))
        proc.on("error", (err) => {
          resolve({ code: 1, stdout: "", stderr: err.message })
        })
      })

    let result = await runScript(pythonCmd)
    const commandNotFound = /not found|ENOENT|command not found/i.test(result.stderr)
    if (result.code !== 0 && commandNotFound && pythonCmd === "python3") {
      result = await runScript("python")
    }
    let bpm: number | null = null
    let key: string | null = null
    if (result.code === 0) {
      try {
        const analysis = await analyzeAudioFile(inputPath)
        bpm = analysis.bpm
        key = analysis.key
      } catch (_) {
        // BPM/key optional; continue without
      }
    }
    if (result.code === 0) {
      const keptInput = path.join(outputDir, `input${ext}`)
      await copyFile(inputPath, keptInput).catch(() => {})
    }
    await unlink(inputPath).catch(() => {})
    if (result.code !== 0) {
      const rawOutput = [result.stderr, result.stdout].filter(Boolean).join("\n").trim()
      const demucsMissing = rawOutput.includes("No module named demucs")
      const details = demucsMissing
        ? "Demucs is not installed for the Python used by this server. Install it with: python3 -m pip install -r requirements-stem.txt (see STEM-SPLITTER-SETUP.md)." +
          (rawOutput ? "\n\n" + rawOutput : "")
        : rawOutput || "Python/Demucs not available. Install: pip install demucs"
      return NextResponse.json(
        { error: "Stem separation failed", details },
        { status: 500 }
      )
    }
    const stems = STEM_ORDER.map((id) => ({
      id,
      label: STEM_LABELS[id],
      url: `/api/stems/${jobId}/${id}.wav`,
    }))
    return NextResponse.json({ jobId, stems, bpm, key })
  } catch (e) {
    console.error("[stem-split]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stem split failed" },
      { status: 500 }
    )
  }
}
