import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatProps {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaTone?: 'up' | 'down';
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * KPI stat — used in dashboards & admin analytics.
 *
 *   <Stat label="GPA" value="3.84" delta="0.08" sub="of 4.00" />
 */
export function Stat({ label, value, delta, deltaTone = 'up', sub, icon, className }: StatProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--fg-subtle)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[28px] font-semibold tracking-[-0.02em] tabular-nums text-[var(--fg)]">
          {value}
        </span>
        {delta && (
          <span
            className="text-[11px] font-mono"
            style={{ color: deltaTone === 'down' ? 'var(--danger)' : 'var(--success)' }}
          >
            {deltaTone === 'down' ? '↓' : '↑'} {delta}
          </span>
        )}
      </div>
      {sub && <div className="text-[12px] text-[var(--fg-muted)]">{sub}</div>}
    </div>
  );
}
