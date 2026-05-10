'use client';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * UniLMS DS Button
 * Variants: primary | secondary | ghost | danger | ai | outline | link
 * Sizes:    sm | md | lg | icon
 */
const bv = cva(
  [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
    'rounded-[7px] border font-medium tracking-[-0.005em]',
    'transition-[background,border-color,box-shadow,transform] duration-ds-fast ease-ds-out',
    'focus-visible:outline-none focus-visible:shadow-ds-glow',
    'disabled:opacity-50 disabled:pointer-events-none',
    'select-none',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--accent-600)] text-[var(--fg-on-accent)] border-[var(--accent-700)] shadow-ds-xs hover:bg-[var(--accent-700)] active:translate-y-px',
        secondary:
          'bg-[var(--surface)] text-[var(--fg)] border-[var(--border-strong)] shadow-ds-xs hover:bg-[var(--bg-subtle)]',
        ghost:
          'bg-transparent text-[var(--fg-muted)] border-transparent hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]',
        danger:
          'bg-[var(--danger)] text-white border-[color:color-mix(in_oklch,var(--danger),black_20%)] hover:opacity-90',
        ai:
          'text-white border-[var(--accent-700)] shadow-ds-xs bg-[linear-gradient(135deg,var(--accent-600),var(--accent-500))] hover:shadow-[var(--shadow-sm),0_0_0_4px_color-mix(in_oklch,var(--accent-500),transparent_75%)]',
        outline:
          'bg-transparent text-[var(--fg)] border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
        link:
          'bg-transparent border-transparent text-[var(--accent-700)] underline-offset-4 hover:underline',
        // legacy aliases kept so existing call-sites don't break
        default:
          'bg-[var(--accent-600)] text-[var(--fg-on-accent)] border-[var(--accent-700)] shadow-ds-xs hover:bg-[var(--accent-700)]',
        destructive:
          'bg-[var(--danger)] text-white border-[color:color-mix(in_oklch,var(--danger),black_20%)] hover:opacity-90',
      },
      size: {
        sm: 'h-[calc(26px*var(--density))] px-2.5 text-[12px]',
        md: 'h-[calc(32px*var(--density))] px-3 text-[13px]',
        lg: 'h-[calc(38px*var(--density))] px-4 text-[14px]',
        icon: 'h-[calc(32px*var(--density))] w-[calc(32px*var(--density))] p-0',
        // legacy
        default: 'h-[calc(32px*var(--density))] px-3 text-[13px]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof bv> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(bv({ variant, size }), className)}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-full border-[1.5px] border-current border-t-transparent animate-[ds-spin_0.7s_linear_infinite] opacity-80"
        />
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

export { Button, bv as buttonVariants };
