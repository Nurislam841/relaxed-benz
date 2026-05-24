'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Grade, GradeSummary } from '@/lib/types';
import { useMe } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/form-elements';
import { Award, TrendingUp, BookOpen, ChevronRight, GraduationCap, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import Link from 'next/link';
import { motion } from 'framer-motion';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const itemV = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

function PercentRing({ pct }: { pct: number }) {
  const r = 28,
    circ = 2 * Math.PI * r;
  const color = pct >= 80 ? 'stroke-emerald-500' : pct >= 60 ? 'stroke-amber-500' : 'stroke-rose-500';
  return (
    <svg width="72" height="72" className="-rotate-90 shrink-0">
      <circle cx="36" cy="36" r={r} strokeWidth="6" fill="none" className="stroke-muted" />
      <circle
        cx="36"
        cy="36"
        r={r}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - (circ * Math.min(pct, 100)) / 100}
        className={cn(color, 'transition-all duration-700')}
      />
    </svg>
  );
}

export default function GradesPage() {
  const t = useT();
  const { data: user } = useMe();

  const { data: grades, isLoading: gLoad } = useQuery<Grade[]>({
    queryKey: ['my-grades'],
    queryFn: () => api.get('/me/grades'),
    enabled: user?.role === 'STUDENT',
  });

  const { data: summary, isLoading: sLoad } = useQuery<GradeSummary[]>({
    queryKey: ['grade-summary'],
    queryFn: () => api.get('/me/grades/summary'),
    enabled: user?.role === 'STUDENT',
  });

  // Redirect teachers / admins – they use the per-course gradebook
  if (user && user.role !== 'STUDENT') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
          <GraduationCap className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="font-serif font-semibold text-lg">{t.grades.title}</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Grades are managed per-course. Open a course and go to the&nbsp;
          <span className="font-medium text-foreground">Grades</span> tab to view your gradebook.
        </p>
        <Link href="/courses" className="text-sm text-primary hover:underline flex items-center gap-1">
          View Courses <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const isLoading = gLoad || sLoad;

  if (isLoading) {
    return (
      <div className="space-y-5 mt-1">
        <Skeleton className="h-7 w-36" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const summaryList = summary || [];
  const gradeList = grades || [];

  // Overall totals across all courses
  const totalEarned = summaryList.reduce((s, c) => s + c.totalEarned, 0);
  const totalPossible = summaryList.reduce((s, c) => s + c.totalPossible, 0);
  const overallPct = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
  const gradedCount = summaryList.reduce((s, c) => s + c.gradesCount, 0);

  // Group grades by course for the per-course accordion
  const byCourse = gradeList.reduce<Record<string, Grade[]>>((acc, g) => {
    const cid = g.submission?.assignment?.course?.id;
    if (!cid) return acc;
    acc[cid] = acc[cid] || [];
    acc[cid].push(g);
    return acc;
  }, {});

  const noGrades = summaryList.length === 0 && gradeList.length === 0;

  return (
    <div className="space-y-6 mt-1">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
            Academic record
          </span>
          <h1 className="font-serif text-[36px] tracking-[-0.015em] leading-[1.05] text-[var(--fg)]">
            {t.grades.myGrades}
          </h1>
          <p className="text-[14px] text-[var(--fg-muted)]">Your academic performance across all enrolled courses</p>
        </div>
        <a href="/api/me/transcript.pdf" download>
          <Button variant="outline" size="sm" type="button" title="Download your transcript as PDF">
            <FileText className="h-3.5 w-3.5" />
            Download transcript
          </Button>
        </a>
      </div>

      {/* Overall summary strip */}
      {!noGrades && (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: 'Overall score',
              value: `${overallPct}%`,
              sub: `${totalEarned} / ${totalPossible} pts`,
              color:
                overallPct >= 80
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : overallPct >= 60
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400',
            },
            {
              label: t.grades.graded,
              value: gradedCount,
              sub: 'assignments graded',
              color: 'text-blue-600 dark:text-blue-400',
            },
            { label: 'Courses with data', value: summaryList.length, sub: 'courses tracked', color: 'text-primary' },
          ].map(({ label, value, sub, color }) => (
            <motion.div
              key={label}
              variants={itemV}
              className="rounded-xl border border-border/60 dark:border-white/[0.07] bg-card/80 dark:backdrop-blur-sm p-4 shadow-card"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
              <p className={cn('text-3xl font-bold mt-1', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Empty state */}
      {noGrades && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="relative mb-5">
            <div className="h-16 w-16 rounded-2xl bg-muted dark:bg-white/[0.04] flex items-center justify-center">
              <Award className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center ring-2 ring-background">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          <p className="font-serif font-medium text-foreground mb-1">{t.grades.noGrades}</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Complete and submit assignments — your grades will appear here once your teacher reviews them.
          </p>
          <Link href="/courses" className="mt-5 text-sm text-primary hover:underline flex items-center gap-1">
            Browse your courses <ChevronRight className="h-4 w-4" />
          </Link>
        </motion.div>
      )}

      {/* Per-course summary cards */}
      {summaryList.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">By Course</h2>
          <motion.div className="space-y-3" variants={stagger} initial="hidden" animate="visible">
            {summaryList.map((s) => {
              const courseGrades = byCourse[s.course?.id ?? ''] || [];
              return (
                <motion.div
                  key={s.course?.id}
                  variants={itemV}
                  className="rounded-xl border border-border/60 dark:border-white/[0.07] bg-card/80 dark:backdrop-blur-sm shadow-card overflow-hidden"
                >
                  {/* Course header */}
                  <div className="flex items-center gap-4 p-4">
                    <PercentRing pct={s.percentage} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-semibold text-sm leading-tight">{s.course?.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.course?.code}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={cn(
                              'text-lg font-bold',
                              s.percentage >= 80
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : s.percentage >= 60
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400',
                            )}
                          >
                            {s.percentage}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.totalEarned} / {s.totalPossible} pts
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> {s.gradesCount} graded
                        </span>
                        <Link
                          href={`/courses/${s.course?.id}/grades`}
                          className="ml-auto flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          View details <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Individual grade rows */}
                  {courseGrades.length > 0 && (
                    <div className="border-t border-border/40 dark:border-white/[0.05] divide-y divide-border/40 dark:divide-white/[0.04]">
                      {courseGrades.slice(0, 3).map((g) => (
                        <div key={g.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                          <p className="text-xs text-foreground/80 truncate flex-1">
                            {g.submission?.assignment?.title}
                          </p>
                          <div className="shrink-0 text-right">
                            <span
                              className={cn(
                                'text-xs font-semibold',
                                g.submission?.assignment?.maxScore
                                  ? g.score / g.submission.assignment.maxScore >= 0.8
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : g.score / g.submission.assignment.maxScore >= 0.6
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  : 'text-foreground',
                              )}
                            >
                              {g.score}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              /{g.submission?.assignment?.maxScore ?? '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {courseGrades.length > 3 && (
                        <div className="px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
                          <span>+{courseGrades.length - 3} more</span>
                          <Link href={`/courses/${s.course?.id}/grades`} className="text-primary hover:underline">
                            See all
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}
    </div>
  );
}
