import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  max?: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  label?: React.ReactNode;
  showPercent?: boolean;
  className?: string;
}

const toneMap = {
  accent: 'var(--accent-600)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
};

/**
 * DS Progress bar — slim, with optional label + percent.
 *
 *   <Progress value={62} label="Complete" />
 */
export function DsProgress({
  value,
  max = 100,
  tone = 'accent',
  label,
  showPercent = true,
  className,
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={className}>
      {(label || showPercent) && (
        <div className="flex justify-between items-baseline text-[11px] text-[var(--fg-muted)] mb-1">
          {label && <span>{label}</span>}
          {showPercent && <span className="font-mono tabular-nums">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-ds-slow ease-ds-out"
          style={{
            width: `${pct}%`,
            background: toneMap[tone],
          }}
        />
      </div>
    </div>
  );
}
