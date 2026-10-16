'use client'

import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

/**
 * Markdown + LaTeX renderer (Nyaksai renders streamed Markdown with KaTeX).
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="nyaksai-md text-[13px] leading-relaxed text-neutral-100">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
          h1: ({ children }) => <h1 className="text-base font-bold mb-1.5">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[13px] font-bold mb-1">{children}</h3>,
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-emerald-400 underline">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-emerald-500/50 pl-2.5 text-neutral-300 italic mb-2">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="my-2 rounded-lg bg-black/60 border border-white/10 p-3 overflow-x-auto text-[12px] leading-relaxed">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className ?? '')
            if (isBlock) {
              return (
                <code className={`${className ?? ''} font-mono text-emerald-200`} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code
                className="font-mono text-[12px] bg-white/10 border border-white/10 rounded px-1 py-0.5 text-emerald-200"
                {...props}
              >
                {children}
              </code>
            )
          },
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-[12px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-white/10 px-2 py-1.5 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-white/5 px-2 py-1.5">{children}</td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})
