'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Radio, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import type { SavedQuiz, SavedQuizQuestion } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea, Label } from '@/components/ui/form-elements';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { toast } from '@/hooks/use-toast';
import { QuizEditor, type EditableQuestion } from '@/components/quiz/quiz-editor';

/**
 * Convert a saved DB question into the editor's editable shape. The `id`
 * carries through so the diff-save step can tell "existing → PATCH" from
 * "new → POST".
 *
 * SavedQuizQuestion doesn't carry `difficulty` in the shared type — it isn't
 * needed by the play UI — so we read it lazily off the raw payload.
 */
function toEditable(q: SavedQuizQuestion & { difficulty?: string }): EditableQuestion {
  return {
    id: q.id,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation ?? '',
    points: q.points ?? 100,
    difficulty: (q.difficulty as EditableQuestion['difficulty']) ?? 'MEDIUM',
  };
}

/**
 * Compare two editable questions for "the teacher actually changed something
 * non-trivial". Comparing options array uses JSON-stringify — simple and
 * sufficient since option arrays are small and order-sensitive.
 */
function questionChanged(curr: EditableQuestion, prev: EditableQuestion): boolean {
  return (
    curr.question !== prev.question ||
    curr.correctIndex !== prev.correctIndex ||
    curr.explanation !== prev.explanation ||
    curr.points !== prev.points ||
    curr.difficulty !== prev.difficulty ||
    JSON.stringify(curr.options) !== JSON.stringify(prev.options)
  );
}

export default function QuizEditPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const router = useRouter();
  const { data: me } = useMe();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  // Snapshot of the loaded state — diffed against `questions` at save time
  const [initial, setInitial] = useState<EditableQuestion[]>([]);
  const [initialTitle, setInitialTitle] = useState('');
  const [initialDescription, setInitialDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const {
    data: quiz,
    isLoading,
    error,
  } = useQuery<SavedQuiz>({
    queryKey: ['quiz-edit', quizId],
    queryFn: () => api.get<SavedQuiz>(`/quizzes/${quizId}`),
    enabled: !!quizId,
  });

  useEffect(() => {
    if (!quiz) return;
    const editable = (quiz.questions ?? []).map(toEditable);
    setTitle(quiz.title);
    setDescription(quiz.description ?? '');
    setQuestions(editable);
    setInitial(editable.map((q) => ({ ...q, options: [...q.options] })));
    setInitialTitle(quiz.title);
    setInitialDescription(quiz.description ?? '');
  }, [quiz]);

  const isTeacher = me?.role === 'TEACHER' || me?.role === 'ADMIN';

  // Compute the diff each render — cheap (small N) and lets the UI show
  // "X changes" if we want it later.
  const diff = useMemo(() => {
    const prevById = new Map(initial.filter((q) => q.id).map((q) => [q.id!, q]));
    const currIds = new Set(questions.filter((q) => q.id).map((q) => q.id!));

    const toCreate: EditableQuestion[] = [];
    const toUpdate: EditableQuestion[] = [];
    for (const q of questions) {
      if (!q.id) {
        toCreate.push(q);
        continue;
      }
      const prev = prevById.get(q.id);
      if (prev && questionChanged(q, prev)) toUpdate.push(q);
    }
    const toDelete = initial.filter((q) => q.id && !currIds.has(q.id!)).map((q) => q.id!);
    const meta = title !== initialTitle || description !== initialDescription ? { title, description } : null;
    return { toCreate, toUpdate, toDelete, meta };
  }, [questions, initial, title, initialTitle, description, initialDescription]);

  const hasChanges = diff.toCreate.length + diff.toUpdate.length + diff.toDelete.length > 0 || diff.meta != null;

  /**
   * Pre-flight validation, identical rules to the create flow:
   * non-empty prompt, ≥2 options, no blank option, correctIndex in range.
   */
  const validate = (): string | null => {
    if (!title.trim()) return 'Quiz title cannot be empty.';
    if (questions.length === 0) return 'Add at least one question.';
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) return `Question ${i + 1} is empty.`;
      if (q.options.length < 2) return `Question ${i + 1} needs at least 2 options.`;
      if (q.options.some((o) => !o.trim())) return `Question ${i + 1} has an empty option.`;
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        return `Question ${i + 1}: pick a valid correct answer.`;
      }
    }
    return null;
  };

  /**
   * Apply the diff in this order:
   *   1. PATCH metadata (so subsequent calls still see the same quiz)
   *   2. DELETE removed questions (frees positions for any new ones)
   *   3. PATCH updated questions
   *   4. POST new questions (their position = old_max + 1 server-side)
   *
   * If any step fails the rest are skipped so the user can retry with a
   * still-coherent local state. We invalidate the listing query at the
   * end regardless.
   */
  const applyDiff = async () => {
    if (diff.meta) {
      await api.patch(`/quizzes/${quizId}`, diff.meta);
    }
    for (const id of diff.toDelete) {
      await api.delete(`/quiz-questions/${id}`);
    }
    for (const q of diff.toUpdate) {
      await api.patch(`/quiz-questions/${q.id}`, {
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        points: q.points,
        difficulty: q.difficulty,
      });
    }
    for (const q of diff.toCreate) {
      await api.post(`/quizzes/${quizId}/questions`, {
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        points: q.points,
        difficulty: q.difficulty,
      });
    }
  };

  const handleSave = async (thenHostLive = false) => {
    const err = validate();
    if (err) {
      toast({ title: 'Cannot save', description: err, variant: 'destructive' });
      return;
    }
    if (!hasChanges && !thenHostLive) {
      toast({ title: 'No changes to save.' });
      return;
    }
    setSaving(true);
    try {
      if (hasChanges) await applyDiff();
      qc.invalidateQueries({ queryKey: ['quizzes'] });
      qc.invalidateQueries({ queryKey: ['quiz-edit', quizId] });
      if (thenHostLive) {
        const session = await api.post<{ sessionId: string }>('/kahoot/sessions', { quizId });
        router.push(`/kahoot/host/${session.sessionId}`);
      } else {
        toast({ title: 'Changes saved.' });
        // Refresh the snapshot so subsequent edits diff cleanly against new state
        setInitial(questions.map((q) => ({ ...q, options: [...q.options] })));
        setInitialTitle(title);
        setInitialDescription(description);
      }
    } catch (e: any) {
      toast({
        title: 'Save failed',
        description: e?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center mt-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-500)]" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center space-y-3">
        <p className="text-[var(--fg-muted)]">Quiz not found or you don't have access.</p>
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5" /> Go back
        </Button>
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center space-y-3">
        <p className="text-[var(--fg-muted)]">Only teachers and admins can edit quizzes.</p>
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5" /> Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="space-y-2">
        <Eyebrow>Quiz Editor</Eyebrow>
        <HDisplay size="md" as="h1">
          Edit <em>{quiz.title}</em>
        </HDisplay>
        <p className="text-[14px] text-[var(--fg-muted)]">
          Tweak questions, change the correct answer, reorder — then save, or save and host live immediately.
        </p>
      </div>

      {/* Top-level metadata */}
      <Card padding="md" className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="quiz-title">Title</Label>
          <Input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quiz-desc">
            Description <span className="text-[var(--fg-subtle)] font-normal">(optional)</span>
          </Label>
          <Textarea
            id="quiz-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            disabled={saving}
          />
        </div>
      </Card>

      <QuizEditor questions={questions} onChange={setQuestions} disabled={saving} />

      {/* Action footer */}
      <Card padding="md" className="sticky bottom-4 z-10 shadow-ds-md">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <Button variant="ghost" onClick={() => router.back()} disabled={saving}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <div className="flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
            {hasChanges ? (
              <span>
                {diff.toCreate.length} new · {diff.toUpdate.length} edited · {diff.toDelete.length} removed
                {diff.meta ? ' · title/desc' : ''}
              </span>
            ) : (
              <span className="italic">No changes</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving || !hasChanges}>
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button variant="ai" onClick={() => handleSave(true)} disabled={saving || questions.length === 0}>
              <Radio className="h-3.5 w-3.5" />
              {saving ? 'Starting…' : 'Save & Host live'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
