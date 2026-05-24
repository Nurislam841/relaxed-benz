'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownViewProps {
  source: string;
  className?: string;
  /** Compact size: smaller text, tighter spacing — for cards/lists. */
  compact?: boolean;
}

/**
 * Safe markdown renderer.
 *
 * Why this approach:
 *  - `react-markdown` by default DOES NOT render raw HTML — that's
 *    XSS-safe out of the box; we don't pass `rehype-raw`.
 *  - GFM (tables, task lists, strikethrough, autolinks) is enabled via
 *    `remark-gfm` because students paste GitHub-flavoured content.
 *  - Inline code and links get hand-styled with DS tokens; we deliberately
 *    don't pull in a syntax highlighter (would add ~150KB minified for
 *    marginal value on short snippets). For long code, students use the
 *    "Code Submission" tab which IS dedicated to code rendering.
 *  - External links open in a new tab with rel=noopener noreferrer.
 */
export function MarkdownView({ source, className, compact }: MarkdownViewProps) {
  if (!source?.trim()) return null;

  return (
    <div
      className={cn(
        'markdown-body text-[var(--fg)]',
        compact ? 'text-[13px] leading-snug' : 'text-[14px] leading-relaxed',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-serif text-2xl font-semibold mt-5 mb-2 text-[var(--fg)]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif text-xl font-semibold mt-4 mb-2 text-[var(--fg)]">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif text-lg font-semibold mt-3 mb-1.5 text-[var(--fg)]">{children}</h3>
          ),
          p: ({ children }) => <p className={compact ? 'my-1.5' : 'my-2.5'}>{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-outside pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside pl-5 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="marker:text-[var(--fg-muted)]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--accent-500)] pl-3 my-3 text-[var(--fg-muted)] italic">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="text-[var(--accent-700)] underline underline-offset-2 hover:text-[var(--accent-500)]"
            >
              {children}
            </a>
          ),
          code: ({ inline, children, className: cls }: any) => {
            if (inline) {
              return (
                <code className="font-mono text-[0.875em] px-1 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                  {children}
                </code>
              );
            }
            return <code className={cn('font-mono text-[13px]', cls)}>{children}</code>;
          },
          pre: ({ children }) => (
            <pre className="my-3 p-3 rounded-md bg-zinc-950 dark:bg-black/50 text-zinc-100 overflow-x-auto text-[13px] leading-relaxed">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="text-[13px] border-collapse w-full">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b-2 border-[var(--border-color)] px-2 py-1 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-[var(--border-color)] px-2 py-1">{children}</td>,
          hr: () => <hr className="my-4 border-[var(--border-color)]" />,
          // GFM task list checkbox — show as visually clear checkmark/empty box
          input: ({ checked, type, disabled }: any) => {
            if (type !== 'checkbox') return null;
            return (
              <input
                type="checkbox"
                checked={!!checked}
                disabled={disabled ?? true}
                readOnly
                className="mr-1.5 accent-[var(--accent-500)]"
              />
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
