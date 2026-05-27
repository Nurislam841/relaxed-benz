'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Trophy, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { Stat } from '@/components/ds/stat';
import { DsProgress } from '@/components/ds/progress';
import { useMe } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { celebrate } from '@/lib/celebrate';
import { cn } from '@/lib/utils';

/**
 * Self-study quiz — Feature #5 / C3 in the original plan.
 *
 * Lands here from the "Practice on what you missed" button on the
 * student results page. Lazy-generates 5 AI-authored practice
 * questions from the student's wrong-answer topics in this Kahoot
 * session, then plays them through one-by-one with answer reveal +
 * explanation, ending in a results summary.
 *
 * Quiz state lives entirely in component state — the questions are
 * ephemeral on the backend too (NOT saved to the Quiz library) so a
 * teacher doesn't see N personalized "Aliya's practice quiz" rows
 * piling up in their course. Refresh page = new quiz.
 */

interface PracticeQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface SelfStudyResponse {
  questions: PracticeQuestion[];
  _demo?: boolean;
  perfectScore?: boolean;
}

type Phase = 'loading' | 'playing' | 'finished' | 'error';

const OPTION_COLORS = [
  'bg-rose-500 hover:bg-rose-600',
  'bg-sky-500 hover:bg-sky-600',
  'bg-amber-500 hover:bg-amber-600',
  'bg-emerald-500 hover:bg-emerald-600',
];

export default function SelfStudyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { data: me } = useMe();

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  /**
   * Generation mutation — fires on mount AND when the student clicks
   * "Try a different set" so they can re-roll. We don't put this in
   * useQuery because it's a one-shot user action, not a refetchable
   * resource (each call costs Claude tokens).
   */
  const genMut = useMutation({
    mutationFn: () =>
      api.post<SelfStudyResponse>('/ai/self-study-quiz', {
        sessionId,
        studentId: me?.id,
      }),
    onSuccess: (res) => {
      if (!res.questions || res.questions.length === 0) {
        setPhase('error');
        toast({ title: 'AI returned no questions', variant: 'destructive' });
        return;
      }
      setQuestions(res.questions);
      setIsDemo(!!res._demo);
      setCurrent(0);
      setAnswers({});
      setPhase('playing');
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'AI call failed';
      toast({ title: 'Could not generate practice quiz', description: msg, variant: 'destructive' });
      setPhase('error');
    },
  });

  // Auto-generate once the user id resolves. Without me?.id the
  // self-lookup path on the backend would 400.
  useEffect(() => {
    if (me?.id && phase === 'loading') genMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const handlePick = (i: number) => {
    if (answers[current] !== undefined) return; // already locked
    setAnswers((prev) => ({ ...prev, [current]: i }));
  };

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      // End of run — celebrate on a clean sweep, then surface results.
      const correctCount = questions.filter((q, i) => answers[i] === q.correctIndex).length;
      if (correctCount === questions.length) celebrate();
      setPhase('finished');
    } else {
      setCurrent((c) => c + 1);
    }
  };

  // ─── Loading ─────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-500)] mx-auto" />
        <p className="text-[14px] text-[var(--fg-muted)]">Building practice questions from what you missed…</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="max-w-md mx-auto mt-12 text-center space-y-3">
        <p className="text-[var(--fg-muted)]">Couldn't generate practice quiz. Try again or go back to your results.</p>
        <div className="flex flex-col gap-2">
          <Button variant="ai" onClick={() => genMut.mutate()} disabled={genMut.isPending}>
            <RotateCcw className="h-3.5 w-3.5" /> Try again
          </Button>
          <Button variant="ghost" onClick={() => router.push(`/kahoot/me/${sessionId}/results`)}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to results
          </Button>
        </div>
      </div>
    );
  }

  // ─── Finished ────────────────────────────────────────────────
  if (phase === 'finished') {
    const correctCount = questions.filter((q, i) => answers[i] === q.correctIndex).length;
    const pct = Math.round((correctCount / questions.length) * 1000) / 10;
    const verdict = pct >= 80 ? 'excellent' : pct >= 50 ? 'good' : 'study';
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Eyebrow>Practice complete</Eyebrow>
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
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="flex flex-col items-center gap-2">
              <Trophy
                className="h-10 w-10"
                style={{
                  color:
                    verdict === 'excellent'
                      ? 'var(--success)'
                      : verdict === 'good'
                        ? 'var(--warning)'
                        : 'var(--fg-subtle)',
                }}
              />
            </div>
            <Stat label="Score" value={`${pct}%`} />
            <Stat label="Correct" value={`${correctCount} / ${questions.length}`} />
          </div>
          <div className="mt-4">
            <DsProgress
              value={pct}
              tone={pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger'}
              showPercent={false}
            />
          </div>
        </Card>

        {/* Per-question review with reveal — matches the host-driven
            Kahoot post-game review the student already knows. */}
        <div className="space-y-2.5">
          <Eyebrow>Question review</Eyebrow>
          {questions.map((q, i) => {
            const picked = answers[i];
            const isCorrect = picked === q.correctIndex;
            return (
              <Card key={i} padding="md" className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--fg-subtle)]">
                    Q{i + 1}
                  </span>
                  {isCorrect ? (
                    <Badge tone="success" variant="soft">
                      <CheckCircle2 className="h-3 w-3" /> Correct
                    </Badge>
                  ) : (
                    <Badge tone="danger" variant="soft">
                      <XCircle className="h-3 w-3" /> Wrong
                    </Badge>
                  )}
                </div>
                <p className="text-[14px] font-medium">{q.question}</p>
                <div className="space-y-1">
                  {q.options.map((opt, oi) => {
                    const isCorrectOpt = oi === q.correctIndex;
                    const isPicked = oi === picked;
                    return (
                      <div
                        key={oi}
                        className={cn(
                          'flex items-center gap-2 rounded-md border p-2 text-[13px]',
                          isCorrectOpt &&
                            'bg-emerald-50 border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/40',
                          isPicked &&
                            !isCorrectOpt &&
                            'bg-rose-50 border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/40',
                          !isCorrectOpt && !isPicked && 'border-[var(--border-color)]',
                        )}
                      >
                        <span className="font-mono text-[11px] w-4 text-[var(--fg-subtle)]">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {isCorrectOpt && (
                          <Badge tone="success" variant="soft">
                            Correct
                          </Badge>
                        )}
                        {isPicked && !isCorrectOpt && (
                          <Badge tone="danger" variant="soft">
                            Your pick
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <div className="rounded-md bg-[var(--surface-subtle)] border border-[var(--border-color)] p-2.5">
                    <div className="text-[11px] uppercase tracking-wide font-mono text-[var(--fg-subtle)] mb-1">
                      Explanation
                    </div>
                    <p className="text-[13px] text-[var(--fg)]">{q.explanation}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2 pt-2">
          <Button
            variant="ai"
            onClick={() => {
              setPhase('loading');
              genMut.mutate();
            }}
            disabled={genMut.isPending}
          >
            <Sparkles className="h-3.5 w-3.5" /> Try a different set
          </Button>
          <Button variant="ghost" onClick={() => router.push(`/kahoot/me/${sessionId}/results`)}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to results
          </Button>
        </div>
      </div>
    );
  }

  // ─── Playing ─────────────────────────────────────────────────
  const q = questions[current];
  const picked = answers[current];
  const answered = picked !== undefined;
  const isLast = current + 1 >= questions.length;

  return (
    <div className="max-w-3xl mx-auto space-y-5 mt-6">
      <div className="flex items-center justify-between">
        <Eyebrow>
          Practice {current + 1} of {questions.length}
        </Eyebrow>
        {isDemo && (
          <Badge tone="warning" variant="soft">
            Demo mode
          </Badge>
        )}
      </div>
      <DsProgress value={current + 1} max={questions.length} showPercent={false} label={null as any} />

      <Card padding="lg">
        <h2 className="font-serif text-[22px] leading-tight">{q.question}</h2>
      </Card>

      {/* Option buttons mimic the live-Kahoot colour scheme so the
          self-study UX feels continuous with the multiplayer game. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {q.options.map((opt, oi) => {
          const isCorrect = oi === q.correctIndex;
          const isPicked = oi === picked;
          return (
            <button
              key={oi}
              type="button"
              onClick={() => handlePick(oi)}
              disabled={answered}
              className={cn(
                'rounded-xl text-white font-semibold text-left p-5 transition-all shadow-md',
                OPTION_COLORS[oi % OPTION_COLORS.length],
                answered && isCorrect && 'ring-4 ring-emerald-400',
                answered && isPicked && !isCorrect && 'ring-4 ring-rose-400 opacity-80',
                answered && !isCorrect && !isPicked && 'opacity-40',
                !answered && 'hover:scale-[1.02] active:scale-100 cursor-pointer',
                answered && 'cursor-not-allowed',
              )}
            >
              <div className="flex items-center gap-3">
                <span className="h-6 w-6 rounded-full bg-white/25 flex items-center justify-center text-sm font-bold">
                  {String.fromCharCode(65 + oi)}
                </span>
                <span className="flex-1">{opt}</span>
              </div>
            </button>
          );
        })}
      </div>

      {answered && q.explanation && (
        <Card padding="md" className="bg-[var(--surface-subtle)]">
          <Eyebrow>Explanation</Eyebrow>
          <p className="text-[13px] mt-1 text-[var(--fg)]">{q.explanation}</p>
        </Card>
      )}

      {answered && (
        <Button variant="primary" size="lg" className="w-full" onClick={handleNext}>
          {isLast ? 'See results' : 'Next question'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
