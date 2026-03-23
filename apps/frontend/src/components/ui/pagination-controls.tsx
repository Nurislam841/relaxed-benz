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
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{t.common.page} {page}</span>
        <span className="ml-2">{itemsCount} {t.common.resultsOnPage}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onPrevious} disabled={!hasPrevious || isLoading} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" />
          {t.common.previous}
        </Button>
        <Button size="sm" variant="outline" onClick={onNext} disabled={!hasNext || isLoading} className="gap-1.5">
          {t.common.next}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
