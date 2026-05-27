'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  RotateCcw,
  Trophy,
  Brain,
  ArrowRight,
  Radio,
  PlayCircle,
  ArrowLeft,
  Plus,
  Upload,
  FileText,
  X,
  Loader2,
} from 'lucide-react';
import { celebrate } from '@/lib/celebrate';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import type { AiQuiz, QuizQuestion, SavedQuiz } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/form-elements';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useLanguage, useT } from '@/lib/i18n';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { Stat } from '@/components/ds/stat';
import { DsProgress } from '@/components/ds/progress';
import { SuggestionStrip } from '@/components/ai/suggestion-strip';
import { GenerationPanel, type GenStep } from '@/components/ai/generation-panel';
import { QuizQuestionPreview } from '@/components/ai/quiz-question-preview';
import { QuizLibrary } from '@/components/quiz/quiz-library';
import { QuizEditor, type EditableQuestion } from '@/components/quiz/quiz-editor';
import { cn } from '@/lib/utils';

/**
 * Quiz Studio modes:
 *   config     — pick topic/count/difficulty
 *   generating — Claude is working
 *   editor     — teacher reviews + tweaks AI output; can Save as draft, Host
 *                live, or Play to test (jumps to quiz mode)
 *   quiz       — self-test play-through (local-only, no DB writes)
 *   results    — post-play summary
 */
type QuizMode = 'config' | 'generating' | 'editor' | 'quiz' | 'results';

/**
 * Translate an AI-generated question into the editor's editable shape.
 * Difficulty defaults to MEDIUM if the AI omitted it (older payloads).
 */
function aiToEditable(q: QuizQuestion): EditableQuestion {
  return {
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    points: 100,
    difficulty: ((q as any).difficulty as EditableQuestion['difficulty']) ?? 'MEDIUM',
    // AI doesn't propose a per-question time — start everyone at 30s,
    // teacher can fine-tune in the editor before Save / Host live.
    secondsPerQuestion: 30,
  };
}

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: user } = useMe();
  const t = useT();
  const { lang } = useLanguage();
  const qc = useQueryClient();

  const [topic, setTopic] = useState('');
  const [count, setCount] = useState('5');
  // Feature #1.5: per-difficulty breakdown calculator. Default split
  // matches a medium-difficulty 5-question quiz so existing flows keep
  // working out of the box. Validation: sum(easy+medium+hard) MUST equal
  // total questionCount, otherwise Generate is disabled.
  const [easyCount, setEasyCount] = useState('1');
  const [mediumCount, setMediumCount] = useState('3');
  const [hardCount, setHardCount] = useState('1');

  // Feature #1: uploaded lecture material (PDF / DOCX / TXT) becomes the
  // AI's primary context for question generation. When set, the resulting
  // quiz is anchored to the teacher's actual lecture rather than generic
  // knowledge of the topic.
  const [materialText, setMaterialText] = useState<string>('');
  const [materialMeta, setMaterialMeta] = useState<{
    filename: string;
    rawCharCount: number;
    truncated: boolean;
    kind: 'pdf' | 'docx' | 'text';
    // Persisted on the quiz so end-of-game Telegram can stream the
    // raw file back to students via the "Get study material" button.
    materialKey?: string;
    materialMime?: string;
  } | null>(null);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const materialFileRef = useRef<HTMLInputElement>(null);

  const [quiz, setQuiz] = useState<AiQuiz | null>(null);
  /**
   * Editable copy of the questions used while we're in `editor` mode. Kept
   * separate from `quiz` (which is what gets played in `quiz` mode) so that
   * a quick "Play to test" round in the editor doesn't surprise-mutate the
   * teacher's in-progress edits.
   */
  const [editable, setEditable] = useState<EditableQuestion[]>([]);
  // When set, the quiz came from a saved record — disable "Save to library" button
  const [loadedFromLibraryId, setLoadedFromLibraryId] = useState<string | null>(null);
  const [mode, setMode] = useState<QuizMode>('config');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [current, setCurrent] = useState(0);
  const [steps, setSteps] = useState<GenStep[]>([]);

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  /**
   * Validate the editor state and turn it into a CreateQuizDto payload.
   * Throws a user-facing Error if validation fails — the caller catches
   * it inside a mutation and shows a toast.
   */
  const buildCreatePayload = (isPublished: boolean) => {
    if (editable.length === 0) {
      throw new Error('Add at least one question before saving.');
    }
    for (let i = 0; i < editable.length; i++) {
      const q = editable[i];
      if (!q.question.trim()) throw new Error(`Question ${i + 1} is empty.`);
      if (q.options.length < 2) throw new Error(`Question ${i + 1} needs at least 2 options.`);
      if (q.options.some((o) => !o.trim())) throw new Error(`Question ${i + 1} has an empty option.`);
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        throw new Error(`Question ${i + 1}: pick the correct answer.`);
      }
    }
    return {
      title: topic || t.courseQuiz.title,
      description: '',
      source: 'AI_GENERATED' as const,
      isPublished,
      secondsPerQuestion: 30,
      // Persist source-material on the quiz (Feature: TG "Get study
      // material" button + Personalized study guide). Only included
      // if the teacher uploaded a lecture file in this session — both
      // the raw file (key) and the extracted text are saved so the
      // bot can stream the file AND the AI can read the text without
      // re-parsing the PDF on every callback.
      ...(materialMeta?.materialKey
        ? {
            sourceMaterialKey: materialMeta.materialKey,
            sourceMaterialFileName: materialMeta.filename,
            sourceMaterialMime: materialMeta.materialMime,
            sourceMaterialText: materialText,
          }
        : {}),
      questions: editable.map((q) => ({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        points: q.points,
        difficulty: q.difficulty,
        // Persist per-question time-limit so Kahoot replay reads the
        // teacher's pick instead of falling back to the 30s default.
        secondsPerQuestion: q.secondsPerQuestion ?? 30,
      })),
    };
  };

  // "Save as draft" — persist into the library; teacher can publish later.
  const saveAsDraft = useMutation({
    mutationFn: async () => {
      const payload = buildCreatePayload(false);
      return api.post<{ id: string }>(`/courses/${id}/quizzes`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quizzes', id] });
      toast({ title: t.courseQuiz.savedToLibrary });
      setLoadedFromLibraryId('saved');
      setMode('config'); // bounce back to library view
    },
    onError: (e: Error) => toast({ title: t.common.error, description: e.message, variant: 'destructive' }),
  });

  // "Save & Host live" — single click from editor straight to live host page.
  // Creates the quiz (drafted), then spins up a Kahoot session, then redirects.
  const saveAndHostLive = useMutation({
    mutationFn: async () => {
      const payload = buildCreatePayload(false);
      const quiz = await api.post<{ id: string }>(`/courses/${id}/quizzes`, payload);
      const session = await api.post<{ sessionId: string; joinCode: string }>('/kahoot/sessions', { quizId: quiz.id });
      return session;
    },
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: ['quizzes', id] });
      router.push(`/kahoot/host/${session.sessionId}`);
    },
    onError: (e: Error) => toast({ title: t.common.error, description: e.message, variant: 'destructive' }),
  });

  // Open a saved quiz from the library — fetch its questions and jump into play mode
  const handlePlaySaved = async (quizId: string) => {
    try {
      const saved = await api.get<SavedQuiz>(`/quizzes/${quizId}`);
      if (!saved.questions?.length) {
        toast({ title: t.courseQuiz.emptyQuizError, variant: 'destructive' });
        return;
      }
      // Students get correctIndex=-1; reveal logic only matters at submission time.
      // For local play, we still need the index for scoring — teachers/admins get it.
      setQuiz({
        questions: saved.questions.map((q) => ({
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })),
      });
      setLoadedFromLibraryId(quizId);
      setTopic(saved.title);
      setAnswers({});
      setCurrent(0);
      setMode('quiz');
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: 'destructive' });
    }
  };
  const difficultyLabel = {
    easy: t.courseQuiz.easy,
    medium: t.courseQuiz.medium,
    hard: t.courseQuiz.hard,
  };
  // Calculator-derived state for the AI Studio config card AND for the
  // in-quiz play badge below. Placed up here so both `handleGenerate`
  // and the render branches see the same source of truth.
  const totalN = parseInt(count) || 0;
  const easyN = parseInt(easyCount) || 0;
  const mediumN = parseInt(mediumCount) || 0;
  const hardN = parseInt(hardCount) || 0;
  const sumByLevel = easyN + mediumN + hardN;
  const calculatorValid = totalN > 0 && sumByLevel === totalN;
  const calculatorDelta = sumByLevel - totalN; // signed; negative = need more, positive = too many
  // Dominant tier — what the play badge shows. If easy/medium tie we
  // prefer medium (matches old default behaviour), hard wins outright.
  const dominantDifficulty: 'easy' | 'medium' | 'hard' =
    easyN >= mediumN && easyN >= hardN ? 'easy' : hardN > mediumN ? 'hard' : 'medium';

  /**
   * Upload a lecture file (PDF / DOCX / TXT) and stash the extracted text
   * so the next /ai/generate-quiz call can use it as context. We bypass
   * the api.ts wrapper here because it doesn't handle multipart payloads.
   */
  const handleMaterialUpload = async (file: File) => {
    setUploadingMaterial(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch('/api/ai/extract-text', { method: 'POST', body: form, credentials: 'include' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: `Error ${r.status}` }));
        throw new Error(err.message || `Error ${r.status}`);
      }
      const data = (await r.json()) as {
        text: string;
        rawCharCount: number;
        truncated: boolean;
        kind: 'pdf' | 'docx' | 'text';
        materialKey?: string;
        materialFileName?: string;
        materialMime?: string;
      };
      setMaterialText(data.text);
      setMaterialMeta({
        filename: file.name,
        rawCharCount: data.rawCharCount,
        truncated: data.truncated,
        kind: data.kind,
        materialKey: data.materialKey,
        materialMime: data.materialMime,
      });
      toast({
        title: 'Material loaded',
        description: `Extracted ${data.text.length.toLocaleString()} characters from ${file.name}${
          data.truncated ? ' (truncated)' : ''
        }`,
      });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingMaterial(false);
      if (materialFileRef.current) materialFileRef.current.value = '';
    }
  };

  const clearMaterial = () => {
    setMaterialText('');
    setMaterialMeta(null);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({ title: t.courseQuiz.enterTopic, variant: 'destructive' });
      return;
    }
    if (!calculatorValid) {
      toast({
        title: 'Введите корректные числа',
        description: `Сумма по уровням (${sumByLevel}) должна равняться общему количеству вопросов (${totalN}).`,
        variant: 'destructive',
      });
      return;
    }
    setMode('generating');
    setSteps([
      { status: 'active', label: 'Analyzing course context', detail: `topic="${topic}"` },
      { status: 'pending', label: `Drafting ${count} questions` },
      { status: 'pending', label: 'Validating schema' },
    ]);

    // animate fake step progression while real request is in-flight
    const t1 = setTimeout(() => {
      setSteps((s) =>
        s.map((x, i) => (i === 0 ? { ...x, status: 'done', time: '0.4s' } : i === 1 ? { ...x, status: 'active' } : x)),
      );
    }, 600);

    try {
      const result = await api.post<AiQuiz>('/ai/generate-quiz', {
        courseId: id,
        topic,
        questionCount: totalN,
        // Per-level breakdown is the source of truth in the new UX.
        // Backend will reject if these don't sum to questionCount.
        easyCount: easyN,
        mediumCount: mediumN,
        hardCount: hardN,
        // Carry a dominant-tier difficulty hint for adaptive-mode storage,
        // derived from whichever level got the most questions.
        difficulty: easyN >= mediumN && easyN >= hardN ? 'easy' : hardN > mediumN ? 'hard' : 'medium',
        lang,
        ...(materialText ? { materialText } : {}),
      });
      clearTimeout(t1);
      setSteps((s) =>
        s.map((x, i) =>
          i === 0
            ? { ...x, status: 'done', time: '0.4s' }
            : i === 1
              ? { ...x, status: 'done', time: '1.8s' }
              : { ...x, status: 'done', time: '0.1s' },
        ),
      );
      setQuiz(result);
      setEditable(result.questions.map(aiToEditable));
      setLoadedFromLibraryId(null); // fresh AI generation — Save button enabled
      setAnswers({});
      setCurrent(0);
      // Land in editor mode so teacher can fix typos / swap answers / reorder
      // before deciding to Save as draft or Host live. Small delay so the
      // user sees all progress steps complete first.
      setTimeout(() => setMode('editor'), 400);
    } catch (e: any) {
      clearTimeout(t1);
      setSteps((s) => s.map((x, i) => (x.status === 'active' ? { ...x, status: 'error' } : x)));
      toast({ title: t.courseQuiz.failedGenerate, description: e.message, variant: 'destructive' });
      setTimeout(() => setMode('config'), 1500);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (answers[current] !== undefined) return;
    setAnswers((p) => ({ ...p, [current]: optionIndex }));
  };

  const handleNext = () => {
    if (!quiz) return;
    if (current + 1 >= quiz.questions.length) {
      // Celebrate only on a clean sweep — partial scores get the normal
      // results UI without the visual reward.
      const correct = quiz.questions.filter((q, i) => answers[i] === q.correctIndex).length;
      if (correct === quiz.questions.length) celebrate();
      setMode('results');
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const handleReset = () => {
    setMode('config');
    setQuiz(null);
    setEditable([]);
    setLoadedFromLibraryId(null);
    setAnswers({});
    setCurrent(0);
    setSteps([]);
  };

  /**
   * Manual entry point — alternative to AI generation. Teacher clicks
   * "+ Create blank quiz" and lands in the editor with one empty question
   * pre-filled, then fills everything in by hand. From the editor's
   * perspective there's no difference between AI-generated and manual
   * quizzes — both go through the same Save / Host-live actions.
   */
  const handleCreateBlank = () => {
    setEditable([
      {
        question: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        explanation: '',
        points: 100,
        difficulty: 'MEDIUM',
        secondsPerQuestion: 30,
      },
    ]);
    setLoadedFromLibraryId(null);
    setTopic('Untitled quiz');
    setMode('editor');
  };

  const score = quiz ? quiz.questions.filter((q, i) => answers[i] === q.correctIndex).length : 0;
  const pct = quiz ? Math.round((score / quiz.questions.length) * 100) : 0;
  const verdict = pct >= 80 ? 'excellent' : pct >= 60 ? 'good' : 'study';

  // ── CONFIG MODE ──────────────────────────────
  if (mode === 'config' || mode === 'generating') {
    return (
      <div className="max-w-2xl space-y-7">
        <div className="space-y-3">
          <Eyebrow>{isTeacher ? 'AI Quiz Studio' : 'Quizzes'}</Eyebrow>
          <HDisplay size="md" as="h1">
            {isTeacher ? (
              <>
                Generate a quiz on <em>any</em> topic
              </>
            ) : (
              <>
                Practice with <em>your</em> course quizzes
              </>
            )}
          </HDisplay>
          <p className="text-[14px] text-[var(--fg-muted)] max-w-[60ch]">
            {isTeacher ? t.courseQuiz.teacherSubtitle : t.courseQuiz.studentSubtitle}
          </p>
        </div>

        {/* Saved quiz library — visible to everyone; teachers can edit/publish/delete */}
        {mode === 'config' && <QuizLibrary courseId={id} isTeacher={isTeacher} onPlay={handlePlaySaved} />}

        {/* Manual entry shortcut — teacher creates a quiz from scratch
            without using AI. Lands in the same editor; the rest of the
            flow (Start to test, Host live) is identical between manual
            and AI-generated quizzes. */}
        {isTeacher && mode === 'config' && (
          <Card padding="md">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <p className="text-[13px] font-semibold text-[var(--fg)]">Build it yourself</p>
                <p className="text-[12px] text-[var(--fg-muted)]">
                  Skip the AI — write questions, options and answers manually.
                </p>
              </div>
              <Button variant="secondary" onClick={handleCreateBlank}>
                <Plus className="h-3.5 w-3.5" />
                Create blank quiz
              </Button>
            </div>
          </Card>
        )}

        {/* AI Studio (Generate panel + suggestions) — teachers/admins only.
            Students would get a 403 on /ai/generate-quiz + on
            POST /courses/:id/quizzes anyway; hiding the UI matches the
            backend ACL and removes the dead-end button. */}
        {isTeacher &&
          (mode === 'generating' ? (
            <GenerationPanel title="Generating quiz" steps={steps} />
          ) : (
            <Card padding="lg">
              <div className="space-y-4">
                {/* Lecture upload — Feature #1. Optional; when set, the AI
                    grounds every question in this material instead of
                    relying on generic knowledge of the topic. */}
                <div className="space-y-1.5">
                  <Label>Lecture material (optional)</Label>
                  {materialMeta ? (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border-color)] bg-[var(--surface-subtle)] px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-[var(--accent-600)] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate">{materialMeta.filename}</p>
                          <p className="text-[11px] text-[var(--fg-muted)] font-mono">
                            {materialMeta.kind.toUpperCase()} · {materialMeta.rawCharCount.toLocaleString()} chars
                            {materialMeta.truncated ? ' · truncated to 200k' : ''}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearMaterial} title="Remove material">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="material-upload"
                      className="flex items-center justify-center gap-2 rounded-md border border-dashed border-[var(--border-color)] bg-[var(--surface-subtle)] px-3 py-3 text-[13px] text-[var(--fg-muted)] cursor-pointer hover:bg-[var(--surface-hover)] hover:border-[var(--accent-400)] transition-colors"
                    >
                      {uploadingMaterial ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Extracting text…</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" />
                          <span>Upload lecture (PDF, DOCX, TXT) — AI will use it as context</span>
                        </>
                      )}
                      <input
                        ref={materialFileRef}
                        id="material-upload"
                        type="file"
                        accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                        className="hidden"
                        disabled={uploadingMaterial}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleMaterialUpload(f);
                        }}
                      />
                    </label>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="topic">{t.courseQuiz.topic}</Label>
                  <Input
                    id="topic"
                    placeholder={t.courseQuiz.topicPlaceholder}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  />
                </div>

                {/* Per-level calculator (Feature #1.5). Total count is
                    a free-form number; below it the teacher splits the
                    quiz across difficulty tiers. Sum must equal total,
                    Generate is disabled until it does. */}
                <div className="space-y-1.5">
                  <Label htmlFor="total-questions">Total questions</Label>
                  <Input
                    id="total-questions"
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Difficulty breakdown</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={easyCount}
                        onChange={(e) => setEasyCount(e.target.value)}
                        aria-label="Easy count"
                      />
                      <p className="text-[11px] text-[var(--fg-muted)] font-mono uppercase tracking-wide">Easy</p>
                    </div>
                    <div className="space-y-1">
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={mediumCount}
                        onChange={(e) => setMediumCount(e.target.value)}
                        aria-label="Medium count"
                      />
                      <p className="text-[11px] text-[var(--fg-muted)] font-mono uppercase tracking-wide">Medium</p>
                    </div>
                    <div className="space-y-1">
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={hardCount}
                        onChange={(e) => setHardCount(e.target.value)}
                        aria-label="Hard count"
                      />
                      <p className="text-[11px] text-[var(--fg-muted)] font-mono uppercase tracking-wide">Hard</p>
                    </div>
                  </div>

                  {/* Calculator status — green when sum matches, red with
                      a delta hint when it doesn't. Mirrors the backend
                      BadRequest message so the teacher only sees one
                      framing of the rule. */}
                  <div
                    className={cn(
                      'text-[12px] font-mono px-2 py-1.5 rounded-md',
                      calculatorValid
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
                    )}
                  >
                    {calculatorValid ? (
                      <>
                        ✓ Sum {sumByLevel} = total {totalN}
                      </>
                    ) : (
                      <>
                        ⚠️ Sum {sumByLevel} ≠ total {totalN}
                        {calculatorDelta !== 0 && (
                          <span>
                            {' '}
                            (введите корректные числа:{' '}
                            {calculatorDelta > 0 ? `-${calculatorDelta}` : `+${-calculatorDelta}`} до совпадения)
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <Button
                  variant="ai"
                  size="lg"
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={!topic.trim() || !calculatorValid}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t.courseQuiz.generateQuiz}
                </Button>
              </div>
            </Card>
          ))}

        {/* Topic suggestions — also teachers only (paired with the AI Studio above) */}
        {isTeacher && mode === 'config' && (
          <div className="space-y-2.5">
            <Eyebrow>Suggested topics</Eyebrow>
            <SuggestionStrip
              suggestions={[
                'SQL Joins & Aggregation',
                'Entity-Relationship Diagrams',
                'Normalization (1NF–3NF)',
                'Indexing & Query Optimization',
                'Transactions & ACID',
                'NoSQL vs Relational',
              ]}
              onPick={setTopic}
            />
          </div>
        )}
      </div>
    );
  }

  // ── RESULTS MODE ────────────────────────────
  if (mode === 'results' && quiz) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Eyebrow>Results</Eyebrow>
          <HDisplay size="md" as="h1">
            {pct}% —{' '}
            {verdict === 'excellent' ? (
              <em>excellent</em>
            ) : verdict === 'good' ? (
              <em>good effort</em>
            ) : (
              <em>keep studying</em>
            )}
          </HDisplay>
        </div>

        <Card padding="lg">
          <div className="grid grid-cols-3 gap-6">
            <div className="flex flex-col items-center gap-2">
              <Trophy
                className="h-9 w-9"
                style={{
                  color: pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--fg-subtle)',
                }}
              />
              <Badge tone={verdict === 'excellent' ? 'success' : verdict === 'good' ? 'warning' : 'danger'}>
                {verdict === 'excellent'
                  ? t.courseQuiz.excellent
                  : verdict === 'good'
                    ? t.courseQuiz.goodEffort
                    : t.courseQuiz.keepStudying}
              </Badge>
            </div>
            <Stat label="Score" value={`${score}/${quiz.questions.length}`} />
            <Stat label="Accuracy" value={`${pct}%`} />
          </div>
          <div className="mt-5">
            <DsProgress
              value={pct}
              tone={pct >= 80 ? 'success' : pct >= 60 ? 'warning' : 'danger'}
              showPercent={false}
            />
          </div>
        </Card>

        <div className="space-y-3">
          <Eyebrow>Question review</Eyebrow>
          {quiz.questions.map((q: QuizQuestion, i) => (
            <QuizQuestionPreview
              key={i}
              number={i + 1}
              revealed
              pickedIndex={answers[i] ?? null}
              question={{
                prompt: q.question,
                options: q.options,
                answer: q.correctIndex,
                explanation: q.explanation,
                type: 'multiple-choice',
              }}
            />
          ))}
        </div>

        {/* Back to editor if we came from there — lets teacher tweak the quiz
            after seeing how it actually plays through. */}
        {isTeacher && editable.length > 0 && (
          <Button variant="secondary" size="lg" className="w-full" onClick={() => setMode('editor')}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to editor
          </Button>
        )}

        <Button variant="ghost" size="lg" className="w-full" onClick={handleReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          {t.courseQuiz.newQuiz}
        </Button>
      </div>
    );
  }

  // ── EDITOR MODE — teacher tweaks AI output, then Save or Host live ──
  if (mode === 'editor' && isTeacher) {
    const busy = saveAndHostLive.isPending;
    return (
      <div className="max-w-3xl space-y-5">
        <div className="space-y-2">
          <Eyebrow>Quiz Editor</Eyebrow>
          <HDisplay size="md" as="h1">
            Build your quiz, then <em>start</em> or go <em>live</em>
          </HDisplay>
          <p className="text-[14px] text-[var(--fg-muted)] max-w-[60ch]">
            Edit any field, swap the correct answer, reorder, or add/remove questions. <strong>Start</strong> lets you
            play-test it yourself. <strong>Host live</strong> saves the quiz and opens a Kahoot session for students.
          </p>
        </div>

        {/* Title at the top so teacher can rename before save */}
        <Card padding="md">
          <div className="space-y-1.5">
            <Label htmlFor="quiz-title">Quiz title</Label>
            <Input
              id="quiz-title"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. SQL Joins — Practice quiz"
            />
          </div>
        </Card>

        <QuizEditor questions={editable} onChange={setEditable} disabled={busy} />

        {/* Action footer — two primary actions per user requirement.
            'Save as draft' was removed: 'Host live' implicitly persists the
            quiz before opening a session, so a separate save isn't needed.
            'Start over' lives as a small ghost link in the left so the
            teacher can wipe and begin again without searching. */}
        <Card padding="md" className="sticky bottom-4 z-10 shadow-ds-md">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <Button variant="ghost" onClick={handleReset} disabled={busy} size="sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              Start over
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  // Refresh `quiz` from current editable state so play mode
                  // sees the latest edits, then jump to local play-through
                  // — purely for the teacher to sanity-check answers, no
                  // DB write.
                  setQuiz({
                    questions: editable.map((q) => ({
                      question: q.question,
                      options: q.options,
                      correctIndex: q.correctIndex,
                      explanation: q.explanation,
                    })),
                  });
                  setAnswers({});
                  setCurrent(0);
                  setMode('quiz');
                }}
                disabled={busy || editable.length === 0}
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Start (test)
              </Button>
              <Button variant="ai" onClick={() => saveAndHostLive.mutate()} disabled={busy || editable.length === 0}>
                <Radio className="h-3.5 w-3.5" />
                {saveAndHostLive.isPending ? 'Starting…' : 'Host live'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ── QUIZ MODE ────────────────────────────────
  if (!quiz) return null;
  const q: QuizQuestion = quiz.questions[current];
  const answered = answers[current] !== undefined;
  const isLast = current + 1 >= quiz.questions.length;

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Eyebrow>
            Question {current + 1} {t.courseQuiz.of} {quiz.questions.length}
          </Eyebrow>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-[var(--accent-600)]" />
            <span className="text-[15px] font-semibold text-[var(--fg)]">{topic || t.courseQuiz.title}</span>
          </div>
        </div>
        <Badge tone="accent" variant="soft">
          {difficultyLabel[dominantDifficulty]}
        </Badge>
      </div>

      <DsProgress value={current + 1} max={quiz.questions.length} showPercent={false} label={null as any} />

      <QuizQuestionPreview
        number={current + 1}
        revealed={answered}
        pickedIndex={answers[current] ?? null}
        onPick={handleAnswer}
        question={{
          prompt: q.question,
          options: q.options,
          answer: q.correctIndex,
          explanation: q.explanation,
          type: 'multiple-choice',
        }}
      />

      {answered && (
        <Button variant="primary" size="lg" className="w-full" onClick={handleNext}>
          {isLast ? t.courseQuiz.seeResults : t.courseQuiz.nextQuestion}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
