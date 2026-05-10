import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Eyebrow — uppercase mono label above section headings.
 * "01 — Foundations" / "OVERVIEW" / "DASHBOARD"
 */
export function Eyebrow({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
