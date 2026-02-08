import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

const STEM_OUTPUT_DIR = path.join(process.cwd(), ".stem-output")
const ALLOWED_NAMES = ["vocals.wav", "drums.wav", "bass.wav", "other.wav"]

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string; filename: string }> }
) {
  const { jobId, filename } = await params
  if (!jobId || !filename || !ALLOWED_NAMES.includes(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const safeJobId = path.basename(jobId)
  const safeFilename = path.basename(filename)
  const filePath = path.join(STEM_OUTPUT_DIR, safeJobId, safeFilename)
  if (!filePath.startsWith(path.join(STEM_OUTPUT_DIR, safeJobId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  try {
    const buf = await readFile(filePath)
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
