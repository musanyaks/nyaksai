'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquareText, AudioLines, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useNyaksaiStore } from '@/lib/nyaksai/store'
import { markDialogClose } from '@/hooks/use-shortcuts'

interface ChatRow {
  id: string
  title: string
  mode: string
  createdAt: string
}
interface MeetingRow {
  id: string
  title: string
  language: string
  createdAt: string
}

export function HistoryDrawer() {
  const { historyOpen, setHistoryOpen } = useNyaksaiStore()
  const [tab, setTab] = useState<'chats' | 'meetings'>('chats')
  const [chats, setChats] = useState<ChatRow[]>([])
  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, m] = await Promise.all([
        fetch('/api/chats').then((r) => r.json()),
        fetch('/api/meetings').then((r) => r.json()),
      ])
      setChats(c.sessions ?? [])
      setMeetings(m.meetings ?? [])
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (historyOpen) load()
  }, [historyOpen, load])

  const removeChat = async (id: string) => {
    await fetch(`/api/chats?id=${id}`, { method: 'DELETE' })
    setChats((p) => p.filter((c) => c.id !== id))
    toast.success('Chat deleted')
  }
  const removeMeeting = async (id: string) => {
    await fetch(`/api/meetings?id=${id}`, { method: 'DELETE' })
    setMeetings((p) => p.filter((m) => m.id !== id))
    toast.success('Meeting deleted')
  }

  return (
    <Sheet open={historyOpen} onOpenChange={(open) => { setHistoryOpen(open); if (!open) markDialogClose() }}>
      <SheetContent
        side="right"
        className="bg-neutral-950/95 backdrop-blur-2xl border-white/12 text-neutral-200 w-[min(380px,94vw)] p-0 flex flex-col"
      >
        <div className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-bold text-neutral-100">History</SheetTitle>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Saved locally on this device — searchable, exportable, yours.
          </p>
          <div className="mt-3 flex rounded-lg bg-white/5 border border-white/10 p-0.5">
            {(
              [
                ['chats', 'Chats', MessageSquareText],
                ['meetings', 'Meetings', AudioLines],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-[11px] font-semibold transition-colors ${
                  tab === id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
          {loading && <p className="text-[11px] text-neutral-500 px-1 pt-2">Loading…</p>}
          {!loading && tab === 'chats' && chats.length === 0 && (
            <Empty label="No saved chats yet. Every Ask conversation is saved automatically." />
          )}
          {!loading &&
            tab === 'chats' &&
            chats.map((c) => (
              <Row
                key={c.id}
                title={c.title}
                meta={new Date(c.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                onDelete={() => removeChat(c.id)}
              />
            ))}
          {!loading && tab === 'meetings' && meetings.length === 0 && (
            <Empty label="No meetings yet. Stop a Listen session to save it here." />
          )}
          {!loading &&
            tab === 'meetings' &&
            meetings.map((m) => (
              <Row
                key={m.id}
                title={m.title}
                meta={`${m.language} · ${new Date(m.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`}
                onDelete={() => removeMeeting(m.id)}
              />
            ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="mt-10 flex flex-col items-center text-center px-6">
      <FileText className="w-6 h-6 text-neutral-700" />
      <p className="mt-2 text-[11px] text-neutral-500">{label}</p>
    </div>
  )
}

function Row({
  title,
  meta,
  onDelete,
}: {
  title: string
  meta: string
  onDelete: () => void
}) {
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2 hover:border-emerald-500/25 transition-colors">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-neutral-200 truncate">{title}</p>
        <p className="text-[10px] text-neutral-500">{meta}</p>
      </div>
      <button
        onClick={onDelete}
        aria-label="Delete"
        className="ml-auto w-6 h-6 rounded flex items-center justify-center text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
