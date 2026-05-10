import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * UniLMS DS Card — surface with border + radius-lg.
 * Use `hoverable` for interactive cards (lift on hover).
 */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const padMap: Record<NonNullable<CardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-ds-lg border border-[var(--border-color)] bg-[var(--surface)] text-[var(--fg)]',
        'transition-[box-shadow,border-color] duration-ds-base ease-ds-out',
        padding && padMap[padding],
        hoverable && 'hover:border-[var(--border-strong)] hover:shadow-ds-md',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...p }, r) => (
    <div ref={r} className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...p} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...p }, r) => (
    <h3
      ref={r}
      className={cn('text-[16px] font-semibold leading-tight tracking-[-0.01em] text-[var(--fg)]', className)}
      {...p}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...p }, r) => (
    <p ref={r} className={cn('text-[13px] text-[var(--fg-muted)]', className)} {...p} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...p }, r) => <div ref={r} className={cn('p-5 pt-0', className)} {...p} />
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...p }, r) => (
    <div
      ref={r}
      className={cn(
        'px-5 py-3 border-t border-[var(--border-color)] bg-[var(--bg-subtle)] flex gap-2 justify-end',
        className
      )}
      {...p}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
