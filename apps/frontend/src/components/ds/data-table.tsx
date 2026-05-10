import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DataColumn<T> {
  key: keyof T | string;
  label: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  mono?: boolean;
  muted?: boolean;
  nowrap?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  dense?: boolean;
  className?: string;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
}

/**
 * DS DataTable — uppercase mono headers, hover row, mono numeric cells.
 */
export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  dense,
  className,
  onRowClick,
  emptyState,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        'border border-[var(--border-color)] rounded-ds-md overflow-hidden bg-[var(--surface)]',
        className
      )}
    >
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-color)]">
            {columns.map((c) => (
              <th
                key={String(c.key)}
                className={cn(
                  'font-mono uppercase font-medium tracking-[0.08em] text-[10px] text-[var(--fg-subtle)]',
                  dense ? 'px-3 py-2' : 'px-3.5 py-2.5'
                )}
                style={{
                  textAlign: c.align ?? 'left',
                  width: c.width,
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && emptyState && (
            <tr>
              <td colSpan={columns.length} className="p-6 text-center text-[var(--fg-muted)]">
                {emptyState}
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'transition-colors duration-ds-fast',
                'hover:bg-[var(--bg-subtle)]',
                onRowClick && 'cursor-pointer',
                i < rows.length - 1 && 'border-b border-[var(--border-color)]'
              )}
            >
              {columns.map((c) => {
                const raw = row[c.key as keyof T];
                const content = c.render ? c.render(raw, row) : (raw as React.ReactNode);
                return (
                  <td
                    key={String(c.key)}
                    className={cn(
                      dense ? 'px-3 py-2' : 'px-3.5 py-3',
                      c.mono ? 'font-mono tabular-nums' : 'font-sans',
                      c.muted ? 'text-[var(--fg-muted)]' : 'text-[var(--fg)]',
                      c.nowrap && 'whitespace-nowrap'
                    )}
                    style={{ textAlign: c.align ?? 'left' }}
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
