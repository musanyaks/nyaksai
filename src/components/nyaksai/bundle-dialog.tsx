'use client'

import { Download, MonitorSmartphone, KeyRound, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { markDialogClose } from '@/hooks/use-shortcuts'
import { toast } from 'sonner'

const STEPS_WEB = `unzip nyaksai-bundle.zip && cd nyaksai-bundle
npm install              # or: bun install
cp .env.example .env
npx prisma db push
npm run dev              # http://localhost:3000`

const STEPS_DESKTOP = `# with the web app running in another terminal:
cd desktop
npm install
npm start                # loads http://localhost:3000 (override: NYAKSAI_URL=...)`

const FLAGS: [string, string][] = [
  [
    'setContentProtection(true)',
    'excluded from screen shares, recordings & screenshots (Windows: WDA_EXCLUDEFROMCAPTURE · macOS: NSWindowSharingNone)',
  ],
  ['skipTaskbar: true', 'no taskbar icon on Windows/Linux · removed from the macOS Dock'],
  ['frame:false + transparent', 'frameless, translucent overlay'],
  ['alwaysOnTop + showInactive()', 'floats above fullscreen apps · never steals keyboard focus'],
]

export function BundleDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) markDialogClose()
      }}
    >
      <DialogContent className="bg-neutral-950/95 backdrop-blur-2xl border-white/12 text-neutral-200 max-h-[85vh] overflow-y-auto w-[min(560px,94vw)] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-neutral-100 flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            Get the Nyaksai code bundle
          </DialogTitle>
          <DialogDescription className="text-[11px] text-neutral-500">
            The full source: Next.js web app + the Electron stealth shell + setup README.
          </DialogDescription>
        </DialogHeader>

        <a
          href="/nyaksai-bundle.zip"
          download
          onClick={() =>
            toast.success('Bundle downloading…', {
              description: 'nyaksai-bundle.zip — unzip and follow the steps below.',
            })
          }
          className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-[13px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/25"
        >
          <Download className="w-4 h-4" />
          Download nyaksai-bundle.zip
        </a>

        <section className="py-1">
          <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">
            1 · Run the web app
          </h3>
          <pre className="rounded-xl bg-black/50 border border-white/10 p-3 text-[11px] leading-5 font-mono text-neutral-300 overflow-x-auto whitespace-pre">
            {STEPS_WEB}
          </pre>
        </section>

        <section className="py-1">
          <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">
            <MonitorSmartphone className="w-3.5 h-3.5" />
            2 · Run the invisible desktop shell
          </h3>
          <p className="text-[11px] text-neutral-500 mb-2 leading-relaxed">
            A browser tab cannot hide itself from capture — the desktop shell sets the OS-level
            flags that make Nyaksai invisible to Zoom / Meet / Teams and absent from the taskbar:
          </p>
          <pre className="rounded-xl bg-black/50 border border-white/10 p-3 text-[11px] leading-5 font-mono text-neutral-300 overflow-x-auto whitespace-pre">
            {STEPS_DESKTOP}
          </pre>
          <ul className="mt-2.5 space-y-1.5">
            {FLAGS.map(([flag, effect]) => (
              <li key={flag} className="text-[11px] leading-relaxed">
                <code className="text-emerald-300">{flag}</code>
                <span className="text-neutral-500"> — {effect}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="py-1">
          <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">
            <KeyRound className="w-3.5 h-3.5" />
            3 · Connect an AI provider (local runs)
          </h3>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            The built-in backend works here in the preview. On your machine: Settings → Custom
            provider → any OpenAI-compatible endpoint (OpenAI, Groq, OpenRouter, local Ollama) —
            chat, vision and transcription all use it.
          </p>
        </section>

        <p className="text-[10px] text-neutral-600 flex gap-1.5 leading-relaxed pb-1">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-500" />
          <span>
            Honest limits: a physical camera pointed at the screen still sees the overlay, and some
            enterprise monitoring agents ignore capture protection. Use responsibly — legitimate
            for note-taking, sales calls, lectures and accessibility; using AI covertly where it is
            prohibited (e.g. proctored exams) is on you.
          </span>
        </p>
      </DialogContent>
    </Dialog>
  )
}
