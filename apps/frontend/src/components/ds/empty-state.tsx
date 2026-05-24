import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Lucide icon component or any ReactNode (e.g. a custom SVG). */
  icon?: React.ElementType;
  /** Primary message — keep short, one sentence. */
  title: string;
  /** Supporting copy — what to do next, or context. */
  description?: ReactNode;
  /** Optional action — usually a <Button> wrapped here. */
  action?: ReactNode;
  className?: string;
  /** Smaller variant for inside cards / sidebars. */
  compact?: boolean;
}

/**
 * Consistent empty-state component. Used everywhere a list might be empty —
 * dashboard widgets, search results, notifications, achievements, quizzes.
 *
 * Design:
 *  - Icon rendered in a soft circular badge with a subtle ring — feels
 *    intentional rather than "broken state".
 *  - Title is the primary message; description gives context.
 *  - Action button (if provided) gives the user something to do — much
 *    better than dead-end "no items" text.
 *
 * Why no per-page bespoke SVG illustrations:
 *  - Inline SVG illustrations add weight (each ~5KB) and force coordination
 *    between dark/light themes.
 *  - Lucide icons already cover the conceptual space (Inbox, Search, Bell,
 *    BookOpen, etc.) and inherit theme colors automatically.
 */
export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center gap-3 mx-auto',
        compact ? 'py-6 max-w-xs' : 'py-12 max-w-sm',
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            'rounded-full bg-[var(--bg-subtle)] flex items-center justify-center',
            'ring-1 ring-[var(--border-color)]',
            compact ? 'h-10 w-10' : 'h-14 w-14',
          )}
        >
          <Icon className={cn('text-[var(--fg-subtle)]', compact ? 'h-4 w-4' : 'h-6 w-6')} aria-hidden />
        </div>
      )}
      <div className="space-y-1">
        <p className={cn('font-medium text-[var(--fg)]', compact ? 'text-[13px]' : 'text-[14px]')}>{title}</p>
        {description && (
          <p className={cn('text-[var(--fg-muted)] leading-snug', compact ? 'text-[11px]' : 'text-[12.5px]')}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
