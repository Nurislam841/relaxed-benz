import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, r) => (
    <textarea
      ref={r}
      className={cn(
        'flex min-h-[64px] w-full rounded-[7px]',
        'border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2',
        'text-[13px] text-[var(--fg)] shadow-ds-xs',
        'placeholder:text-[var(--fg-subtle)]',
        'transition-[border-color,box-shadow] duration-ds-fast ease-ds-out',
        'focus-visible:outline-none focus-visible:border-[var(--accent-500)] focus-visible:shadow-ds-glow',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'resize-y',
        className
      )}
      {...p}
    />
  )
);
Textarea.displayName = 'Textarea';

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...p }, r) => (
    <label
      ref={r}
      className={cn('text-[12px] font-medium leading-none text-[var(--fg)]', className)}
      {...p}
    />
  )
);
Label.displayName = 'Label';

/** Shimmer skeleton — uses DS accent shimmer */
function Skeleton({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[7px] bg-[var(--bg-muted)] overflow-hidden relative',
        className
      )}
      {...p}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </div>
  );
}

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...p }, r) => (
    <select
      ref={r}
      className={cn(
        'flex h-[calc(32px*var(--density))] w-full rounded-[7px]',
        'border border-[var(--border-strong)] bg-[var(--surface)] px-[10px]',
        'text-[13px] text-[var(--fg)] shadow-ds-xs',
        'transition-[border-color,box-shadow] duration-ds-fast ease-ds-out',
        'focus-visible:outline-none focus-visible:border-[var(--accent-500)] focus-visible:shadow-ds-glow',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...p}
    />
  )
);
Select.displayName = 'Select';

export { Textarea, Label, Skeleton, Select };
