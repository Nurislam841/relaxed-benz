import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Kbd — keyboard shortcut hint.
 *
 *   <Kbd>⌘</Kbd><Kbd>K</Kbd>
 */
export function Kbd({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-block font-mono text-[10px] leading-none',
        'px-[5px] py-[2px] rounded-[4px]',
        'border border-[var(--border-strong)] border-b-2',
        'bg-[var(--surface)] text-[var(--fg-muted)]',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
