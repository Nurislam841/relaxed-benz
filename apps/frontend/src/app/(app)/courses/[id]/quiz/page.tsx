'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, RotateCcw, Trophy, Brain, ArrowRight, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import type { AiQuiz, QuizQuestion, SavedQuiz } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, Select } from '@/components/ui/form-elements';
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
import { cn } from '@/lib/utils';

type QuizMode = 'config' | 'generating' | 'quiz' | 'results';

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useMe();
  const t = useT();
  const { lang } = useLanguage();
  const qc = useQueryClient();

  const [topic, setTopic] = useState('');
  const [count, setCount] = useState('5');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  const [quiz, setQuiz] = useState<AiQuiz | null>(null);
  // When set, the quiz came from a saved record — disable "Save to library" button
  const [loadedFromLibraryId, setLoadedFromLibraryId] = useState<string | null>(null);
  const [mode, setMode] = useState<QuizMode>('config');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [current, setCurrent] = useState(0);
  const [steps, setSteps] = useState<GenStep[]>([]);

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  // Save the currently-displayed AI-generated quiz into the persistent library
  // so the teacher can publish it for students later. The default title is
  // derived from the topic the teacher entered.
  const saveAiQuiz = useMutation({
    mutationFn: async () => {
      if (!quiz) throw new Error('No quiz');
      await api.post(`/courses/${id}/quizzes`, {
        title: topic || t.courseQuiz.title,
        description: '',
        source: 'AI_GENERATED',
        isPublished: false,
        secondsPerQuestion: 30,
        questions: quiz.questions.map((q) => ({
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          points: 100,
        })),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quizzes', id] });
      toast({ title: t.courseQuiz.savedToLibrary });
      setLoadedFromLibraryId('saved'); // disable button
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

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({ title: t.courseQuiz.enterTopic, variant: 'destructive' });
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
      setSteps((s) => s.map((x, i) => (i === 0 ? { ...x, status: 'done', time: '0.4s' } : i === 1 ? { ...x, status: 'active' } : x)));
    }, 600);

    try {
      const result = await api.post<AiQuiz>('/ai/generate-quiz', {
        courseId: id,
        topic,
        questionCount: parseInt(count),
        difficulty,
        lang,
      });
      clearTimeout(t1);
      setSteps((s) =>
        s.map((x, i) =>
          i === 0
            ? { ...x, status: 'done', time: '0.4s' }
            : i === 1
            ? { ...x, status: 'done', time: '1.8s' }
            : { ...x, status: 'done', time: '0.1s' }
        )
      );
      setQuiz(result);
      setLoadedFromLibraryId(null); // fresh AI generation — Save button enabled
      setAnswers({});
      setCurrent(0);
      // small delay to let user see all steps complete
      setTimeout(() => setMode('quiz'), 400);
    } catch (e: any) {
      clearTimeout(t1);
      setSteps((s) =>
        s.map((x, i) => (x.status === 'active' ? { ...x, status: 'error' } : x))
      );
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
      setMode('results');
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const handleReset = () => {
    setMode('config');
    setQuiz(null);
    setLoadedFromLibraryId(null);
    setAnswers({});
    setCurrent(0);
    setSteps([]);
  };

  const score = quiz
    ? quiz.questions.filter((q, i) => answers[i] === q.correctIndex).length
    : 0;
  const pct = quiz ? Math.round((score / quiz.questions.length) * 100) : 0;
  const verdict = pct >= 80 ? 'excellent' : pct >= 60 ? 'good' : 'study';

  // ── CONFIG MODE ──────────────────────────────
  if (mode === 'config' || mode === 'generating') {
    return (
      <div className="max-w-2xl space-y-7">
        <div className="space-y-3">
          <Eyebrow>AI Quiz Studio</Eyebrow>
          <HDisplay size="md" as="h1">
            Generate a quiz on <em>any</em> topic
          </HDisplay>
          <p className="text-[14px] text-[var(--fg-muted)] max-w-[60ch]">
            {isTeacher ? t.courseQuiz.teacherSubtitle : t.courseQuiz.studentSubtitle}
          </p>
        </div>

        {/* Saved quiz library — visible to everyone; teachers can edit/publish/delete */}
        {mode === 'config' && (
          <QuizLibrary courseId={id} isTeacher={isTeacher} onPlay={handlePlaySaved} />
        )}

        {mode === 'generating' ? (
          <GenerationPanel title="Generating quiz" steps={steps} />
        ) : (
          <Card padding="lg">
            <div className="space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t.courseQuiz.questions}</Label>
                  <Select value={count} onChange={(e) => setCount(e.target.value)}>
                    {[3, 5, 8, 10, 15].map((n) => (
                      <option key={n} value={String(n)}>
                        {n} {t.courseQuiz.questionsSuffix}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t.courseQuiz.difficulty}</Label>
                  <Select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                  >
                    <option value="easy">{t.courseQuiz.easy}</option>
                    <option value="medium">{t.courseQuiz.medium}</option>
                    <option value="hard">{t.courseQuiz.hard}</option>
                  </Select>
                </div>
              </div>

              <Button
                variant="ai"
                size="lg"
                className="w-full"
                onClick={handleGenerate}
                disabled={!topic.trim()}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t.courseQuiz.generateQuiz}
              </Button>
            </div>
          </Card>
        )}

        {/* Topic suggestions */}
        {mode === 'config' && (
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
            {pct}% — {verdict === 'excellent' ? <em>excellent</em> : verdict === 'good' ? <em>good effort</em> : <em>keep studying</em>}
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
              <Badge
                tone={verdict === 'excellent' ? 'success' : verdict === 'good' ? 'warning' : 'danger'}
              >
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

        {/* Teacher-only: persist this AI-generated quiz to the library */}
        {isTeacher && !loadedFromLibraryId && (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => saveAiQuiz.mutate()}
            disabled={saveAiQuiz.isPending}
          >
            <Save className="h-3.5 w-3.5" />
            {saveAiQuiz.isPending ? t.courseQuiz.saving : t.courseQuiz.saveToLibrary}
          </Button>
        )}

        <Button variant="secondary" size="lg" className="w-full" onClick={handleReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          {t.courseQuiz.newQuiz}
        </Button>
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
            <span className="text-[15px] font-semibold text-[var(--fg)]">
              {topic || t.courseQuiz.title}
            </span>
          </div>
        </div>
        <Badge tone="accent" variant="soft">
          {difficultyLabel[difficulty]}
        </Badge>
      </div>

      <DsProgress
        value={current + 1}
        max={quiz.questions.length}
        showPercent={false}
        label={null as any}
      />

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
