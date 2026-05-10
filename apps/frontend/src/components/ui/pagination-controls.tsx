'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

type PaginationControlsProps = {
  page: number;
  itemsCount: number;
  pageSize?: number;
  totalItems?: number;
  hasNext?: boolean;
  isLoading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export function PaginationControls({
  page,
  itemsCount,
  pageSize,
  totalItems: _totalItems,
  hasNext: hasNextProp,
  isLoading,
  onPrevious,
  onNext,
}: PaginationControlsProps) {
  const t = useT();
  const hasPrevious = page > 1;
  const hasNext = hasNextProp !== undefined ? hasNextProp : itemsCount >= (pageSize ?? itemsCount + 1);

  return (
    <div className="flex flex-col gap-3 rounded-ds-lg border border-[var(--border-color)] bg-[var(--bg-subtle)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
        <span className="font-mono uppercase tracking-[0.08em] text-[10px] text-[var(--fg-subtle)]">
          {t.common.page}
        </span>
        <span className="font-mono tabular-nums text-[var(--fg)]">{page}</span>
        <span className="text-[var(--fg-subtle)]">·</span>
        <span className="font-mono tabular-nums text-[var(--fg-muted)]">
          {itemsCount} {t.common.resultsOnPage}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="secondary" onClick={onPrevious} disabled={!hasPrevious || isLoading}>
          <ChevronLeft className="h-3.5 w-3.5" />
          {t.common.previous}
        </Button>
        <Button size="sm" variant="secondary" onClick={onNext} disabled={!hasNext || isLoading}>
          {t.common.next}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
