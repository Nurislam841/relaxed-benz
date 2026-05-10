import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-[calc(32px*var(--density))] w-full rounded-[7px]',
        'border border-[var(--border-strong)] bg-[var(--surface)] px-[10px]',
        'text-[13px] text-[var(--fg)] shadow-ds-xs',
        'placeholder:text-[var(--fg-subtle)]',
        'transition-[border-color,box-shadow] duration-ds-fast ease-ds-out',
        'focus-visible:outline-none focus-visible:border-[var(--accent-500)] focus-visible:shadow-ds-glow',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
