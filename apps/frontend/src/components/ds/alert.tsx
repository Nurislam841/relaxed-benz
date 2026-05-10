import * as React from 'react';
import { cn } from '@/lib/utils';

interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

const toneStyles = {
  info: {
    bg: 'bg-[color:color-mix(in_oklch,var(--info),transparent_92%)]',
    border: 'border-[color:color-mix(in_oklch,var(--info),transparent_75%)]',
    fg: 'text-[var(--info)]',
  },
  success: {
    bg: 'bg-[color:color-mix(in_oklch,var(--success),transparent_92%)]',
    border: 'border-[color:color-mix(in_oklch,var(--success),transparent_75%)]',
    fg: 'text-[var(--success)]',
  },
  warning: {
    bg: 'bg-[color:color-mix(in_oklch,var(--warning),transparent_90%)]',
    border: 'border-[color:color-mix(in_oklch,var(--warning),transparent_75%)]',
    fg: 'text-[var(--warning)]',
  },
  danger: {
    bg: 'bg-[color:color-mix(in_oklch,var(--danger),transparent_92%)]',
    border: 'border-[color:color-mix(in_oklch,var(--danger),transparent_75%)]',
    fg: 'text-[var(--danger)]',
  },
};

/**
 * DS Alert — soft-tinted banner for inline messages.
 */
export function Alert({ tone = 'info', title, icon, action, className, children }: AlertProps) {
  const t = toneStyles[tone];
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 px-3 py-2.5 rounded-ds-md border',
        t.bg,
        t.border,
        className
      )}
      role="alert"
    >
      {icon && <span className={cn('mt-0.5 shrink-0', t.fg)}>{icon}</span>}
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold text-[13px] text-[var(--fg)]">{title}</div>}
        {children && (
          <div className={cn('text-[12.5px] text-[var(--fg-muted)]', title && 'mt-0.5')}>
            {children}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}
