import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ youtubeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || session.user.isPro !== true) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 })
  }

  const { youtubeId } = await params

  await prisma.userDigHistory.deleteMany({
    where: { userId: session.user.id, youtubeId },
  })

  return NextResponse.json({ ok: true })
}
