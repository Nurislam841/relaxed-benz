'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Trophy, Target, CheckCircle2, XCircle, Brain, Sparkles, Lightbulb } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { Stat } from '@/components/ds/stat';
import { useMe } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * Student-facing post-session results (Feature #4).
 *
 * Reached from:
 *   - the "View my results" button at the end of /kahoot/play
 *   - the Telegram inline button after the host finishes a session
 *
 * What lives here vs. /kahoot/host/[id]/report:
 *   - /report is HOST-only. Crowded — shows every player, full
 *     leaderboard, per-question distribution.
 *   - This page is for ONE student about THEMSELVES. Their score +
 *     rank + answer-by-answer review (correct answer + explanation
 *     revealed) + an "AI personal plan" lazy call.
 *
 * The AI plan reuses /ai/kahoot-insights with scope='student' and the
 * caller's own id — the backend recognises this as a self-lookup and
 * routes through getMyResults rather than the host-only report.
 */

interface MyResults {
  session: {
    id: string;
    joinCode: string;
    quizTitle: string;
    quizId: string;
    status: string;
    totalQuestions: number;
  };
  me: {
    score: number;
    accuracy: number;
    correctCount: number;
    totalAnswered: number;
    rank: number;
    totalPlayers: number;
  };
  answers: Array<{
    questionId: string;
    position: number;
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    pickedIndex: number | null;
    isCorrect: boolean;
    responseTimeMs: number;
  }>;
}

interface StudentInsights {
  summary: string;
  strengths: string[];
  gaps: string[];
  nextStep: string;
  _demo?: boolean;
}

const OPTION_COLORS = [
  'bg-rose-100 border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/40',
  'bg-sky-100 border-sky-300 dark:bg-sky-500/10 dark:border-sky-500/40',
  'bg-amber-100 border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/40',
  'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/40',
];

export default function MyKahootResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { data: me } = useMe();
  const [insights, setInsights] = useState<StudentInsights | null>(null);

  const { data, isLoading, error } = useQuery<MyResults>({
    queryKey: ['my-results', sessionId],
    queryFn: () => api.get<MyResults>(`/kahoot/sessions/${sessionId}/my-results`),
    enabled: !!sessionId,
  });

  /**
   * Lazy AI plan — fires only on button click so opening the page
   * doesn't burn tokens for students who just want to glance at
   * their score. Once fetched, the result sticks in state.
   */
  const planMut = useMutation({
    mutationFn: () =>
      api.post<StudentInsights>('/ai/kahoot-insights', {
        sessionId,
        scope: 'student',
        studentId: me?.id,
      }),
    onSuccess: (r) => setInsights(r),
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'AI call failed';
      toast({ title: 'AI analysis failed', description: msg, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center mt-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-500)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center space-y-3">
        <p className="text-[var(--fg-muted)]">Could not load your results. Maybe you didn't play this session?</p>
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Button>
      </div>
    );
  }

  const { session, me: result, answers } = data;
  const verdict = result.score >= 80 ? 'excellent' : result.score >= 50 ? 'good' : 'study';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <Eyebrow>Your results</Eyebrow>
        <HDisplay size="md" as="h1">
          {session.quizTitle}
        </HDisplay>
        <p className="text-[12px] text-[var(--fg-muted)] font-mono">Code {session.joinCode}</p>
      </div>

      {/* My score card */}
      <Card padding="lg">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 items-center">
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
            <Badge
              tone={verdict === 'excellent' ? 'success' : verdict === 'good' ? 'warning' : 'danger'}
              variant="soft"
            >
              {verdict === 'excellent' ? 'Excellent!' : verdict === 'good' ? 'Good effort' : 'Keep studying'}
            </Badge>
          </div>
          <Stat label="Score" value={`${result.score}%`} icon={<Target className="h-3.5 w-3.5" />} />
          <Stat
            label="Rank"
            value={result.rank > 0 ? `#${result.rank} / ${result.totalPlayers}` : '—'}
            icon={<Trophy className="h-3.5 w-3.5" />}
          />
          <Stat label="Correct" value={`${result.correctCount} / ${session.totalQuestions}`} />
        </div>
      </Card>

      {/* AI Personal Plan — lazy */}
      <Card padding="lg" className="border-[var(--accent-300)] dark:border-[var(--accent-500)]/40">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-[var(--accent-600)]" />
            <Eyebrow>Your AI study plan</Eyebrow>
          </div>
          {!insights && (
            <Button variant="ai" size="sm" disabled={planMut.isPending} onClick={() => planMut.mutate()}>
              {planMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Get my plan
            </Button>
          )}
        </div>
        {!insights && !planMut.isPending && (
          <p className="text-[13px] text-[var(--fg-muted)] mt-2">
            Click to ask AI for a personal plan based on what you got right and wrong.
          </p>
        )}
        {planMut.isPending && (
          <p className="text-[13px] text-[var(--fg-muted)] mt-2 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Writing your plan…
          </p>
        )}
        {insights && (
          <div className="mt-3 space-y-3">
            <p className="text-[14px] leading-relaxed text-[var(--fg)]">{insights.summary}</p>
            {insights.strengths.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide font-mono text-emerald-600 dark:text-emerald-400 mb-1">
                  Strengths
                </div>
                <ul className="text-[13px] list-disc list-inside text-[var(--fg)]">
                  {insights.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {insights.gaps.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide font-mono text-rose-600 dark:text-rose-400 mb-1">
                  Gaps to close
                </div>
                <ul className="text-[13px] list-disc list-inside text-[var(--fg)]">
                  {insights.gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {insights.nextStep && (
              <div className="rounded-md border border-[var(--accent-300)] dark:border-[var(--accent-500)]/40 bg-[var(--accent-50)] dark:bg-[var(--accent-500)]/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="h-3.5 w-3.5 text-[var(--accent-600)]" />
                  <span className="text-[11px] uppercase tracking-wide font-mono text-[var(--fg-muted)]">
                    Next step
                  </span>
                </div>
                <p className="text-[13px] text-[var(--fg)]">{insights.nextStep}</p>
              </div>
            )}
            {insights._demo && (
              <p className="text-[11px] text-[var(--fg-muted)] italic">
                Demo mode — connect LLM_API_KEY for real analysis.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Per-question review */}
      <div className="space-y-2.5">
        <Eyebrow>Question review</Eyebrow>
        <div className="space-y-2.5">
          {answers.map((a) => {
            const pickedLetter = a.pickedIndex !== null ? String.fromCharCode(65 + a.pickedIndex) : '—';
            const correctLetter = String.fromCharCode(65 + a.correctIndex);
            return (
              <Card key={a.questionId} padding="md" className="space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--fg-subtle)]">
                      Q{a.position + 1}
                    </span>
                    {a.isCorrect ? (
                      <Badge tone="success" variant="soft">
                        <CheckCircle2 className="h-3 w-3" /> Correct
                      </Badge>
                    ) : (
                      <Badge tone="danger" variant="soft">
                        <XCircle className="h-3 w-3" /> {a.pickedIndex !== null ? 'Wrong' : 'No answer'}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[12px] font-mono text-[var(--fg-muted)]">
                    you picked <strong>{pickedLetter}</strong> · correct <strong>{correctLetter}</strong>
                  </span>
                </div>
                <p className="text-[14px] font-medium">{a.questionText}</p>
                <div className="space-y-1.5">
                  {a.options.map((opt, oi) => {
                    const isCorrect = oi === a.correctIndex;
                    const isPicked = oi === a.pickedIndex;
                    return (
                      <div
                        key={oi}
                        className={cn(
                          'flex items-center gap-2 rounded-md border p-2 text-[13px]',
                          OPTION_COLORS[oi % OPTION_COLORS.length],
                          isCorrect && 'ring-2 ring-emerald-400 dark:ring-emerald-500/60',
                          isPicked && !isCorrect && 'ring-2 ring-rose-400 dark:ring-rose-500/60',
                        )}
                      >
                        <span className="font-mono text-[11px] w-4 text-[var(--fg-subtle)]">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {isCorrect && (
                          <Badge tone="success" variant="soft">
                            Correct
                          </Badge>
                        )}
                        {isPicked && !isCorrect && (
                          <Badge tone="danger" variant="soft">
                            Your pick
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                {a.explanation && (
                  <div className="rounded-md bg-[var(--surface-subtle)] border border-[var(--border-color)] p-2.5">
                    <div className="text-[11px] uppercase tracking-wide font-mono text-[var(--fg-subtle)] mb-1">
                      Explanation
                    </div>
                    <p className="text-[13px] text-[var(--fg)]">{a.explanation}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 pt-2">
        {/* Self-study quiz from weak topics — Feature #5. Lands on a
            dedicated /self-study page that lazy-generates 5 fresh
            practice questions on whatever this student got wrong. */}
        <Button variant="ai" size="lg" onClick={() => router.push(`/kahoot/me/${sessionId}/self-study`)}>
          <Sparkles className="h-3.5 w-3.5" />
          Practice on what you missed
        </Button>
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Button>
      </div>
    </div>
  );
}
