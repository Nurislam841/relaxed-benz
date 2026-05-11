'use client';

import * as React from 'react';
import { Sparkles, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface QuizQuestion {
  prompt: string;
  options: string[];
  /** Index of correct option, 0-based */
  answer: number;
  type?: string;
  points?: number;
  explanation?: string;
}

interface QuizQuestionPreviewProps {
  question: QuizQuestion;
  number: number;
  /** When `true`, show user's pick locked in and reveal correct answer */
  revealed?: boolean;
  pickedIndex?: number | null;
  onPick?: (index: number) => void;
  className?: string;
}

/**
 * Quiz question card — used both in AI generation preview and student practice.
 */
export function QuizQuestionPreview({
  question,
  number,
  revealed,
  pickedIndex,
  onPick,
  className,
}: QuizQuestionPreviewProps) {
  const [internalPick, setInternalPick] = React.useState<number | null>(null);
  const pick = pickedIndex !== undefined ? pickedIndex : internalPick;
  const t = useT() as any;

  const handlePick = (i: number) => {
    if (revealed) return;
    if (onPick) onPick(i);
    else setInternalPick(i);
  };

  return (
    <div
      className={cn(
        'border border-[var(--border-color)] rounded-[10px] bg-[var(--surface)] p-4 relative',
        className
      )}
    >
      <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-100)] text-[var(--accent-700)] font-semibold">
          Q{number}
        </span>
        {question.type && <Badge tone="neutral" variant="soft">{question.type}</Badge>}
        <Badge tone="accent" variant="soft">
          <Sparkles className="w-2.5 h-2.5" />
          {t.ui?.aiGenerated ?? 'AI generated'}
        </Badge>
        {question.points !== undefined && (
          <span className="ml-auto font-mono text-[11px] text-[var(--fg-subtle)]">
            {question.points} {t.ui?.points ?? 'pts'}
          </span>
        )}
      </div>

      <div className="text-[14px] font-medium leading-[1.4] mb-3 text-[var(--fg)]">
        {question.prompt}
      </div>

      <div className="flex flex-col gap-1.5">
        {question.options.map((opt, i) => {
          const selected = pick === i;
          const isCorrect = question.answer === i;
          const showCorrect = revealed && isCorrect;
          const showWrong = revealed && selected && !isCorrect;

          return (
            <button
              key={i}
              type="button"
              onClick={() => handlePick(i)}
              disabled={revealed}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 text-left rounded-[7px] border font-sans text-[13px] text-[var(--fg)]',
                'transition-all duration-ds-fast',
                selected && !revealed
                  ? 'bg-[var(--accent-50)] border-[var(--accent-300)]'
                  : 'bg-[var(--surface)] border-[var(--border-color)]',
                showCorrect &&
                  'bg-[color:color-mix(in_oklch,var(--success),transparent_88%)] border-[var(--success)]',
                showWrong &&
                  'bg-[color:color-mix(in_oklch,var(--danger),transparent_88%)] border-[var(--danger)]',
                !revealed && 'hover:bg-[var(--bg-subtle)]'
              )}
            >
              <span
                className={cn(
                  'w-[18px] h-[18px] rounded-full inline-flex items-center justify-center shrink-0 text-white',
                  selected ? 'border-[1.5px] border-[var(--accent-500)] bg-[var(--accent-500)]'
                            : 'border-[1.5px] border-[var(--border-strong)] bg-transparent',
                  showCorrect && 'bg-[var(--success)] border-[var(--success)]'
                )}
              >
                {(selected || showCorrect) && <Check className="w-3 h-3" />}
              </span>
              <span className="flex-1 font-mono text-[11px] text-[var(--fg-subtle)] uppercase">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-[8] text-[var(--fg)]">{opt}</span>
              {showCorrect && <Badge tone="success" variant="soft">{t.ui?.correct ?? 'correct'}</Badge>}
            </button>
          );
        })}
      </div>

      {revealed && question.explanation && (
        <div className="mt-3 p-3 rounded-[8px] bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[12.5px] text-[var(--fg-muted)] leading-[1.55]">
          <div className="font-semibold text-[var(--fg)] mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[var(--accent-600)]" />
            {t.ui?.explanation ?? 'Explanation'}
          </div>
          {question.explanation}
        </div>
      )}
    </div>
  );
}
