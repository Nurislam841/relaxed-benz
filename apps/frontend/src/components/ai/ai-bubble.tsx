'use client';

import * as React from 'react';
import { Sparkles, Copy, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DsAvatar } from '@/components/ds/avatar';
import { useT } from '@/lib/i18n';

interface AIBubbleProps {
  role: 'user' | 'assistant';
  children: React.ReactNode;
  citations?: string[];
  time?: string;
  userName?: string;
  showActions?: boolean;
}

/**
 * AI message bubble with role-aware avatar and action buttons.
 */
export function AIBubble({
  role,
  children,
  citations,
  time,
  userName = 'You',
  showActions = true,
}: AIBubbleProps) {
  const isUser = role === 'user';
  const t = useT() as any;

  return (
    <div
      className={cn(
        'flex gap-3 max-w-full',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div className="shrink-0">
        {isUser ? (
          <DsAvatar name={userName} size={28} />
        ) : (
          <div
            className="w-7 h-7 rounded-[8px] flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 max-w-[560px]">
        <div
          className={cn(
            'text-[11px] font-mono text-[var(--fg-subtle)] mb-1',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {isUser ? userName : 'UniLMS AI'} · {time || 'now'}
        </div>

        <div
          className={cn(
            'rounded-[12px] px-3.5 py-2.5 text-[13.5px] leading-[1.6] border',
            isUser
              ? 'bg-[var(--accent-100)] text-[var(--accent-900)] border-[var(--accent-200)] rounded-tr-[4px]'
              : 'bg-[var(--surface)] text-[var(--fg)] border-[var(--border-color)] rounded-tl-[4px]'
          )}
        >
          {children}
        </div>

        {citations && citations.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {citations.map((c, i) => (
              <a
                key={i}
                className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full
                           bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--fg-muted)]"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center
                             bg-[var(--accent-100)] text-[var(--accent-700)] font-mono text-[9px] font-semibold"
                >
                  {i + 1}
                </span>
                {c}
              </a>
            ))}
          </div>
        )}

        {!isUser && showActions && (
          <div className="flex gap-1 mt-2 text-[var(--fg-subtle)]">
            <BubbleAction icon={<Copy className="w-3.5 h-3.5" />} label={t.ui?.copy ?? 'Copy'} />
            <BubbleAction icon={<ThumbsUp className="w-3.5 h-3.5" />} label={t.ui?.thumbsUp ?? 'Helpful'} />
            <BubbleAction icon={<ThumbsDown className="w-3.5 h-3.5" />} label={t.ui?.thumbsDown ?? 'Not helpful'} />
            <BubbleAction icon={<RotateCcw className="w-3.5 h-3.5" />} label={t.ui?.retry ?? 'Retry'} />
          </div>
        )}
      </div>
    </div>
  );
}

function BubbleAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="p-1 rounded-[5px] bg-transparent text-inherit hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors duration-ds-fast"
    >
      {icon}
    </button>
  );
}
