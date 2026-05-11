'use client';

import * as React from 'react';
import { Sparkles, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ds/kbd';
import { useT } from '@/lib/i18n';

interface AIComposerProps {
  placeholder?: string;
  suggestions?: string[];
  onSend?: (value: string) => void;
  disabled?: boolean;
}

/**
 * AI chat composer — multi-line textarea with chip suggestions and ⌘↵ hint.
 */
export function AIComposer({
  placeholder,
  suggestions = [],
  onSend,
  disabled,
}: AIComposerProps) {
  const t = useT() as any;
  const ph = placeholder ?? t.ui?.composerPlaceholder ?? 'Ask anything…';
  const sendLabel = t.ui?.composerSend ?? 'Send';
  const [val, setVal] = React.useState('');

  const handleSend = () => {
    if (!val.trim() || disabled) return;
    onSend?.(val);
    setVal('');
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border border-[var(--border-strong)] rounded-[14px] bg-[var(--surface)] p-3 shadow-ds-sm">
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKey}
        placeholder={ph}
        rows={2}
        disabled={disabled}
        className="w-full border-none outline-none resize-none bg-transparent text-[var(--fg)]
                   text-[14px] font-sans leading-[1.5] p-1 placeholder:text-[var(--fg-subtle)]"
      />
      <div className="flex justify-between items-center mt-2 flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setVal(s)}
              className="text-[11.5px] px-2.5 py-1 inline-flex items-center gap-1
                         bg-[var(--bg-muted)] border border-[var(--border-color)]
                         rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]
                         transition-colors duration-ds-fast"
            >
              <Sparkles className="w-2.5 h-2.5" />
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 items-center">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
          <Button variant="ai" size="sm" onClick={handleSend} disabled={!val.trim() || disabled}>
            <ArrowUp className="w-3 h-3" />
            {sendLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
