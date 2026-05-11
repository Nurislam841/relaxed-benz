'use client';

import * as React from 'react';
import { Sparkles, Check, Edit, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface FeedbackCriterion {
  label: string;
  /** Score 1..5 */
  score: number;
}

interface AIFeedbackPanelProps {
  /** Numeric score (e.g., 87 of 100) */
  score?: number | string;
  scoreLabel?: string;
  feedback: React.ReactNode;
  criteria?: FeedbackCriterion[];
  /** Show as draft awaiting teacher review */
  draft?: boolean;
  onApply?: () => void;
  onEdit?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * AI grading suggestion — used in submission review for assignment-feedback.
 */
export function AIFeedbackPanel({
  score,
  scoreLabel = 'SCORE',
  feedback,
  criteria,
  draft = true,
  onApply,
  onEdit,
  onDismiss,
  className,
}: AIFeedbackPanelProps) {
  const t = useT() as any;
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[12px] border border-[var(--border-color)] p-4',
        className
      )}
      style={{
        background: 'linear-gradient(180deg, var(--accent-50), var(--surface))',
      }}
    >
      {/* glow orb */}
      <span
        aria-hidden
        className="absolute -top-5 -right-5 w-[120px] h-[120px] rounded-full pointer-events-none opacity-60"
        style={{
          background: 'radial-gradient(circle, var(--accent-200), transparent 60%)',
        }}
      />

      <div className="relative flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-[7px] flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))' }}
          >
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-[13px] font-semibold text-[var(--fg)]">
            {t.ui?.aiGrading ?? 'AI grading suggestion'}
          </span>
          {draft && <Badge tone="accent" variant="soft">{t.ui?.draft ?? 'draft'}</Badge>}
        </div>
        {score != null && (
          <div className="text-right">
            <div className="font-mono text-[11px] text-[var(--fg-subtle)]">{scoreLabel}</div>
            <div className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--fg)]">
              {score}
            </div>
          </div>
        )}
      </div>

      <div className="text-[13px] text-[var(--fg)] leading-[1.55]">{feedback}</div>

      {criteria && criteria.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-3">
          {criteria.map((c, i) => (
            <div key={i} className="flex justify-between items-center text-[12px]">
              <span className="text-[var(--fg-muted)]">{c.label}</span>
              <div className="flex gap-px">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className="w-3.5 h-[5px] rounded-[1px]"
                    style={{
                      background:
                        n <= c.score ? 'var(--accent-600)' : 'var(--bg-muted)',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 mt-3.5">
        {onApply && (
          <Button variant="primary" size="sm" onClick={onApply}>
            <Check className="w-3 h-3" />
            {t.ui?.applySuggestion ?? 'Apply suggestion'}
          </Button>
        )}
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit className="w-3 h-3" />
            {t.ui?.edit ?? 'Edit'}
          </Button>
        )}
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="w-3 h-3" />
            {t.ui?.dismiss ?? 'Dismiss'}
          </Button>
        )}
      </div>
    </div>
  );
}
