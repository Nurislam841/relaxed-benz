'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Trophy,
  Users,
  Target,
  Clock,
  Brain,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { Stat } from '@/components/ds/stat';
import { toast } from '@/hooks/use-toast';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';

interface ClassInsights {
  summary: string;
  strongestTopic: string;
  weakestTopic: string;
  misconceptions: { questionPosition: number; explanation: string }[];
  _demo?: boolean;
}

interface StudentInsights {
  summary: string;
  strengths: string[];
  gaps: string[];
  nextStep: string;
  _demo?: boolean;
}

/**
 * Shape returned by GET /api/kahoot/sessions/:id/report — keep in sync with
 * KahootService.getSessionReport on the backend.
 */
interface SessionReport {
  session: {
    id: string;
    joinCode: string;
    quizTitle: string;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    totalQuestions: number;
  };
  summary: {
    totalPlayers: number;
    averageAccuracy: number;
    averageScore: number;
  };
  perPlayer: Array<{
    userId: string;
    fullName: string;
    score: number;
    rank: number;
    accuracy: number;
    totalAnswered: number;
    completedAt: string | null;
    answers: Array<{
      questionId: string;
      questionText: string;
      pickedIndex: number;
      correctIndex: number;
      isCorrect: boolean;
      pointsEarned: number;
      responseTimeMs: number;
    }>;
  }>;
  perQuestion: Array<{
    questionId: string;
    position: number;
    questionText: string;
    options: string[];
    correctIndex: number;
    answerDistribution: number[];
    correctCount: number;
    totalAnswered: number;
    accuracyPercent: number;
    avgResponseTimeMs: number;
  }>;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Format ms → human ("8.4s" / "1m 12s"). Used in the per-question stats and
 * the players table.
 */
function formatMs(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

export default function KahootSessionReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  // Track which per-question accordion is open. Multiple open at once allowed.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Track which student rows are expanded (per-student AI block).
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});
  // AI insights — class-level narrative + per-student narratives. Both
  // are fetched on demand (button click) because each is a Claude call
  // that costs tokens and takes ~5s; lazy is correct UX.
  const [classInsights, setClassInsights] = useState<ClassInsights | null>(null);
  const [studentInsightsMap, setStudentInsightsMap] = useState<Record<string, StudentInsights>>({});

  const { data, isLoading, error } = useQuery<SessionReport>({
    queryKey: ['session-report', sessionId],
    queryFn: () => api.get<SessionReport>(`/kahoot/sessions/${sessionId}/report`),
    enabled: !!sessionId,
  });

  const toggle = (qid: string) => setExpanded((p) => ({ ...p, [qid]: !p[qid] }));
  const toggleStudent = (uid: string) => setExpandedStudents((p) => ({ ...p, [uid]: !p[uid] }));

  /**
   * Class-level AI narrative. Lazy: only fires when the teacher clicks
   * the button, so a report you just glance at doesn't burn Claude
   * tokens. Result is cached in component state — re-opening the
   * accordion doesn't re-fire the request.
   */
  const classMut = useMutation({
    mutationFn: () => api.post<ClassInsights>('/ai/kahoot-insights', { sessionId, scope: 'class' }),
    onSuccess: (res) => setClassInsights(res),
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'AI call failed';
      toast({ title: 'AI analysis failed', description: msg, variant: 'destructive' });
    },
  });

  /**
   * Per-student AI narrative. Same lazy/cached approach as the class
   * version; we just key by studentId so the same teacher can run it
   * for multiple students in one report session without re-fetching
   * the ones they've already viewed.
   */
  const runStudentAi = async (studentId: string) => {
    if (studentInsightsMap[studentId]) return; // already fetched
    try {
      const res = await api.post<StudentInsights>('/ai/kahoot-insights', {
        sessionId,
        scope: 'student',
        studentId,
      });
      setStudentInsightsMap((prev) => ({ ...prev, [studentId]: res }));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'AI call failed';
      toast({ title: 'AI analysis failed', description: msg, variant: 'destructive' });
    }
  };

  /**
   * Roll up the report into a CSV friendly to spreadsheet analysis: one row per
   * (player, question) answer. Teachers asked for this so they can pivot in
   * Sheets without re-shaping data.
   */
  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [];
    for (const p of data.perPlayer) {
      for (const a of p.answers) {
        rows.push([
          p.rank,
          p.fullName,
          a.questionText,
          a.pickedIndex >= 0 ? (OPTION_LETTERS[a.pickedIndex] ?? a.pickedIndex) : '—',
          a.correctIndex >= 0 ? (OPTION_LETTERS[a.correctIndex] ?? a.correctIndex) : '—',
          a.isCorrect ? 'YES' : 'NO',
          a.pointsEarned,
          (a.responseTimeMs / 1000).toFixed(2),
        ]);
      }
    }
    downloadCsv(
      `kahoot-report-${data.session.joinCode}.csv`,
      ['Rank', 'Player', 'Question', 'Picked', 'Correct', 'IsCorrect', 'Points', 'TimeSec'],
      rows,
    );
  };

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
        <p className="text-[var(--fg-muted)]">Could not load report. You might not be the host of this session.</p>
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5" /> Go back
        </Button>
      </div>
    );
  }

  const { session, summary, perPlayer, perQuestion } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <Eyebrow>Session report</Eyebrow>
          <HDisplay size="md" as="h1">
            {session.quizTitle}
          </HDisplay>
          <div className="text-[12px] text-[var(--fg-muted)] font-mono">
            Code <strong>{session.joinCode}</strong> ·{' '}
            {session.endedAt ? `Ended ${new Date(session.endedAt).toLocaleString()}` : 'In progress'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push(`/kahoot/host/${sessionId}`)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to session
          </Button>
          <Button variant="secondary" onClick={exportCsv} disabled={perPlayer.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Top stats */}
      <Card padding="lg">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <Stat label="Players" value={summary.totalPlayers} icon={<Users className="h-3.5 w-3.5" />} />
          <Stat label="Avg accuracy" value={`${summary.averageAccuracy}%`} icon={<Target className="h-3.5 w-3.5" />} />
          <Stat label="Avg score" value={summary.averageScore} icon={<Trophy className="h-3.5 w-3.5" />} />
          <Stat label="Questions" value={session.totalQuestions} icon={<Clock className="h-3.5 w-3.5" />} />
        </div>
      </Card>

      {/* AI class narrative — lazy. The teacher chooses when to spend
          tokens; we don't auto-fire so a quick glance at the stats
          stays free. After the first call, the result sticks in
          component state so re-renders don't re-fetch. */}
      <Card padding="lg" className="border-[var(--accent-300)] dark:border-[var(--accent-500)]/40">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-[var(--accent-600)]" />
            <Eyebrow>AI class analysis</Eyebrow>
          </div>
          {!classInsights && (
            <Button
              variant="ai"
              size="sm"
              disabled={classMut.isPending || perPlayer.length === 0}
              onClick={() => classMut.mutate()}
            >
              {classMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Analyse this class
            </Button>
          )}
        </div>
        {!classInsights && !classMut.isPending && (
          <p className="text-[13px] text-[var(--fg-muted)] mt-2">
            Click to ask AI what the class did well, what they struggled with, and what to address next lecture.
          </p>
        )}
        {classMut.isPending && (
          <p className="text-[13px] text-[var(--fg-muted)] mt-2 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Reading the report and writing the narrative…
          </p>
        )}
        {classInsights && (
          <div className="mt-3 space-y-3">
            <p className="text-[14px] leading-relaxed text-[var(--fg)]">{classInsights.summary}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-md border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-3">
                <div className="text-[11px] uppercase tracking-wide font-mono text-emerald-700 dark:text-emerald-300 mb-1">
                  Strongest
                </div>
                <div className="text-[13px] text-[var(--fg)]">{classInsights.strongestTopic || '—'}</div>
              </div>
              <div className="rounded-md border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 p-3">
                <div className="text-[11px] uppercase tracking-wide font-mono text-rose-700 dark:text-rose-300 mb-1">
                  Weakest
                </div>
                <div className="text-[13px] text-[var(--fg)]">{classInsights.weakestTopic || '—'}</div>
              </div>
            </div>
            {classInsights.misconceptions.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wide font-mono text-[var(--fg-subtle)]">
                  Misconceptions
                </div>
                <ul className="space-y-1.5">
                  {classInsights.misconceptions.map((m, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-[var(--border-color)] bg-[var(--surface-subtle)] p-2.5 text-[13px]"
                    >
                      <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--fg-subtle)] mr-2">
                        Q{m.questionPosition}
                      </span>
                      {m.explanation}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {classInsights._demo && (
              <p className="text-[11px] text-[var(--fg-muted)] italic">
                Demo mode — connect LLM_API_KEY for real analysis.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Players table */}
      <div className="space-y-2.5">
        <Eyebrow>Final standings ({perPlayer.length})</Eyebrow>
        {perPlayer.length === 0 ? (
          <Card padding="md" className="text-[13px] text-[var(--fg-muted)] text-center">
            No players answered any questions in this session.
          </Card>
        ) : (
          <Card padding="sm" className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase font-mono tracking-wide text-[var(--fg-subtle)] border-b border-[var(--border-color)]">
                  <th className="text-left px-3 py-2 w-12">#</th>
                  <th className="text-left px-3 py-2">Player</th>
                  <th className="text-right px-3 py-2">Score</th>
                  <th className="text-right px-3 py-2">Accuracy</th>
                  <th className="text-right px-3 py-2">Answered</th>
                </tr>
              </thead>
              <tbody>
                {perPlayer.map((p) => {
                  const isExpanded = !!expandedStudents[p.userId];
                  const studentAi = studentInsightsMap[p.userId];
                  return (
                    <>
                      <tr
                        key={p.userId}
                        className="border-b border-[var(--border-color)] hover:bg-[var(--surface-hover)] cursor-pointer"
                        onClick={() => toggleStudent(p.userId)}
                      >
                        <td className="px-3 py-2 font-mono text-[12px] text-[var(--fg-muted)]">
                          {p.rank === 1 ? <span title="Winner">🏆</span> : `#${p.rank}`}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-[var(--fg-muted)]" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-[var(--fg-muted)]" />
                            )}
                            {p.fullName}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{p.score}</td>
                        <td className="px-3 py-2 text-right">
                          <Badge
                            tone={p.accuracy >= 80 ? 'success' : p.accuracy >= 50 ? 'warning' : 'danger'}
                            variant="soft"
                          >
                            {p.accuracy}%
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--fg-muted)]">
                          {p.totalAnswered} / {session.totalQuestions}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr
                          key={`${p.userId}-detail`}
                          className="border-b border-[var(--border-color)] bg-[var(--surface-subtle)]"
                        >
                          <td colSpan={5} className="px-4 py-3 space-y-3">
                            {/* Per-question answer list */}
                            <div className="space-y-1">
                              {p.answers.map((a) => {
                                const pickedLetter = a.pickedIndex >= 0 ? OPTION_LETTERS[a.pickedIndex] : '—';
                                const correctLetter = a.correctIndex >= 0 ? OPTION_LETTERS[a.correctIndex] : '—';
                                return (
                                  <div
                                    key={a.questionId}
                                    className="text-[12px] flex items-center justify-between gap-3"
                                  >
                                    <span className="text-[var(--fg)] truncate">{a.questionText}</span>
                                    <span className="font-mono shrink-0 flex items-center gap-2">
                                      <span
                                        className={
                                          a.isCorrect
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-rose-600 dark:text-rose-400'
                                        }
                                      >
                                        picked {pickedLetter}
                                      </span>
                                      <span className="text-[var(--fg-muted)]">/ correct {correctLetter}</span>
                                      <span className="text-[var(--fg-muted)]">· {formatMs(a.responseTimeMs)}</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Per-student AI block — lazy */}
                            {studentAi ? (
                              <div className="rounded-md border border-[var(--accent-300)] dark:border-[var(--accent-500)]/40 bg-[var(--accent-50)] dark:bg-[var(--accent-500)]/5 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Brain className="h-3.5 w-3.5 text-[var(--accent-600)]" />
                                  <span className="text-[11px] uppercase tracking-wide font-mono text-[var(--fg-muted)]">
                                    AI analysis for {p.fullName}
                                  </span>
                                </div>
                                <p className="text-[13px] text-[var(--fg)]">{studentAi.summary}</p>
                                {studentAi.strengths.length > 0 && (
                                  <div>
                                    <div className="text-[11px] uppercase tracking-wide font-mono text-emerald-600 dark:text-emerald-400 mb-0.5">
                                      Strengths
                                    </div>
                                    <ul className="text-[12px] list-disc list-inside text-[var(--fg)]">
                                      {studentAi.strengths.map((s, i) => (
                                        <li key={i}>{s}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {studentAi.gaps.length > 0 && (
                                  <div>
                                    <div className="text-[11px] uppercase tracking-wide font-mono text-rose-600 dark:text-rose-400 mb-0.5">
                                      Gaps
                                    </div>
                                    <ul className="text-[12px] list-disc list-inside text-[var(--fg)]">
                                      {studentAi.gaps.map((g, i) => (
                                        <li key={i}>{g}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {studentAi.nextStep && (
                                  <div className="text-[12px] text-[var(--fg)]">
                                    <span className="font-semibold">Next step: </span>
                                    {studentAi.nextStep}
                                  </div>
                                )}
                                {studentAi._demo && (
                                  <p className="text-[11px] text-[var(--fg-muted)] italic">Demo mode.</p>
                                )}
                              </div>
                            ) : (
                              <Button
                                variant="ai"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runStudentAi(p.userId);
                                }}
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                AI analyse this student
                              </Button>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-2.5">
        <Eyebrow>Question breakdown</Eyebrow>
        {perQuestion.length === 0 ? (
          <Card padding="md" className="text-[13px] text-[var(--fg-muted)] text-center">
            No questions in this quiz.
          </Card>
        ) : (
          <div className="space-y-2">
            {perQuestion.map((q) => {
              const isOpen = !!expanded[q.questionId];
              const max = Math.max(1, ...q.answerDistribution);
              return (
                <Card key={q.questionId} padding="md">
                  <button
                    type="button"
                    onClick={() => toggle(q.questionId)}
                    className="w-full flex items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--fg-subtle)]">
                          Q{q.position + 1}
                        </span>
                        <Badge
                          tone={q.accuracyPercent >= 75 ? 'success' : q.accuracyPercent >= 40 ? 'warning' : 'danger'}
                          variant="soft"
                        >
                          {q.accuracyPercent}% correct
                        </Badge>
                        <span className="text-[11px] font-mono text-[var(--fg-muted)]">
                          avg {formatMs(q.avgResponseTimeMs)}
                        </span>
                      </div>
                      <p className="text-[14px] font-medium text-[var(--fg)] line-clamp-2">{q.questionText}</p>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-[var(--fg-muted)] mt-1 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--fg-muted)] mt-1 shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-2.5">
                      {q.options.map((opt, oi) => {
                        const picked = q.answerDistribution[oi] ?? 0;
                        const isCorrect = oi === q.correctIndex;
                        const pct = q.totalAnswered > 0 ? Math.round((picked / q.totalAnswered) * 100) : 0;
                        const barPct = Math.round((picked / max) * 100);
                        return (
                          <div key={oi} className="space-y-1">
                            <div className="flex items-center justify-between gap-3 text-[13px]">
                              <span className="flex items-center gap-2 min-w-0">
                                <span
                                  className={cn(
                                    'font-mono text-[11px] w-5 h-5 rounded flex items-center justify-center shrink-0',
                                    isCorrect
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-[var(--surface-subtle)] text-[var(--fg-muted)]',
                                  )}
                                >
                                  {OPTION_LETTERS[oi] ?? oi}
                                </span>
                                <span className={cn('truncate', isCorrect && 'font-semibold')}>{opt}</span>
                                {isCorrect && (
                                  <Badge tone="success" variant="soft">
                                    Correct
                                  </Badge>
                                )}
                              </span>
                              <span className="font-mono text-[12px] text-[var(--fg-muted)] shrink-0">
                                {picked} · {pct}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-[var(--surface-subtle)] overflow-hidden">
                              <div
                                className={cn(
                                  'h-full transition-all',
                                  isCorrect ? 'bg-emerald-500' : 'bg-[var(--accent-400)]',
                                )}
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 text-[12px] text-[var(--fg-muted)] font-mono">
                        {q.totalAnswered} of {perPlayer.length} player
                        {perPlayer.length === 1 ? '' : 's'} answered
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
