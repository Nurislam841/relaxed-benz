'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';

interface SuggestionStripProps {
  suggestions: string[];
  onPick?: (suggestion: string) => void;
  className?: string;
}

/**
 * Horizontal scrolling chip list of AI prompts.
 */
export function SuggestionStrip({ suggestions, onPick, className }: SuggestionStripProps) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto py-1 scrollbar-hide ${className ?? ''}`}
    >
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick?.(s)}
          className="shrink-0 px-3 py-1.5 inline-flex items-center gap-1.5
                     bg-[var(--surface)] border border-[var(--border-color)]
                     rounded-full text-[12px] text-[var(--fg-muted)] font-sans
                     hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]
                     transition-colors duration-ds-fast"
        >
          <Sparkles className="w-2.5 h-2.5 text-[var(--accent-500)]" />
          {s}
        </button>
      ))}
    </div>
  );
}
