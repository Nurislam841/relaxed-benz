'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Trophy,
  Users,
  ClipboardList,
  Radio,
  Clock,
  History as HistoryIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { useMe } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

/**
 * Kahoot history — list view for both roles.
 *
 *   - STUDENT: GET /kahoot/sessions/my-history → sessions they played.
 *     Each row links to /kahoot/me/:id/results (the per-student review
 *     page we built in Feature #4).
 *
 *   - TEACHER / ADMIN: GET /kahoot/sessions/hosted-history → sessions
 *     they hosted. Each row links to /kahoot/host/:id/report.
 *
 * Why a single page instead of two: the data shape differs but the
 * UI shape is the same (title + meta + score chip + arrow). One page,
 * two queries swapped by role, simpler nav.
 */

interface MyHistoryRow {
  sessionId: string;
  joinCode: string;
  quizId: string;
  quizTitle: string;
  hostName: string;
  status: 'LOBBY' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
  startedAt: string | null;
  endedAt: string | null;
  myScore: number;
  correctCount: number;
}

interface HostedHistoryRow {
  sessionId: string;
  joinCode: string;
  quizId: string;
  quizTitle: string;
  hostName: string;
  status: 'LOBBY' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
  startedAt: string | null;
  endedAt: string | null;
  totalPlayers: number;
  totalQuestions: number;
  avgScore: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  // YYYY-MM-DD HH:MM in user's locale, short form so the list reads
  // compactly. We don't need seconds here.
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'accent'> = {
  FINISHED: 'success',
  IN_PROGRESS: 'accent',
  LOBBY: 'warning',
  CANCELLED: 'danger',
};

export default function KahootHistoryPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const isTeacher = me?.role === 'TEACHER' || me?.role === 'ADMIN';

  const studentQ = useQuery<MyHistoryRow[]>({
    queryKey: ['kahoot-my-history'],
    queryFn: () => api.get<MyHistoryRow[]>('/kahoot/sessions/my-history'),
    // Students see THEIR history; teachers see this list too in addition
    // to their hosted list — handy when a teacher also plays as a guest.
    enabled: !!me,
  });

  const teacherQ = useQuery<HostedHistoryRow[]>({
    queryKey: ['kahoot-hosted-history'],
    queryFn: () => api.get<HostedHistoryRow[]>('/kahoot/sessions/hosted-history'),
    enabled: !!me && isTeacher,
  });

  const isLoading = studentQ.isLoading || (isTeacher && teacherQ.isLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center mt-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-500)]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <Eyebrow>Kahoot history</Eyebrow>
        <HDisplay size="md" as="h1">
          {isTeacher ? (
            <>
              Your <em>quiz sessions</em>
            </>
          ) : (
            <>
              Your <em>games</em>
            </>
          )}
        </HDisplay>
      </div>

      {/* Teacher: their hosted sessions */}
      {isTeacher && (
        <div className="space-y-2.5">
          <Eyebrow>Hosted by you ({teacherQ.data?.length ?? 0})</Eyebrow>
          {!teacherQ.data || teacherQ.data.length === 0 ? (
            <Card padding="md" className="text-[13px] text-[var(--fg-muted)] text-center">
              <HistoryIcon className="h-5 w-5 mx-auto mb-1 text-[var(--fg-subtle)]" />
              You haven't hosted any Kahoot sessions yet. Open a course → Quiz Studio → Host live to start one.
            </Card>
          ) : (
            <div className="space-y-2">
              {teacherQ.data.map((row) => (
                <Card
                  key={row.sessionId}
                  padding="md"
                  hoverable
                  className="cursor-pointer"
                  onClick={() => router.push(`/kahoot/host/${row.sessionId}/report`)}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-[14px] truncate">{row.quizTitle}</span>
                        <Badge tone={STATUS_TONE[row.status] ?? 'accent'} variant="soft">
                          {row.status}
                        </Badge>
                        <span className="font-mono text-[11px] text-[var(--fg-muted)]">code {row.joinCode}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[12px] text-[var(--fg-muted)] flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {row.totalPlayers} player{row.totalPlayers === 1 ? '' : 's'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ClipboardList className="h-3 w-3" /> {row.totalQuestions} Q
                        </span>
                        {row.totalPlayers > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Trophy className="h-3 w-3" /> avg {row.avgScore}%
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(row.endedAt || row.startedAt)}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Anyone: their played sessions. For teachers this is below the
          hosted list since hosting is their primary use-case. */}
      <div className="space-y-2.5">
        <Eyebrow>
          {isTeacher
            ? `Sessions you played in (${studentQ.data?.length ?? 0})`
            : `All games (${studentQ.data?.length ?? 0})`}
        </Eyebrow>
        {!studentQ.data || studentQ.data.length === 0 ? (
          <Card padding="md" className="text-[13px] text-[var(--fg-muted)] text-center">
            <HistoryIcon className="h-5 w-5 mx-auto mb-1 text-[var(--fg-subtle)]" />
            {isTeacher
              ? "You haven't played as a participant yet."
              : "You haven't played any Kahoot sessions yet. Use a join code from your teacher to start."}
          </Card>
        ) : (
          <div className="space-y-2">
            {studentQ.data.map((row) => {
              const tone = row.myScore >= 80 ? 'success' : row.myScore >= 50 ? 'warning' : 'danger';
              return (
                <Card
                  key={row.sessionId}
                  padding="md"
                  hoverable
                  className="cursor-pointer"
                  onClick={() => router.push(`/kahoot/me/${row.sessionId}/results`)}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-[14px] truncate">{row.quizTitle}</span>
                        <Badge tone={STATUS_TONE[row.status] ?? 'accent'} variant="soft">
                          {row.status}
                        </Badge>
                        <span className="font-mono text-[11px] text-[var(--fg-muted)]">code {row.joinCode}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[12px] text-[var(--fg-muted)] flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Radio className="h-3 w-3" /> host {row.hostName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(row.endedAt || row.startedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge tone={tone} variant="soft">
                        <Trophy className="h-3 w-3" /> {row.myScore}%
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-[var(--fg-muted)]" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-center pt-2">
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Button>
      </div>
    </div>
  );
}
