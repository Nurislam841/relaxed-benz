'use client';

import { ReactNode, useState, useRef, useEffect, useId, cloneElement, isValidElement } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  /** Single React element to wrap. Tooltip is mounted next to it as a sibling. */
  children: ReactNode;
  /** Tooltip body content — string or any ReactNode. */
  content: ReactNode;
  /** Where to position the tooltip relative to the trigger. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional keyboard shortcut hint, e.g. ⌘K, displayed in a kbd-styled box. */
  shortcut?: string;
  /** ms delay before showing on hover. Default 250ms — matches GitHub/Linear. */
  delay?: number;
}

/**
 * Hand-rolled tooltip.
 *
 * Why not radix-ui or floating-ui:
 *  - radix would add ~15KB and another peer dep tree.
 *  - We only need static positioning relative to a trigger, no collision
 *    detection — our triggers (sidebar icons, action buttons) sit in
 *    predictable layout slots.
 *  - Keeping accessibility manually (role=tooltip + aria-describedby) is
 *    cheap enough for one component.
 *
 * Accessibility:
 *  - `role="tooltip"` + unique id linked via `aria-describedby`.
 *  - Both hover AND focus trigger reveal (keyboard users get tooltips too).
 *  - Esc dismisses while focused on the trigger.
 *  - When `prefers-reduced-motion` is set, the fade-in is removed via CSS.
 */
export function Tooltip({ children, content, side = 'top', shortcut, delay = 250 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  // Clear timer on unmount to avoid setState after unmount warnings
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };

  const sideClasses: Record<NonNullable<TooltipProps['side']>, string> = {
    top: 'bottom-full mb-1.5 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-1.5 left-1/2 -translate-x-1/2',
    left: 'right-full mr-1.5 top-1/2 -translate-y-1/2',
    right: 'left-full ml-1.5 top-1/2 -translate-y-1/2',
  };

  // Clone the single child so we can attach hover/focus handlers and aria-describedby
  // without forcing callers to wrap with extra <span>s.
  const child = isValidElement(children)
    ? cloneElement(children as React.ReactElement, {
        'aria-describedby': open ? id : undefined,
        onMouseEnter: (e: React.MouseEvent) => {
          show();
          (children.props as any).onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          hide();
          (children.props as any).onMouseLeave?.(e);
        },
        onFocus: (e: React.FocusEvent) => {
          show();
          (children.props as any).onFocus?.(e);
        },
        onBlur: (e: React.FocusEvent) => {
          hide();
          (children.props as any).onBlur?.(e);
        },
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Escape') hide();
          (children.props as any).onKeyDown?.(e);
        },
      })
    : children;

  return (
    <span className="relative inline-flex">
      {child}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'absolute z-50 whitespace-nowrap pointer-events-none',
            'px-2 py-1 rounded-md shadow-ds-md',
            'bg-[var(--fg)] text-[var(--bg)] text-[12px] font-medium',
            'flex items-center gap-1.5',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            'motion-reduce:animate-none',
            sideClasses[side],
          )}
        >
          <span>{content}</span>
          {shortcut && (
            <kbd
              className="font-mono text-[10px] px-1 py-0.5 rounded border border-[var(--bg)]/30 bg-[var(--bg)]/10"
              aria-hidden
            >
              {shortcut}
            </kbd>
          )}
        </span>
      )}
    </span>
  );
}
