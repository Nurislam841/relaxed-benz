'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, TrendingUp, AlertTriangle, Target, BookOpen, RotateCcw, User as UserIcon, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import { useLanguage, useT } from '@/lib/i18n';
import type { AiStudentAnalysis, Course, User } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label, Select, Skeleton } from '@/components/ui/form-elements';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { Alert } from '@/components/ds/alert';
import { DsAvatar } from '@/components/ds/avatar';
import { GenerationPanel, type GenStep } from '@/components/ai/generation-panel';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AiAnalysisPage() {
  const { data: user } = useMe();
  const { lang } = useLanguage();
  const t = useT();
  const ap = (t as any).aiAnalysisPage;
  const isStudent = user?.role === 'STUDENT';

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [analysis, setAnalysis] = useState<AiStudentAnalysis | null>(null);
  const [mode, setMode] = useState<'config' | 'generating' | 'results'>('config');
  const [steps, setSteps] = useState<GenStep[]>([]);

  // Auto-fill self for students
  useEffect(() => {
    if (isStudent && user?.id) setSelectedStudentId(user.id);
  }, [isStudent, user?.id]);

  // List courses (for filter)
  const { data: courses } = useQuery<Course[]>({
    queryKey: ['my-courses-list'],
    queryFn: () =>
      api.get<{ items: Course[] } | Course[]>('/courses').then((r) =>
        Array.isArray(r) ? r : r.items,
      ),
  });

  // For teachers/admins: list students from enrolled courses
  const { data: studentList } = useQuery<User[]>({
    queryKey: ['students-for-analysis', selectedCourseId],
    queryFn: async () => {
      if (selectedCourseId) {
        const enrollments = await api.get<any[]>(`/courses/${selectedCourseId}/participants`);
        return enrollments.filter((e: any) => e.roleInCourse === 'STUDENT').map((e: any) => e.user);
      }
      // gather from all enrolled courses
      const cs = (courses ?? []).slice(0, 5);
      const sets = await Promise.all(
        cs.map((c) => api.get<any[]>(`/courses/${c.id}/participants`).catch(() => [])),
      );
      const all = sets.flat().filter((e: any) => e?.roleInCourse === 'STUDENT').map((e: any) => e?.user);
      const seen = new Set<string>();
      return all.filter((u: any) => u && !seen.has(u.id) && seen.add(u.id));
    },
    enabled: !isStudent && !!courses,
  });

  const selectedStudent = isStudent
    ? user
    : (studentList ?? []).find((s) => s.id === selectedStudentId);

  const runAnalysis = async () => {
    if (!selectedStudentId) {
      toast({ title: ap.selectStudent, variant: 'destructive' });
      return;
    }
    setMode('generating');
    setSteps([
      { status: 'active', label: ap.step1, detail: ap.step1Detail },
      { status: 'pending', label: ap.step2 },
      { status: 'pending', label: ap.step3 },
    ]);

    const t1 = setTimeout(() => {
      setSteps((s) => s.map((x, i) => (i === 0 ? { ...x, status: 'done', time: '0.3s' } : i === 1 ? { ...x, status: 'active' } : x)));
    }, 500);

    try {
      const result = await api.post<AiStudentAnalysis>('/ai/student-analysis', {
        studentId: selectedStudentId,
        ...(selectedCourseId ? { courseId: selectedCourseId } : {}),
        lang,
      });
      clearTimeout(t1);
      setSteps((s) =>
        s.map((x, i) =>
          i === 0
            ? { ...x, status: 'done', time: '0.3s' }
            : i === 1
            ? { ...x, status: 'done', time: '1.4s' }
            : { ...x, status: 'done', time: '0.4s' }
        )
      );
      setAnalysis(result);
      setTimeout(() => setMode('results'), 350);
    } catch (e: any) {
      clearTimeout(t1);
      setSteps((s) => s.map((x) => (x.status === 'active' ? { ...x, status: 'error' } : x)));
      toast({ title: ap.failedAnalyze, description: e.message, variant: 'destructive' });
      setTimeout(() => setMode('config'), 1500);
    }
  };

  const reset = () => {
    setAnalysis(null);
    setMode('config');
    setSteps([]);
  };

  const riskTone =
    analysis?.riskLevel === 'high'
      ? 'danger'
      : analysis?.riskLevel === 'medium'
      ? 'warning'
      : 'success';

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <Eyebrow>{ap.eyebrow}</Eyebrow>
        <HDisplay size="md" as="h1">
          {ap.heroLeft} <em>{ap.heroEm}</em>
        </HDisplay>
        <p className="text-[14px] text-[var(--fg-muted)] max-w-[60ch]">
          {isStudent ? ap.studentSubtitle : ap.teacherSubtitle}
        </p>
      </div>

      {/* CONFIG */}
      {mode === 'config' && (
        <Card padding="lg" className="space-y-4">
          {!isStudent && (
            <>
              <div className="space-y-1.5">
                <Label>{ap.courseLabel}</Label>
                <Select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                >
                  <option value="">{ap.allCourses}</option>
                  {(courses ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{ap.studentLabel}</Label>
                <Select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  <option value="">{ap.studentPlaceholder}</option>
                  {(studentList ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} · {s.email}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          )}

          {isStudent && selectedStudent && (
            <Alert tone="info" icon={<UserIcon className="h-4 w-4" />} title={ap.selfTitle}>
              {ap.selfBody}
            </Alert>
          )}

          <Button
            variant="ai"
            size="lg"
            className="w-full"
            onClick={runAnalysis}
            disabled={!selectedStudentId}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {ap.generate}
          </Button>
        </Card>
      )}

      {/* GENERATING */}
      {mode === 'generating' && <GenerationPanel title={ap.generating} steps={steps} />}

      {/* RESULTS */}
      {mode === 'results' && analysis && (
        <div className="space-y-4">
          {/* Student card + risk */}
          {selectedStudent && (
            <Card
              padding="md"
              className="relative overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, var(--accent-50), var(--surface))',
              }}
            >
              <span
                aria-hidden
                className="absolute -top-12 -right-12 w-[180px] h-[180px] rounded-full pointer-events-none opacity-50"
                style={{
                  background: 'radial-gradient(circle, var(--accent-200), transparent 60%)',
                }}
              />
              <div className="relative flex items-center gap-4">
                <DsAvatar name={selectedStudent.fullName ?? '?'} size={48} />
                <div className="flex-1 min-w-0">
                  <Eyebrow>{ap.subjectLabel}</Eyebrow>
                  <p className="text-[16px] font-semibold text-[var(--fg)] truncate">
                    {selectedStudent.fullName}
                  </p>
                  <p className="text-[12px] text-[var(--fg-muted)] font-mono truncate">
                    {selectedStudent.email}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Eyebrow>{ap.riskLevelLabel}</Eyebrow>
                  <Badge tone={riskTone} variant="solid" className="mt-1 capitalize">
                    {analysis.riskLevel}
                  </Badge>
                </div>
              </div>
            </Card>
          )}

          {/* Main analysis */}
          <Card padding="lg" className="space-y-4">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-[7px] flex items-center justify-center text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))',
                }}
              >
                <Sparkles className="h-3 w-3" />
              </div>
              <Eyebrow>{ap.aiOverview}</Eyebrow>
            </div>
            <p className="text-[14px] text-[var(--fg)] leading-[1.6]">{analysis.analysis}</p>
          </Card>

          {/* Strengths */}
          {analysis.strengths.length > 0 && (
            <Card padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-[var(--success)]" />
                <Eyebrow className="text-[var(--success)]">{ap.strengths}</Eyebrow>
              </div>
              <ul className="space-y-1.5">
                {analysis.strengths.map((s, i) => (
                  <li
                    key={i}
                    className="text-[13.5px] flex items-start gap-2 text-[var(--fg)] leading-[1.55]"
                  >
                    <span className="text-[var(--success)] mt-0.5">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Areas to improve */}
          {analysis.areasToImprove.length > 0 && (
            <Card padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
                <Eyebrow className="text-[var(--warning)]">{ap.areasToImprove}</Eyebrow>
              </div>
              <ul className="space-y-1.5">
                {analysis.areasToImprove.map((s, i) => (
                  <li
                    key={i}
                    className="text-[13.5px] flex items-start gap-2 text-[var(--fg)] leading-[1.55]"
                  >
                    <span className="text-[var(--warning)] mt-0.5">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <Card padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-[var(--info)]" />
                <Eyebrow className="text-[var(--info)]">{ap.recommendations}</Eyebrow>
              </div>
              <ul className="space-y-2">
                {analysis.recommendations.map((s, i) => (
                  <li
                    key={i}
                    className={cn(
                      'flex items-start gap-2.5 p-3 rounded-[8px]',
                      'bg-[color:color-mix(in_oklch,var(--info),transparent_92%)]',
                      'border border-[color:color-mix(in_oklch,var(--info),transparent_75%)]'
                    )}
                  >
                    <ChevronRight className="h-4 w-4 text-[var(--info)] mt-0.5 shrink-0" />
                    <span className="text-[13.5px] text-[var(--fg)] leading-[1.55]">{s}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Button variant="secondary" size="md" className="w-full" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            {ap.newAnalysis}
          </Button>
        </div>
      )}
    </div>
  );
}
