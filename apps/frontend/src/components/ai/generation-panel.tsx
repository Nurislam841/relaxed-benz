'use client';

import * as React from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type GenStepStatus = 'pending' | 'active' | 'done' | 'error';

export interface GenStep {
  status: GenStepStatus;
  label: string;
  detail?: string;
  time?: string;
}

interface GenerationPanelProps {
  title?: string;
  steps: GenStep[];
  className?: string;
}

/**
 * Multi-step progress for AI generation.
 *
 *   <GenerationPanel title="Generating quiz" steps={[
 *     { status: 'done', label: 'Analyzing topic', time: '0.4s' },
 *     { status: 'active', label: 'Drafting questions' },
 *     { status: 'pending', label: 'Validating' },
 *   ]}/>
 */
export function GenerationPanel({ title, steps, className }: GenerationPanelProps) {
  const t = useT() as any;
  const heading = title ?? t.ui?.generating ?? 'Generating';
  const done = steps.filter((s) => s.status === 'done').length;

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-600)]" />
          <span className="text-[13px] font-semibold text-[var(--fg)]">{heading}</span>
        </div>
        <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
          {done}/{steps.length}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {steps.map((s, i) => (
          <GenStepRow key={i} {...s} />
        ))}
      </div>
    </Card>
  );
}

function GenStepRow({ status, label, detail, time }: GenStep) {
  const map = {
    done: {
      icon: <Check className="w-3 h-3" />,
      color: 'var(--success)',
      bg: 'color-mix(in oklch, var(--success), transparent 80%)',
    },
    active: {
      icon: <span className="ai-spin" />,
      color: 'var(--accent-600)',
      bg: 'var(--accent-100)',
    },
    pending: {
      icon: (
        <span
          className="w-2 h-2 rounded-full block"
          style={{ background: 'var(--border-strong)' }}
        />
      ),
      color: 'var(--fg-subtle)',
      bg: 'var(--bg-muted)',
    },
    error: {
      icon: <X className="w-3 h-3" />,
      color: 'var(--danger)',
      bg: 'color-mix(in oklch, var(--danger), transparent 80%)',
    },
  } as const;
  const m = map[status];

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-[7px] transition-colors duration-ds-base',
        status === 'active' && 'bg-[var(--accent-50)]'
      )}
    >
      <span
        className="w-[18px] h-[18px] rounded-full inline-flex items-center justify-center shrink-0"
        style={{ background: m.bg, color: m.color }}
      >
        {m.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-[13px]',
            status === 'pending' ? 'text-[var(--fg-subtle)]' : 'text-[var(--fg)]',
            status === 'active' && 'font-medium'
          )}
        >
          {label}
        </div>
        {detail && (
          <div className="text-[11.5px] text-[var(--fg-subtle)] font-mono mt-0.5">{detail}</div>
        )}
      </div>
      {time && (
        <span className="font-mono text-[11px] text-[var(--fg-subtle)]">{time}</span>
      )}
    </div>
  );
}
