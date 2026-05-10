'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabItem<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'underline' | 'pill';
  className?: string;
}

/**
 * DS Tabs — underline (default) or pill style.
 */
export function DsTabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = 'underline',
  className,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex',
        variant === 'underline'
          ? 'border-b border-[var(--border-color)]'
          : 'gap-1 p-[3px] bg-[var(--bg-muted)] rounded-[8px] w-fit',
        className
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 font-medium font-sans',
              'transition-all duration-ds-fast ease-ds-out',
              variant === 'underline'
                ? cn(
                    'px-3.5 py-2.5 text-[13px] -mb-px',
                    active ? 'text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                  )
                : cn(
                    'px-3 py-1.5 text-[13px] rounded-[6px]',
                    active
                      ? 'bg-[var(--surface)] text-[var(--fg)] shadow-ds-xs'
                      : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                  )
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  'font-mono text-[10px] px-1.5 rounded',
                  active
                    ? 'bg-[var(--accent-100)] text-[var(--accent-700)]'
                    : 'bg-[var(--bg-muted)] text-[var(--fg-subtle)]'
                )}
              >
                {t.count}
              </span>
            )}
            {variant === 'underline' && active && (
              <span
                aria-hidden
                className="absolute left-3.5 right-3.5 -bottom-px h-[2px] bg-[var(--accent-600)] rounded-[2px]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
