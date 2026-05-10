import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Display heading — Instrument Serif italic with em-accent in violet.
 *
 * Usage:
 *   <HDisplay>Learning <em>Operating</em> System</HDisplay>
 */
interface HDisplayProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'text-[24px] sm:text-[28px]',
  md: 'text-[28px] sm:text-[34px]',
  lg: 'text-[36px] sm:text-[44px]',
  xl: 'text-[44px] sm:text-[56px]',
};

export function HDisplay({
  as: Tag = 'h1',
  size = 'lg',
  className,
  children,
  ...props
}: HDisplayProps) {
  return (
    <Tag
      className={cn(
        'font-serif font-normal leading-[1.05] tracking-[-0.02em] text-[var(--fg)] m-0',
        '[&_em]:not-italic [&_em]:italic [&_em]:text-[var(--accent-600)]',
        sizeMap[size],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
