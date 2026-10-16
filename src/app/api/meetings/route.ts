import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const meetings = await db.meeting.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, title: true, language: true, createdAt: true },
    })
    return NextResponse.json({ success: true, meetings })
  } catch (error) {
    console.error('[GET /api/meetings]', error)
    return NextResponse.json({ success: false, meetings: [] }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const meeting = await db.meeting.create({
      data: {
        title: String(body.title ?? 'Untitled meeting').slice(0, 120),
        language: String(body.language ?? 'en-US'),
        transcript: JSON.stringify(body.transcript ?? []),
        answers: JSON.stringify(body.answers ?? []),
      },
    })
    return NextResponse.json({ success: true, id: meeting.id })
  } catch (error) {
    console.error('[POST /api/meetings]', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false }, { status: 400 })
    await db.meeting.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/meetings]', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
