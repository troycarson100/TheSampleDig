import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

const STEM_OUTPUT_DIR = path.join(process.cwd(), ".stem-output")
const BASE_STEMS = ["vocals.wav", "drums.wav", "bass.wav", "other.wav"]
const DRUMS_SEP = ["kick.wav", "snare.wav", "cymbals.wav", "toms.wav"]
const MELODIES_SEP = ["guitar.wav", "piano.wav"]
const VOCALS_SEP = ["lead.wav", "backing.wav"]
const ALLOWED_NAMES = [...BASE_STEMS, ...DRUMS_SEP, ...MELODIES_SEP, ...VOCALS_SEP]

function getFilePath(jobId: string, filename: string): string | null {
  const safeJobId = path.basename(jobId)
  const safeFilename = path.basename(filename)
  if (!ALLOWED_NAMES.includes(safeFilename)) return null
  const base = path.join(STEM_OUTPUT_DIR, safeJobId)
  if (BASE_STEMS.includes(safeFilename)) return path.join(base, safeFilename)
  if (DRUMS_SEP.includes(safeFilename)) return path.join(base, "drums-sep", safeFilename)
  if (MELODIES_SEP.includes(safeFilename)) return path.join(base, "melodies-sep", safeFilename)
  if (VOCALS_SEP.includes(safeFilename)) return path.join(base, "vocals-sep", safeFilename)
  return null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string; filename: string }> }
) {
  const { jobId, filename } = await params
  if (!jobId || !filename) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const filePath = getFilePath(jobId, filename)
  if (!filePath || !filePath.startsWith(path.join(STEM_OUTPUT_DIR, path.basename(jobId)))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  try {
    const buf = await readFile(filePath)
    const safeFilename = path.basename(filename)
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
