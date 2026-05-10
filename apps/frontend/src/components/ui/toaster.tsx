'use client';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const toneMap = {
  default: { color: 'var(--info)', Icon: Info },
  success: { color: 'var(--success)', Icon: CheckCircle2 },
  warning: { color: 'var(--warning)', Icon: AlertTriangle },
  destructive: { color: 'var(--danger)', Icon: AlertCircle },
} as const;

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const variant = (t.variant ?? 'default') as keyof typeof toneMap;
        const tone = toneMap[variant] ?? toneMap.default;
        const Icon = tone.Icon;
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto relative flex items-start gap-3 rounded-ds-md border',
              'border-[var(--border-color)] bg-[var(--surface-raised)] text-[var(--fg)]',
              'min-w-[320px] py-3 pl-4 pr-3 shadow-ds-lg',
              'animate-in slide-in-from-bottom-5 duration-ds-base ease-ds-out',
              'overflow-hidden'
            )}
          >
            <span
              aria-hidden
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ background: tone.color }}
            />
            <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: tone.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold leading-tight">{t.title}</p>
              {t.description && (
                <p className="text-[12px] text-[var(--fg-muted)] mt-1 leading-snug">
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors p-0.5 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
