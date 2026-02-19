/**
 * Secret endpoint: upload an audio file and get BPM + key analysis.
 * If AUDIO_TEST_SECRET is set in env, request must include secret (form field or header X-Audio-Test-Secret).
 */

import { NextResponse } from "next/server"
import { writeFile, mkdir, unlink } from "fs/promises"
import path from "path"
import { randomBytes } from "crypto"
import { analyzeAudioFile } from "@/lib/audio-analysis"

const TEMP_DIR = path.join(process.cwd(), "tmp", "audio-test")
const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50MB
const ALLOWED_EXT = [".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac"]

function checkSecret(request: Request, formData?: FormData): boolean {
  const secret = process.env.AUDIO_TEST_SECRET
  if (!secret) return true
  const header = request.headers.get("x-audio-test-secret")
  if (header === secret) return true
  const formSecret = formData?.get("secret")
  if (typeof formSecret === "string" && formSecret === secret) return true
  return false
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    if (!checkSecret(request, formData)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const file = formData.get("audio") as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB)` },
        { status: 400 }
      )
    }
    const ext = path.extname(file.name).toLowerCase() || ".mp3"
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported format. Use one of: ${ALLOWED_EXT.join(", ")}` },
        { status: 400 }
      )
    }
    const id = randomBytes(8).toString("hex")
    const filename = `test-${id}${ext}`
    await mkdir(TEMP_DIR, { recursive: true })
    const inputPath = path.join(TEMP_DIR, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(inputPath, buffer)
    try {
      const result = await analyzeAudioFile(inputPath)
      return NextResponse.json({
        success: true,
        bpm: result.bpm,
        key: result.key,
      })
    } finally {
      await unlink(inputPath).catch(() => {})
    }
  } catch (e: unknown) {
    console.error("[test-analyze]", e)
    const message = e instanceof Error ? e.message : "Analysis failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
