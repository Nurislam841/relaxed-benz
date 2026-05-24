'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, Download, Loader2, Trophy, Users, Target, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { Stat } from '@/components/ds/stat';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';

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

  const { data, isLoading, error } = useQuery<SessionReport>({
    queryKey: ['session-report', sessionId],
    queryFn: () => api.get<SessionReport>(`/kahoot/sessions/${sessionId}/report`),
    enabled: !!sessionId,
  });

  const toggle = (qid: string) => setExpanded((p) => ({ ...p, [qid]: !p[qid] }));

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
                {perPlayer.map((p) => (
                  <tr
                    key={p.userId}
                    className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--surface-hover)]"
                  >
                    <td className="px-3 py-2 font-mono text-[12px] text-[var(--fg-muted)]">
                      {p.rank === 1 ? <span title="Winner">🏆</span> : `#${p.rank}`}
                    </td>
                    <td className="px-3 py-2 font-medium">{p.fullName}</td>
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
                ))}
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
