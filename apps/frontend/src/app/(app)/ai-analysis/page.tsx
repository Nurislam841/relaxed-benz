'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, TrendingUp, TrendingDown, ArrowRight, AlertTriangle, Target,
  Calendar, Lightbulb, GraduationCap, Trophy, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import { useLanguage, useT } from '@/lib/i18n';
import type {
  Course, StudyCoachResult, ClassInsightsResult,
} from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label, Select, Skeleton } from '@/components/ui/form-elements';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { DsProgress } from '@/components/ds/progress';
import { toast } from '@/hooks/use-toast';

/**
 * AI Study Coach.
 *
 * Replaces the original "AI Student Analysis" page which the defense
 * committee called useless ("students can already see their grades").
 * This version goes beyond description into prediction and prescription:
 *
 *  - Students: grade trajectory, personalized study plan, mistake patterns.
 *  - Teachers/Admins: at-risk students, class-wide weakness map,
 *    high performers — answers "where should I spend my next class
 *    minute, and which student needs a 1:1 first?"
 */
export default function AiCoachPage() {
  const { data: user } = useMe();
  const { lang } = useLanguage();
  const t = useT();
  const isStudent = user?.role === 'STUDENT';

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [studentResult, setStudentResult] = useState<StudyCoachResult | null>(null);
  const [classResult, setClassResult] = useState<ClassInsightsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: courses } = useQuery<Course[]>({
    queryKey: ['my-courses-for-coach'],
    queryFn: () =>
      api.get<{ items: Course[] } | Course[]>('/courses?limit=200')
        .then((r) => Array.isArray(r) ? r : r.items),
  });

  const runStudent = async () => {
    setLoading(true);
    setStudentResult(null);
    try {
      const result = await api.post<StudyCoachResult>('/ai/study-coach', {
        ...(selectedCourseId ? { courseId: selectedCourseId } : {}),
        lang,
      });
      setStudentResult(result);
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const runClass = async () => {
    if (!selectedCourseId) {
      toast({ title: t.aiCoach.pickCourse, variant: 'destructive' });
      return;
    }
    setLoading(true);
    setClassResult(null);
    try {
      const result = await api.post<ClassInsightsResult>('/ai/class-insights', {
        courseId: selectedCourseId,
        lang,
      });
      setClassResult(result);
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Eyebrow>AI Study Coach</Eyebrow>
        <HDisplay size="md" as="h1">
          {isStudent ? <>Your personal <em>study coach</em></> : <>Class <em>insights</em></>}
        </HDisplay>
        <p className="text-[14px] text-[var(--fg-muted)] max-w-[64ch]">
          {isStudent ? t.aiCoach.studentSubtitle : t.aiCoach.teacherSubtitle}
        </p>
      </div>

      {/* Course selector + run button */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:flex sm:items-end sm:gap-3 sm:space-y-0">
          <div className="flex-1">
            <Label>{isStudent ? t.aiCoach.scopeLabel : t.aiCoach.pickCourse}</Label>
            <Select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
              {isStudent && <option value="">{t.aiCoach.allMyCourses}</option>}
              {!isStudent && !selectedCourseId && <option value="">{t.aiCoach.selectCoursePlaceholder}</option>}
              {courses?.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
            </Select>
          </div>
          <Button
            variant="ai"
            size="lg"
            onClick={isStudent ? runStudent : runClass}
            disabled={loading || (!isStudent && !selectedCourseId)}
            className="sm:w-auto w-full"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? t.aiCoach.thinking : (isStudent ? t.aiCoach.runStudent : t.aiCoach.runClass)}
          </Button>
        </CardContent>
      </Card>

      {loading && <Skeleton className="h-40 w-full" />}

      {/* ── Student results ───────────────────────────────────────────────── */}
      {!loading && isStudent && studentResult && (
        <StudentCoachView result={studentResult} t={t} />
      )}

      {/* ── Teacher results ───────────────────────────────────────────────── */}
      {!loading && !isStudent && classResult && (
        <ClassInsightsView result={classResult} t={t} />
      )}
    </div>
  );
}

// ─── Student view: trajectory + weaknesses + study plan + patterns ───────────
function StudentCoachView({ result, t }: { result: StudyCoachResult; t: any }) {
  const { trajectory, weaknesses, studyPlan, mistakePatterns } = result;
  const trendIcon =
    trajectory.trend === 'improving' ? <TrendingUp className="h-4 w-4 text-emerald-500" /> :
    trajectory.trend === 'declining' ? <TrendingDown className="h-4 w-4 text-rose-500" /> :
    <ArrowRight className="h-4 w-4 text-amber-500" />;
  const confidenceTone =
    trajectory.confidenceLevel === 'high' ? 'success' :
    trajectory.confidenceLevel === 'medium' ? 'warning' : 'danger';

  return (
    <div className="space-y-4">
      {result._demo && (
        <Card>
          <CardContent className="flex items-center gap-2 p-3 text-[12px] text-[var(--fg-muted)]">
            <AlertCircle className="h-3.5 w-3.5" /> {t.aiCoach.demoNotice}
          </CardContent>
        </Card>
      )}

      {/* Trajectory hero card */}
      <Card padding="lg">
        <Eyebrow>{t.aiCoach.trajectory}</Eyebrow>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
              {t.aiCoach.current}
            </p>
            <p className="mt-1 font-serif text-[36px] leading-none text-[var(--fg)] tabular-nums">
              {trajectory.currentGrade}<span className="text-[20px] text-[var(--fg-muted)]">%</span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
              {t.aiCoach.predicted}
            </p>
            <p className="mt-1 flex items-baseline gap-1.5 font-serif text-[36px] leading-none text-[var(--fg)] tabular-nums">
              {trajectory.predictedFinalGrade}<span className="text-[20px] text-[var(--fg-muted)]">%</span>
              <span className="ml-1">{trendIcon}</span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
              {t.aiCoach.confidence}
            </p>
            <div className="mt-1">
              <Badge tone={confidenceTone as any} variant="soft">
                {trajectory.confidenceLevel}
              </Badge>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <DsProgress value={trajectory.currentGrade} tone={trajectory.currentGrade >= 80 ? 'success' : trajectory.currentGrade >= 60 ? 'warning' : 'danger'} showPercent={false} />
        </div>
        <p className="mt-4 rounded-md bg-[var(--accent-50)] p-3 text-[13px] text-[var(--fg)]">
          <Target className="mr-1.5 inline h-3.5 w-3.5 text-[var(--accent-600)]" />
          {trajectory.requirementForA}
        </p>
      </Card>

      {/* Weaknesses */}
      {weaknesses.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
                {t.aiCoach.weaknesses}
              </p>
            </div>
            <div className="space-y-2">
              {weaknesses.map((w, i) => (
                <div key={i} className="rounded-md border border-[var(--border-color)] bg-[var(--surface)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-medium text-[var(--fg)]">{w.topic}</p>
                    <Badge tone={w.severity === 'high' ? 'danger' : w.severity === 'medium' ? 'warning' : 'accent'} variant="soft">
                      {w.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{w.evidence}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Study plan */}
      {studyPlan.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[var(--accent-600)]" />
              <p className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
                {t.aiCoach.studyPlan}
              </p>
            </div>
            <div className="space-y-2">
              {studyPlan.map((s, i) => (
                <div key={i} className="flex items-start gap-3 rounded-md bg-[var(--surface)] p-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-100)] font-mono text-[12px] font-semibold text-[var(--accent-700)]">
                    D{s.day}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-[var(--fg)]">{s.focus}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-[var(--fg-subtle)]">
                      ~{s.estimatedMinutes} {t.aiCoach.minutes}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mistake patterns */}
      {mistakePatterns.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <p className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
                {t.aiCoach.mistakePatterns}
              </p>
            </div>
            <div className="space-y-2">
              {mistakePatterns.map((p, i) => (
                <div key={i} className="rounded-md border border-[var(--border-color)] p-3">
                  <p className="text-[13px] font-medium text-[var(--fg)]">{p.pattern}</p>
                  <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
                    <span className="font-medium">{t.aiCoach.fixLabel}: </span>{p.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Teacher view: at-risk + weaknesses + high performers ────────────────────
function ClassInsightsView({ result, t }: { result: ClassInsightsResult; t: any }) {
  const { atRiskStudents, classWeaknesses, highPerformers } = result;
  return (
    <div className="space-y-4">
      {result._demo && (
        <Card>
          <CardContent className="flex items-center gap-2 p-3 text-[12px] text-[var(--fg-muted)]">
            <AlertCircle className="h-3.5 w-3.5" /> {t.aiCoach.demoNotice}
          </CardContent>
        </Card>
      )}

      {/* At-risk students */}
      {atRiskStudents.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <p className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
                {t.aiCoach.atRiskStudents}
              </p>
              <Badge tone="danger" variant="soft">{atRiskStudents.length}</Badge>
            </div>
            <div className="space-y-2">
              {atRiskStudents.map((r, i) => (
                <div key={i} className="rounded-md border border-rose-200/60 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/[0.08]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-medium text-[var(--fg)]">{r.fullName}</p>
                    <span className="font-mono text-[12px] text-[var(--fg-muted)] tabular-nums">
                      {r.currentGrade}% → {r.predictedFinalGrade}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{r.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class weaknesses */}
      {classWeaknesses.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-amber-500" />
              <p className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
                {t.aiCoach.classWeaknesses}
              </p>
            </div>
            <div className="space-y-3">
              {classWeaknesses.map((w, i) => (
                <div key={i} className="rounded-md bg-[var(--surface)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-medium text-[var(--fg)]">{w.topic}</p>
                    <span className="font-mono text-[12px] text-[var(--fg-muted)] tabular-nums">
                      {w.affectedPercent}% {t.aiCoach.affected}
                    </span>
                  </div>
                  <div className="mt-2">
                    <DsProgress value={w.affectedPercent} tone="warning" showPercent={false} />
                  </div>
                  <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
                    <span className="font-medium">{t.aiCoach.suggestionLabel}: </span>{w.suggestion}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* High performers */}
      {highPerformers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-500" />
              <p className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
                {t.aiCoach.highPerformers}
              </p>
            </div>
            <div className="space-y-2">
              {highPerformers.map((h, i) => (
                <div key={i} className="rounded-md border border-emerald-200/60 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/[0.08]">
                  <p className="text-[14px] font-medium text-[var(--fg)]">{h.fullName}</p>
                  <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{h.observation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
