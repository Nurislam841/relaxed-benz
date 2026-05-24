'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  ChevronRight,
  ChevronsUp,
  ChevronsDown,
  Trophy,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { celebrate } from '@/lib/celebrate';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

interface AdaptiveQuestion {
  id: string;
  question: string;
  options: string[];
  points: number;
  difficulty: Difficulty;
}

interface StartResponse {
  attemptId: string;
  questionIndex: number;
  cap: number;
  currentDifficulty: Difficulty;
  question: AdaptiveQuestion;
}

interface NextResponse {
  done: false;
  feedback: { isCorrect: boolean; pointsEarned: number; correctIndex: number; explanation: string };
  questionIndex: number;
  cap: number;
  currentDifficulty: Difficulty;
  streakLen: number;
  streakDir: 'correct' | 'wrong' | null;
  question: AdaptiveQuestion;
}

interface DoneResponse {
  done: true;
  feedback: { isCorrect: boolean; pointsEarned: number; correctIndex: number; explanation: string };
  attempt: { id: string; score: number; totalPoints: number; answeredCount: number };
}

const DIFFICULTY_TONE: Record<Difficulty, { label: string; bg: string; text: string }> = {
  EASY: { label: 'Easy', bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-800 dark:text-emerald-200' },
  MEDIUM: { label: 'Medium', bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-800 dark:text-amber-200' },
  HARD: { label: 'Hard', bg: 'bg-rose-100 dark:bg-rose-500/15', text: 'text-rose-800 dark:text-rose-200' },
};

const OPTION_COLORS = [
  'bg-rose-500 hover:bg-rose-600',
  'bg-sky-500 hover:bg-sky-600',
  'bg-amber-500 hover:bg-amber-600',
  'bg-emerald-500 hover:bg-emerald-600',
];

export default function AdaptiveQuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const router = useRouter();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [question, setQuestion] = useState<AdaptiveQuestion | null>(null);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [cap, setCap] = useState(15);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [lastFeedback, setLastFeedback] = useState<NextResponse['feedback'] | null>(null);
  const [streakDir, setStreakDir] = useState<'correct' | 'wrong' | null>(null);
  const [streakLen, setStreakLen] = useState(0);
  const [shiftDirection, setShiftDirection] = useState<'up' | 'down' | null>(null);
  const [done, setDone] = useState<DoneResponse['attempt'] | null>(null);

  const questionStartRef = useRef<number>(Date.now());
  const lastDifficultyRef = useRef<Difficulty | null>(null);

  const startMut = useMutation<StartResponse>({
    mutationFn: () => api.post(`/quizzes/${quizId}/adaptive/start`, {}),
    onSuccess: (r) => {
      setAttemptId(r.attemptId);
      setQuestion(r.question);
      setQuestionIndex(r.questionIndex);
      setCap(r.cap);
      lastDifficultyRef.current = r.currentDifficulty;
      questionStartRef.current = Date.now();
    },
    onError: (e: Error) =>
      toast({ title: 'Could not start adaptive session', description: e.message, variant: 'destructive' }),
  });

  const answerMut = useMutation<NextResponse | DoneResponse, Error, number>({
    mutationFn: (pickedIdx: number) => {
      if (!attemptId || !question) throw new Error('not started');
      return api.post(`/quizzes/${quizId}/adaptive/answer`, {
        attemptId,
        questionId: question.id,
        pickedIndex: pickedIdx,
        responseTimeMs: Date.now() - questionStartRef.current,
      });
    },
    onSuccess: (r) => {
      setLastFeedback(r.feedback);
      if (r.done) {
        setDone(r.attempt);
        const pct = r.attempt.totalPoints > 0 ? Math.round((r.attempt.score / r.attempt.totalPoints) * 100) : 0;
        // Celebrate "excellent" finishes — anything below 90% gets a quiet
        // result page, anything at/above gets confetti.
        if (pct >= 90) celebrate();
        return;
      }
      const prev = lastDifficultyRef.current;
      const shift =
        prev && prev !== r.currentDifficulty
          ? ['EASY', 'MEDIUM', 'HARD'].indexOf(r.currentDifficulty) > ['EASY', 'MEDIUM', 'HARD'].indexOf(prev)
            ? ('up' as const)
            : ('down' as const)
          : null;
      setShiftDirection(shift);
      setStreakDir(r.streakDir);
      setStreakLen(r.streakLen);
      lastDifficultyRef.current = r.currentDifficulty;
    },
    onError: (e: Error) => toast({ title: 'Answer failed', description: e.message, variant: 'destructive' }),
  });

  // Auto-start on mount
  useEffect(() => {
    if (!attemptId && !startMut.isPending && !startMut.isError) {
      startMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePick = (idx: number) => {
    if (pickedIndex != null || answerMut.isPending) return;
    setPickedIndex(idx);
    answerMut.mutate(idx);
  };

  const handleNext = () => {
    if (answerMut.data && !answerMut.data.done) {
      setQuestion((answerMut.data as NextResponse).question);
      setQuestionIndex((answerMut.data as NextResponse).questionIndex);
      setPickedIndex(null);
      setLastFeedback(null);
      questionStartRef.current = Date.now();
    }
  };

  // ── Initial loading
  if (startMut.isPending || !question) {
    return (
      <div className="flex items-center justify-center mt-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-500)]" />
      </div>
    );
  }

  // ── Game over
  if (done) {
    const pct = done.totalPoints > 0 ? Math.round((done.score / done.totalPoints) * 100) : 0;
    return (
      <div className="max-w-md mx-auto mt-12 space-y-6 text-center">
        <Trophy className="h-14 w-14 mx-auto text-yellow-500" />
        <HDisplay size="md" as="h1">
          Adaptive <em>session</em> complete
        </HDisplay>
        <Card padding="lg">
          <p className="text-[44px] font-serif font-semibold">{pct}%</p>
          <p className="text-[14px] text-[var(--fg-muted)] mt-1">
            {done.score} / {done.totalPoints} points · {done.answeredCount} questions
          </p>
          <p className="text-[12px] text-[var(--fg-muted)] mt-3">
            Adaptive sessions adjust to your performance — your score reflects the difficulty mix you actually played.
          </p>
        </Card>
        <div className="flex gap-2 justify-center">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <Button variant="primary" onClick={() => window.location.reload()}>
            <Sparkles className="h-3.5 w-3.5" />
            Play again
          </Button>
        </div>
      </div>
    );
  }

  const tone = DIFFICULTY_TONE[question.difficulty];

  return (
    <div className="max-w-3xl mx-auto mt-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Eyebrow>Adaptive practice</Eyebrow>
          <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
            Question {questionIndex} of {cap}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {streakLen >= 2 && streakDir && (
            <span
              className={cn(
                'text-[11px] font-mono px-2 py-0.5 rounded-full border',
                streakDir === 'correct'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30'
                  : 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30',
              )}
            >
              {streakLen}× {streakDir}
            </span>
          )}
          <span
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium',
              tone.bg,
              tone.text,
            )}
          >
            {shiftDirection === 'up' && <ChevronsUp className="h-3 w-3" />}
            {shiftDirection === 'down' && <ChevronsDown className="h-3 w-3" />}
            {tone.label}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
        <div
          className="h-full bg-[var(--accent-500)] transition-all duration-500"
          style={{ width: `${(questionIndex / cap) * 100}%` }}
        />
      </div>

      {/* Question */}
      <Card padding="lg">
        <h2 className="font-serif text-[22px] leading-tight">{question.question}</h2>
      </Card>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {question.options.map((opt, i) => {
          const revealed = pickedIndex != null && lastFeedback;
          const isRight = revealed && i === lastFeedback!.correctIndex;
          const isWrongPick = revealed && i === pickedIndex && !lastFeedback!.isCorrect;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handlePick(i)}
              disabled={pickedIndex != null}
              className={cn(
                'rounded-xl text-white font-semibold text-left p-5 transition-all shadow-md',
                OPTION_COLORS[i % OPTION_COLORS.length],
                pickedIndex === i && !revealed && 'ring-4 ring-white/40',
                pickedIndex != null && pickedIndex !== i && 'opacity-40',
                isRight && 'ring-4 ring-emerald-300',
                isWrongPick && 'ring-4 ring-rose-300',
                pickedIndex == null && 'hover:scale-[1.02] active:scale-100',
              )}
            >
              <div className="flex items-center gap-3">
                <span className="h-6 w-6 rounded-full bg-white/25 flex items-center justify-center text-sm font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
                {isRight && <CheckCircle2 className="h-5 w-5" />}
                {isWrongPick && <XCircle className="h-5 w-5" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Feedback + next */}
      {lastFeedback && (
        <Card
          padding="md"
          className={cn(
            lastFeedback.isCorrect
              ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10'
              : 'border-rose-300 bg-rose-50 dark:bg-rose-500/10',
          )}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1 flex-1 min-w-0">
              <p className="font-semibold">
                {lastFeedback.isCorrect ? `Correct! +${lastFeedback.pointsEarned} points` : 'Not quite'}
              </p>
              {lastFeedback.explanation && (
                <p className="text-[13px] text-[var(--fg-muted)]">{lastFeedback.explanation}</p>
              )}
            </div>
            <Button onClick={handleNext} disabled={answerMut.isPending}>
              Next question
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {answerMut.isPending && pickedIndex != null && !lastFeedback && (
        <p className="text-center text-[13px] text-[var(--fg-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1.5" />
          Checking your answer…
        </p>
      )}
    </div>
  );
}
