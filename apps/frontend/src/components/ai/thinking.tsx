'use client';

import * as React from 'react';

/**
 * Thinking indicator — three pulsing dots with optional label.
 *
 *   <ThinkingDots label="Generating" />
 */
export function ThinkingDots({ label = 'Thinking' }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-[var(--fg-muted)] text-[12.5px]">
      <span className="inline-flex gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[5px] h-[5px] rounded-full bg-[var(--accent-500)]"
            style={{
              animation: `ai-pulse 1.2s ${i * 0.15}s infinite ease-in-out`,
            }}
          />
        ))}
      </span>
      <span className="font-mono">{label}…</span>
    </div>
  );
}
