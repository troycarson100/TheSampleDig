import { NextResponse } from "next/server"
import { signLicense, loadSigningKey, todayIssued } from "@/lib/license-sign"

// Diagnostic: exercises the SIGNING half of activation with no database and no
// customer data, so a failure here vs a healthy result here tells us which half
// of /api/license/activate is broken.
//
// Deliberately returns booleans and lengths only - never any part of the key.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const raw = process.env.LICENSE_SIGNING_PRIVATE_KEY ?? null

  const result: Record<string, unknown> = {
    runtime: "nodejs",
    node: process.version,
    keyPresent: raw !== null,
    keyLength: raw?.length ?? 0,
    keyHasEscapedNewlines: raw?.includes("\\n") ?? false,
    keyHasRealNewlines: raw?.includes("\n") ?? false,
    keyStartsCorrectly: raw?.startsWith("-----BEGIN") ?? false,
  }

  try {
    const pem = loadSigningKey()
    result.pemLines = pem.split("\n").length
    result.loadSigningKey = "ok"
  } catch (e) {
    result.loadSigningKey = e instanceof Error ? e.message : "failed"
    return NextResponse.json(result)
  }

  try {
    const blob = signLicense(
      {
        v: 1,
        product: "shft",
        key: "SHFT-0000-0000-0000",
        email: "health@example.com",
        machines: ["MHEALTH01"],
        issued: todayIssued(),
      },
      loadSigningKey(),
    )
    result.sign = "ok"
    result.blobLength = blob.length
    result.sigBytes = Buffer.from(blob.split(".")[1], "base64").length
  } catch (e) {
    result.sign = e instanceof Error ? e.message : "failed"
  }

  return NextResponse.json(result)
}
