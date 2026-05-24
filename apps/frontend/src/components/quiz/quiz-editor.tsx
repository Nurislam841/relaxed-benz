'use client';

import { useCallback } from 'react';
import { Trash2, ArrowUp, ArrowDown, Plus, CheckCircle2, Circle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea, Label, Select } from '@/components/ui/form-elements';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { cn } from '@/lib/utils';

/**
 * Editable shape of a quiz question used by the Quiz Editor.
 *
 *   - `id` present → question already exists in the DB (PATCH on save).
 *   - `id` undefined → freshly added in the editor (POST on save).
 *
 * Difficulty is part of every question because the Adaptive mode reads it
 * to step difficulty up/down based on streaks. Don't drop it from the UI.
 */
export interface EditableQuestion {
  id?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  points: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

interface QuizEditorProps {
  questions: EditableQuestion[];
  onChange: (qs: EditableQuestion[]) => void;
  /** Optional title rendered above the list — defaults to "Questions". */
  heading?: string;
  /** Disable all controls (useful when an async save is in flight). */
  disabled?: boolean;
}

const DIFFICULTY_TONE: Record<EditableQuestion['difficulty'], string> = {
  EASY: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30',
  MEDIUM:
    'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30',
  HARD: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30',
};

const OPTION_COLORS = [
  'bg-rose-500/10 border-rose-300 dark:border-rose-500/40',
  'bg-sky-500/10 border-sky-300 dark:border-sky-500/40',
  'bg-amber-500/10 border-amber-300 dark:border-amber-500/40',
  'bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40',
];

function emptyQuestion(): EditableQuestion {
  return {
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
    points: 100,
    difficulty: 'MEDIUM',
  };
}

/**
 * Inline list editor for quiz questions. Used in two places:
 *  - Quiz Studio after AI generation (Save / Host live flows)
 *  - /quizzes/[id]/edit page for saved quizzes
 *
 * Editing is always inline — no modals — so the teacher can scan the whole
 * quiz at once. This matches the kahoot.com pattern and avoids context
 * switching the user out of the list.
 *
 * Validation is intentionally lenient here (only `correctIndex` is forced
 * in-range when options change). Empty questions / options are flagged
 * visually but not blocked — the saving page decides what to do.
 */
export function QuizEditor({ questions, onChange, heading = 'Questions', disabled }: QuizEditorProps) {
  const updateAt = useCallback(
    (index: number, patch: Partial<EditableQuestion>) => {
      const next = [...questions];
      next[index] = { ...next[index], ...patch };
      // Keep correctIndex in range if options length changed
      if (patch.options && next[index].correctIndex >= patch.options.length) {
        next[index].correctIndex = Math.max(0, patch.options.length - 1);
      }
      onChange(next);
    },
    [questions, onChange],
  );

  const removeAt = useCallback(
    (index: number) => {
      const next = questions.filter((_, i) => i !== index);
      onChange(next);
    },
    [questions, onChange],
  );

  const move = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= questions.length) return;
      const next = [...questions];
      [next[index], next[target]] = [next[target], next[index]];
      onChange(next);
    },
    [questions, onChange],
  );

  const addQuestion = useCallback(() => {
    onChange([...questions, emptyQuestion()]);
  }, [questions, onChange]);

  const updateOption = useCallback(
    (qi: number, oi: number, value: string) => {
      const opts = [...questions[qi].options];
      opts[oi] = value;
      updateAt(qi, { options: opts });
    },
    [questions, updateAt],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Eyebrow>{heading}</Eyebrow>
        <span className="text-[12px] text-[var(--fg-muted)]">
          {questions.length} {questions.length === 1 ? 'question' : 'questions'}
        </span>
      </div>

      {questions.length === 0 && (
        <Card padding="md" className="border-dashed text-center text-[13px] text-[var(--fg-muted)]">
          No questions yet. Click <strong>+ Add question</strong> below to start.
        </Card>
      )}

      <div className="space-y-3">
        {questions.map((q, qi) => (
          <Card key={q.id ?? `new-${qi}`} padding="md" className="space-y-3">
            {/* Header row: number + difficulty + reorder/delete controls */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--fg-subtle)]">Q{qi + 1}</span>
                <span
                  className={cn(
                    'text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border',
                    DIFFICULTY_TONE[q.difficulty],
                  )}
                >
                  {q.difficulty}
                </span>
                {q.id == null && (
                  <Badge tone="accent" variant="soft">
                    NEW
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled || qi === 0}
                  onClick={() => move(qi, -1)}
                  title="Move up"
                  aria-label="Move question up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled || qi === questions.length - 1}
                  onClick={() => move(qi, 1)}
                  title="Move down"
                  aria-label="Move question down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => {
                    if (confirm('Delete this question?')) removeAt(qi);
                  }}
                  title="Delete question"
                  aria-label="Delete question"
                  className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Question text */}
            <div className="space-y-1.5">
              <Label htmlFor={`q-${qi}-text`}>Question</Label>
              <Textarea
                id={`q-${qi}-text`}
                value={q.question}
                onChange={(e) => updateAt(qi, { question: e.target.value })}
                placeholder="Write the question…"
                rows={2}
                disabled={disabled}
              />
            </div>

            {/* Options with radio for correct answer */}
            <div className="space-y-1.5">
              <Label>Answer options — click the circle to mark the correct one</Label>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => {
                  const isCorrect = q.correctIndex === oi;
                  return (
                    <div
                      key={oi}
                      className={cn(
                        'flex items-center gap-2 rounded-[7px] border p-2',
                        OPTION_COLORS[oi % OPTION_COLORS.length],
                        isCorrect && 'ring-2 ring-emerald-400 dark:ring-emerald-500/60',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => updateAt(qi, { correctIndex: oi })}
                        disabled={disabled}
                        className="shrink-0 p-0.5 rounded-full hover:bg-white/40 dark:hover:bg-white/10 transition-colors"
                        title={isCorrect ? 'Correct answer' : 'Mark as correct'}
                        aria-label={isCorrect ? 'Correct answer selected' : 'Mark this option as correct'}
                      >
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Circle className="h-4 w-4 text-[var(--fg-muted)]" />
                        )}
                      </button>
                      <span className="font-mono text-[11px] text-[var(--fg-subtle)] w-4 shrink-0">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <Input
                        value={opt}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        disabled={disabled}
                        className="flex-1"
                      />
                      {q.options.length > 2 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={disabled}
                          onClick={() => {
                            const opts = q.options.filter((_, i) => i !== oi);
                            updateAt(qi, { options: opts });
                          }}
                          title="Remove this option"
                          aria-label="Remove option"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              {q.options.length < 8 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => updateAt(qi, { options: [...q.options, ''] })}
                  className="text-[12px]"
                >
                  <Plus className="h-3 w-3" /> Add option
                </Button>
              )}
            </div>

            {/* Difficulty + points + explanation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`q-${qi}-diff`}>Difficulty</Label>
                <Select
                  id={`q-${qi}-diff`}
                  value={q.difficulty}
                  onChange={(e) => updateAt(qi, { difficulty: e.target.value as EditableQuestion['difficulty'] })}
                  disabled={disabled}
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`q-${qi}-pts`}>Points</Label>
                <Input
                  id={`q-${qi}-pts`}
                  type="number"
                  min={1}
                  value={q.points}
                  onChange={(e) => updateAt(qi, { points: Math.max(1, parseInt(e.target.value) || 100) })}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`q-${qi}-exp`}>
                Explanation <span className="text-[var(--fg-subtle)] font-normal">(optional)</span>
              </Label>
              <Textarea
                id={`q-${qi}-exp`}
                value={q.explanation}
                onChange={(e) => updateAt(qi, { explanation: e.target.value })}
                placeholder="Shown to students after they answer…"
                rows={2}
                disabled={disabled}
              />
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button type="button" variant="secondary" onClick={addQuestion} disabled={disabled}>
          <Plus className="h-3.5 w-3.5" /> Add question
        </Button>
      </div>
    </div>
  );
}

export { emptyQuestion };
