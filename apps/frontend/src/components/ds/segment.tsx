'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface SegmentProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Segmented control — like iOS pill switcher.
 *
 *   <Segment value="all" onChange={set} options={[
 *     { value: 'all', label: 'All' },
 *     { value: 'mine', label: 'Mine' },
 *   ]}/>
 */
export function Segment<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: SegmentProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex p-[3px] gap-[2px] rounded-[7px]',
        'bg-[var(--bg-muted)] border border-[var(--border-color)]',
        className
      )}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[5px] font-medium font-sans',
              'transition-all duration-ds-fast ease-ds-out',
              size === 'sm' ? 'text-[11.5px] px-2.5 py-1' : 'text-[12.5px] px-3 py-1.5',
              active
                ? 'bg-[var(--surface)] text-[var(--fg)] shadow-ds-xs'
                : 'bg-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
