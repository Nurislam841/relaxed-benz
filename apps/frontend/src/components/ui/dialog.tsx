'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type DialogContextValue = { titleId: string };
const DialogContext = React.createContext<DialogContextValue | null>(null);

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const titleId = React.useId();
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = contentRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousActive?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <DialogContext.Provider value={{ titleId }}>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
        <div
          className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-[2px] animate-in fade-in"
          aria-hidden="true"
          onClick={() => onOpenChange(false)}
        />
        <div
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            'relative z-50 mx-0 max-h-[90vh] w-full max-w-[480px] overflow-hidden',
            'rounded-t-[14px] sm:rounded-[14px] sm:mx-4',
            'border border-[var(--border-color)] bg-[var(--surface-raised)] text-[var(--fg)]',
            'shadow-ds-xl',
            'animate-in fade-in slide-in-from-bottom-2 duration-ds-base'
          )}
        >
          {children}
        </div>
      </div>
    </DialogContext.Provider>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative px-6 pt-5 pb-4 border-b border-[var(--border-color)] flex flex-col gap-1',
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const ctx = React.useContext(DialogContext);
  return (
    <h2
      id={ctx?.titleId}
      className={cn('text-[16px] font-semibold tracking-[-0.01em] text-[var(--fg)]', className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[13px] text-[var(--fg-muted)]', className)} {...props} />;
}

export function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close dialog"
      className={cn(
        'absolute right-4 top-4 rounded-md p-1 text-[var(--fg-subtle)]',
        'hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]',
        'focus-visible:outline-none focus-visible:shadow-ds-glow',
        'transition-colors duration-ds-fast'
      )}
    >
      <X className="h-4 w-4" />
    </button>
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-5 py-3.5 border-t border-[var(--border-color)] bg-[var(--bg-subtle)] flex gap-2 justify-end',
        className,
      )}
      {...props}
    />
  );
}
