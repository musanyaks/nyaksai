import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sessions = await db.chatSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, title: true, mode: true, createdAt: true },
    })
    return NextResponse.json({ success: true, sessions })
  } catch (error) {
    console.error('[GET /api/chats]', error)
    return NextResponse.json({ success: false, sessions: [] }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const messages = JSON.stringify(body.messages ?? [])
    const session = await db.chatSession.create({
      data: {
        title: String(body.title ?? 'Untitled chat').slice(0, 120),
        mode: String(body.mode ?? 'ask'),
        messages,
      },
    })
    return NextResponse.json({ success: true, id: session.id })
  } catch (error) {
    console.error('[POST /api/chats]', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false }, { status: 400 })
    await db.chatSession.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/chats]', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
