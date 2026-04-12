import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const MAX_HISTORY = 1000

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.isPro !== true) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 })
  }

  const rows = await prisma.userDigHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { viewedAt: "desc" },
    take: MAX_HISTORY,
  })

  const items = rows.map((r) => ({
    youtubeId: r.youtubeId,
    title: r.title,
    channel: r.channel,
    thumbnailUrl: r.thumbnailUrl,
    genre: r.genre ?? null,
    bpm: r.bpm ?? null,
    key: r.key ?? null,
    viewedAt: r.viewedAt.getTime(),
  }))

  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.isPro !== true) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 })
  }

  const body = await request.json()
  const { youtubeId, title, channel, thumbnailUrl, genre, bpm, key } = body

  if (!youtubeId || !title || !channel || !thumbnailUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const userId = session.user.id

  // Upsert: update viewedAt if already exists, otherwise create
  await prisma.userDigHistory.upsert({
    where: { userId_youtubeId: { userId, youtubeId } },
    update: { viewedAt: new Date(), title, channel, thumbnailUrl, genre: genre ?? null, bpm: bpm ?? null, key: key ?? null },
    create: { userId, youtubeId, title, channel, thumbnailUrl, genre: genre ?? null, bpm: bpm ?? null, key: key ?? null },
  })

  // Enforce 1000-item cap: delete oldest beyond the limit
  const count = await prisma.userDigHistory.count({ where: { userId } })
  if (count > MAX_HISTORY) {
    const oldest = await prisma.userDigHistory.findMany({
      where: { userId },
      orderBy: { viewedAt: "asc" },
      take: count - MAX_HISTORY,
      select: { id: true },
    })
    await prisma.userDigHistory.deleteMany({
      where: { id: { in: oldest.map((r) => r.id) } },
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id || session.user.isPro !== true) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 })
  }

  await prisma.userDigHistory.deleteMany({ where: { userId: session.user.id } })

  return NextResponse.json({ ok: true })
}
