'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Grade, Assignment, Submission, GradeStats, GradeSummary, StudentAttendanceStat } from '@/lib/types';
import { useMe } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea, Label, Select } from '@/components/ui/form-elements';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Award, BarChart2, Download, AlertTriangle, Sparkles, FileText } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime } from '@/lib/utils';

// ── Student view ──────────────────────────────────────────────────────────────
function StudentGrades({ courseId }: { courseId: string }) {
  const t = useT();
  const { data: myGrades, isLoading } = useQuery<Grade[]>({
    queryKey: ['my-grades'],
    queryFn: () => api.get('/me/grades'),
  });
  const { data: summary } = useQuery<GradeSummary[]>({
    queryKey: ['grade-summary'],
    queryFn: () => api.get('/me/grades/summary'),
  });

  const courseGrades = (myGrades || []).filter((g) => g.submission?.assignment?.course?.id === courseId);
  const courseSummary = (summary || []).find((s) => s.course?.id === courseId);

  if (isLoading)
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );

  return (
    <div className="space-y-6 mt-4">
      <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--fg)]">{t.grades.myGrades}</h2>

      {courseSummary && (
        <Card className="border-primary/20 bg-primary/5 dark:bg-primary/[0.07]">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Award className="h-7 w-7 text-primary" />
            </div>
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-2xl font-bold text-primary">{courseSummary.percentage}%</p>
                <p className="text-xs text-muted-foreground">{t.courseGrades.overall}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{courseSummary.totalEarned}</p>
                <p className="text-xs text-muted-foreground">{t.grades.pointsEarned}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{courseSummary.gradesCount}</p>
                <p className="text-xs text-muted-foreground">{t.grades.graded}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!courseGrades.length ? (
        <div className="flex flex-col items-center py-14 text-center gap-3">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-muted dark:bg-white/[0.04] flex items-center justify-center">
              <Award className="h-7 w-7 text-muted-foreground/30" />
            </div>
          </div>
          <div>
            <p className="font-serif font-medium text-foreground">{t.grades.noGrades}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Submit your assignments and your scores will appear here once your instructor reviews them.
            </p>
          </div>
          <Link href={`/courses/${courseId}/assignments`} className="text-sm text-primary hover:underline">
            View assignments →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {courseGrades.map((g) => (
            <Card key={g.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">{g.submission?.assignment?.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.courseGrades.gradedBy} {g.gradedBy?.fullName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary">
                      {g.score}
                      <span className="text-sm text-muted-foreground font-normal">
                        /{g.submission?.assignment?.maxScore}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((g.score / (g.submission?.assignment?.maxScore || 100)) * 100)}%
                    </p>
                  </div>
                </div>
                {g.feedback && (
                  <p className="text-sm text-muted-foreground mt-2 border-t pt-2 italic">&ldquo;{g.feedback}&rdquo;</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Teacher view ──────────────────────────────────────────────────────────────
function TeacherGrades({ courseId }: { courseId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const { data: asgns } = useQuery<Assignment[]>({
    queryKey: ['c-asgn', courseId],
    queryFn: () => api.get(`/courses/${courseId}/assignments`),
  });
  const { data: stats } = useQuery<GradeStats>({
    queryKey: ['grade-stats', courseId],
    queryFn: () => api.get(`/courses/${courseId}/grades/stats`),
  });
  const { data: courseGrades = [] } = useQuery<Grade[]>({
    queryKey: ['course-grades', courseId],
    queryFn: () => api.get(`/courses/${courseId}/grades`),
  });
  const { data: attendanceStats = [] } = useQuery<StudentAttendanceStat[]>({
    queryKey: ['attendance-stats', courseId],
    queryFn: () => api.get(`/courses/${courseId}/attendance/stats`),
  });
  const [selA, setSelA] = useState('');
  const { data: subs } = useQuery<Submission[]>({
    queryKey: ['subs', selA],
    queryFn: () => api.get(`/assignments/${selA}/submissions`),
    enabled: !!selA,
  });
  const [gOpen, setGOpen] = useState<Submission | null>(null);
  const [gs, setGs] = useState('');
  const [gf, setGf] = useState('');

  const gradeM = useMutation({
    mutationFn: ({ sid, d }: { sid: string; d: any }) => api.post(`/submissions/${sid}/grade`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subs', selA] });
      qc.invalidateQueries({ queryKey: ['grade-stats', courseId] });
      toast({ title: t.courseGrades.gradeSaved });
      setGOpen(null);
    },
    onError: () => toast({ title: t.common.error, variant: 'destructive' }),
  });

  const exportCsv = async () => {
    if (!asgns?.length) {
      toast({ title: t.courseGrades.exportEmpty, variant: 'destructive' });
      return;
    }

    setExporting(true);
    try {
      const submissionLists = await Promise.all(
        asgns.map(async (assignment) => ({
          assignment,
          submissions: await api.get<Submission[]>(`/assignments/${assignment.id}/submissions`).catch(() => []),
        })),
      );

      const rows = submissionLists.flatMap(({ assignment, submissions }) =>
        submissions.map((submission) => {
          const score = submission.grade?.score ?? '';
          const percentage = submission.grade
            ? Math.round((submission.grade.score / assignment.maxScore) * 1000) / 10
            : '';

          return [
            assignment.title,
            submission.student?.fullName || '',
            submission.student?.email || '',
            submission.status,
            submission.submittedAt ? formatDateTime(submission.submittedAt) : '',
            score,
            assignment.maxScore,
            percentage,
            submission.grade?.feedback || '',
            submission.grade?.gradedAt ? formatDateTime(submission.grade.gradedAt) : '',
          ];
        }),
      );

      if (!rows.length) {
        toast({ title: t.courseGrades.exportEmpty, variant: 'destructive' });
        return;
      }

      downloadCsv(
        `${t.courseGrades.exportFilename}-${courseId}.csv`,
        [
          t.courseGrades.exportAssignment,
          t.courseGrades.exportStudent,
          t.courseGrades.exportEmail,
          t.courseGrades.exportStatus,
          t.courseGrades.exportSubmittedAt,
          t.courseGrades.exportScore,
          t.courseGrades.exportMaxScore,
          t.courseGrades.exportPercentage,
          t.courseGrades.exportFeedback,
          t.courseGrades.exportGradedAt,
        ],
        rows,
      );

      toast({ title: t.courseGrades.exportReady });
    } catch (error: any) {
      toast({ title: t.common.error, description: error.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const attendanceByStudent = Object.fromEntries(attendanceStats.map((student) => [student.student.id, student]));

  const studentInsights = Object.values(
    courseGrades.reduce<
      Record<
        string,
        {
          student: { id: string; fullName: string; email?: string };
          totalScore: number;
          gradedItems: number;
          attendanceRate: number | null;
        }
      >
    >((acc, grade) => {
      const student = grade.submission?.student;
      if (!student) return acc;

      if (!acc[student.id]) {
        acc[student.id] = {
          student,
          totalScore: 0,
          gradedItems: 0,
          attendanceRate: attendanceByStudent[student.id]?.presentRate ?? null,
        };
      }

      acc[student.id].totalScore += grade.score;
      acc[student.id].gradedItems += 1;
      return acc;
    }, {}),
  ).map((item) => ({
    ...item,
    averageScore: item.gradedItems > 0 ? Math.round((item.totalScore / item.gradedItems) * 10) / 10 : null,
  }));

  const topStudents = [...studentInsights]
    .filter((student) => student.averageScore !== null)
    .sort((left, right) => {
      if ((right.averageScore ?? 0) !== (left.averageScore ?? 0)) {
        return (right.averageScore ?? 0) - (left.averageScore ?? 0);
      }
      return (right.attendanceRate ?? 0) - (left.attendanceRate ?? 0);
    })
    .slice(0, 3);

  const attentionStudents = [...studentInsights]
    .filter((student) => (student.averageScore ?? 101) < 60 || (student.attendanceRate ?? 101) < 75)
    .sort((left, right) => {
      const leftRisk = Math.min(left.averageScore ?? 100, left.attendanceRate ?? 100);
      const rightRisk = Math.min(right.averageScore ?? 100, right.attendanceRate ?? 100);
      return leftRisk - rightRisk;
    })
    .slice(0, 4);

  const averageAttendance = attendanceStats.length
    ? Math.round(
        (attendanceStats.reduce((sum, student) => sum + student.presentRate, 0) / attendanceStats.length) * 10,
      ) / 10
    : null;

  return (
    <div className="space-y-6 mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--fg)]">{t.courseGrades.gradebook}</h2>
        <div className="flex items-center gap-2">
          <a href={`/api/courses/${courseId}/grades.pdf`} download>
            <Button
              size="sm"
              variant="outline"
              type="button"
              className="gap-2"
              title="Download printable PDF gradebook"
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
          </a>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting} className="gap-2">
            <Download className="h-4 w-4" />
            {t.common.export}
          </Button>
        </div>
      </div>

      {stats && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/[0.07]">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium">{t.grades.courseAvg}</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {stats.courseAverage !== null ? `${stats.courseAverage} ${t.courseGrades.pointsShort}` : '—'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center sm:ml-auto sm:flex sm:gap-6">
              <div>
                <p className="text-lg font-bold">{stats.assignments.length}</p>
                <p className="text-xs text-muted-foreground">{t.courseLayout.assignments}</p>
              </div>
              <div>
                <p className="text-lg font-bold">{stats.assignments.reduce((a, b) => a + b.gradedCount, 0)}</p>
                <p className="text-xs text-muted-foreground">{t.grades.graded}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          {t.courseGrades.insights}
        </h3>

        {!studentInsights.length ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t.courseGrades.noInsights}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/[0.07]">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    {t.courseGrades.studentsTracked}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-300">
                    {studentInsights.length}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/[0.07]">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    {t.courseGrades.atRiskCount}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-amber-800 dark:text-amber-300">
                    {attentionStudents.length}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/[0.07]">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400">
                    {t.courseGrades.courseHealth}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-blue-800 dark:text-blue-300">
                    {averageAttendance !== null ? `${averageAttendance}%` : '—'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t.courseGrades.topStudents}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!topStudents.length ? (
                    <p className="text-sm text-muted-foreground">{t.courseGrades.noInsights}</p>
                  ) : (
                    topStudents.map((student) => (
                      <div
                        key={student.student.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{student.student.fullName}</p>
                          <p className="text-xs text-muted-foreground">{student.student.email}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">
                            {student.averageScore} {t.courseGrades.pointsShort}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {student.attendanceRate ?? '—'}% {t.courseGrades.attendanceRate.toLowerCase()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    {t.courseGrades.needsAttention}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!attentionStudents.length ? (
                    <p className="text-sm text-muted-foreground">{t.courseGrades.noInsights}</p>
                  ) : (
                    attentionStudents.map((student) => (
                      <div
                        key={student.student.id}
                        className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/[0.07] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{student.student.fullName}</p>
                            <p className="text-xs text-muted-foreground">{student.student.email}</p>
                          </div>
                          <Badge variant="outline" className="border-amber-300 text-amber-800">
                            {student.gradedItems} {t.courseGrades.gradedItems.toLowerCase()}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>
                            {t.courseGrades.avgScore}: {student.averageScore ?? '—'} {t.courseGrades.pointsShort}
                          </span>
                          <span>
                            {t.courseGrades.attendanceRate}: {student.attendanceRate ?? '—'}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {stats && stats.assignments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <BarChart2 className="h-4 w-4" />
            {t.courseGrades.perAssignmentAverages}
          </h3>
          <div className="space-y-2">
            {stats.assignments.map((a) => (
              <Card key={a.assignmentId}>
                <CardContent className="p-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.gradedCount}/{a.submissionsCount} {t.grades.graded.toLowerCase()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">
                      {a.averageScore !== null ? `${a.averageScore}/${a.maxScore}` : '—'}
                    </p>
                    {a.averageScore !== null && (
                      <p className="text-xs text-muted-foreground">
                        {Math.round((a.averageScore / a.maxScore) * 100)}%
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">{t.courseGrades.gradeSubmissions}</h3>
        <div className="mb-3">
          <Label>{t.grades.selectAssignment}</Label>
          <Select value={selA} onChange={(e) => setSelA(e.target.value)}>
            <option value="">{t.courseGrades.chooseAssignment}</option>
            {asgns?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </Select>
        </div>

        {selA && subs && (
          <div className="space-y-3">
            {!subs.length ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  {t.grades.noGrades}
                </CardContent>
              </Card>
            ) : (
              subs.map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{s.student?.fullName}</p>
                      <p className="text-xs text-muted-foreground">{s.student?.email}</p>
                      {s.contentText && <p className="text-xs mt-1 text-muted-foreground truncate">{s.contentText}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {s.grade ? (
                        <Badge variant="secondary">
                          {s.grade.score} {t.courseGrades.pointsShort}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          {t.grades.notGraded}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setGOpen(s);
                          setGs(s.grade?.score?.toString() || '');
                          setGf(s.grade?.feedback || '');
                        }}
                      >
                        {s.grade ? t.courseGrades.edit : t.common.grade}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      <Dialog open={!!gOpen} onOpenChange={() => setGOpen(null)}>
        <DialogHeader>
          <DialogTitle>
            {t.common.grade}: {gOpen?.student?.fullName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {gOpen?.contentText && (
            <div className="p-3 bg-muted rounded-lg text-sm max-h-32 overflow-y-auto">{gOpen.contentText}</div>
          )}
          <div>
            <Label>{t.courseGrades.score}</Label>
            <Input
              type="number"
              min={0}
              value={gs}
              onChange={(e) => setGs(e.target.value)}
              placeholder={t.courseGrades.score}
            />
          </div>
          <div>
            <Label>{t.courseGrades.feedbackOptional}</Label>
            <Textarea
              rows={3}
              value={gf}
              onChange={(e) => setGf(e.target.value)}
              placeholder={t.courseGrades.feedbackPlaceholder}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => {
              const parsed = parseFloat(gs);
              const selectedAsgn = asgns?.find((a) => a.id === selA);
              const max = selectedAsgn?.maxScore ?? 10000;
              if (isNaN(parsed) || parsed < 0 || parsed > max) {
                toast({ title: `Score must be between 0 and ${max}`, variant: 'destructive' });
                return;
              }
              gradeM.mutate({ sid: gOpen!.id, d: { score: parsed, feedback: gf || undefined } });
            }}
            disabled={!gs || gradeM.isPending}
          >
            {gradeM.isPending ? t.common.loading : `${t.common.save} ${t.common.grade}`}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GradesPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useMe();
  if (!user) return null;
  return user.role === 'STUDENT' ? <StudentGrades courseId={id} /> : <TeacherGrades courseId={id} />;
}
