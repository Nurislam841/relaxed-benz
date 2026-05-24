'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, MessageSquare, Sparkles, BookOpen, Lightbulb, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import type { Announcement, Course, AiCourseSummary } from '@/lib/types';
import { useMe } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea, Skeleton } from '@/components/ui/form-elements';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { ThinkingDots } from '@/components/ai/thinking';
import { toast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';
import { useLanguage, useT } from '@/lib/i18n';
import { getAnnouncementContent } from '@/lib/announcement-content';
import dynamic from 'next/dynamic';

// Markdown editor/view ship react-markdown + remark-gfm (~80KB). They're only
// used when the user clicks "Post announcement" or renders an existing post,
// so defer them until after the page is interactive.
const MarkdownEditor = dynamic(
  () => import('@/components/markdown/markdown-editor').then((m) => ({ default: m.MarkdownEditor })),
  {
    ssr: false,
    loading: () => <div className="h-24 rounded-md bg-[var(--bg-subtle)] animate-pulse" />,
  },
);
const MarkdownView = dynamic(
  () => import('@/components/markdown/markdown-view').then((m) => ({ default: m.MarkdownView })),
  { ssr: false },
);

export default function OverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useMe();
  const qc = useQueryClient();
  const t = useT();
  const { lang } = useLanguage();

  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [summary, setSummary] = useState<AiCourseSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const { data: course } = useQuery<Course>({
    queryKey: ['course', id],
    queryFn: () => api.get(`/courses/${id}`),
  });

  const { data: anns, isLoading } = useQuery<Announcement[]>({
    queryKey: ['c-anns', id],
    queryFn: () => api.get(`/courses/${id}/announcements`),
  });

  const post = useMutation({
    mutationFn: (d: { title: string; body: string }) => api.post(`/courses/${id}/announcements`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['c-anns', id] });
      toast({ title: t.courseOverview.posted });
      setTitle('');
      setBody('');
      setShow(false);
    },
    onError: (e: any) => toast({ title: t.common.error, description: e.message, variant: 'destructive' }),
  });

  const handleSummary = async () => {
    setSummaryLoading(true);
    setSummary(null);
    try {
      const result = await api.post<AiCourseSummary>('/ai/course-summary', {
        courseId: id,
        lang,
      });
      setSummary(result);
    } catch (e: any) {
      toast({
        title: t.courseOverview.aiUnavailable,
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  const canPost = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  const workloadTone = {
    light: 'success' as const,
    moderate: 'warning' as const,
    heavy: 'danger' as const,
  };
  const workloadLabel = {
    light: t.courseOverview.workloadLight,
    moderate: t.courseOverview.workloadModerate,
    heavy: t.courseOverview.workloadHeavy,
  };

  return (
    <div className="space-y-5 mt-4">
      {/* Course info card */}
      <Card padding="lg">
        <p className="text-[14px] text-[var(--fg)] leading-[1.6]">
          {course?.description || t.courseOverview.noDescription}
        </p>
        {(course as any)?._count?.enrollments != null && (
          <div className="mt-4 text-[12px] font-mono text-[var(--fg-muted)]">
            {(course as any)._count.enrollments} {t.courseOverview.enrolled}
          </div>
        )}
      </Card>

      {/* AI Course Summary */}
      <div>
        {!summary && !summaryLoading && (
          <Button variant="ai" size="md" onClick={handleSummary}>
            <Sparkles className="h-3.5 w-3.5" />
            {t.courseOverview.aiSummary}
          </Button>
        )}

        {summaryLoading && (
          <Card
            padding="lg"
            className="border-[var(--accent-200)]"
            style={{
              background: 'linear-gradient(180deg, var(--accent-50), var(--surface))',
            }}
          >
            <div className="space-y-3">
              <ThinkingDots label={t.courseOverview.generatingSummary} />
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-3 w-full" />
              ))}
            </div>
          </Card>
        )}

        {summary && (
          <Card
            padding="lg"
            className="relative overflow-hidden border-[var(--accent-200)]"
            style={{
              background: 'linear-gradient(180deg, var(--accent-50), var(--surface))',
            }}
          >
            {/* glow */}
            <span
              aria-hidden
              className="absolute -top-5 -right-5 w-[160px] h-[160px] rounded-full pointer-events-none opacity-50"
              style={{
                background: 'radial-gradient(circle, var(--accent-200), transparent 60%)',
              }}
            />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-[7px] flex items-center justify-center text-white"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))',
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--fg)]">{t.courseOverview.aiSummary}</span>
                  {(summary as any)._demo && (
                    <Badge tone="accent" variant="soft">
                      {t.courseOverview.demo}
                    </Badge>
                  )}
                </div>
                <Badge tone={workloadTone[summary.workload] ?? 'neutral'}>
                  {workloadLabel[summary.workload] ?? summary.workload}
                </Badge>
              </div>

              <p className="text-[13px] text-[var(--fg)] leading-[1.6]">{summary.summary}</p>

              {summary.keyTopics.length > 0 && (
                <div>
                  <Eyebrow className="flex items-center gap-1.5 mb-1.5">
                    <BookOpen className="h-3 w-3" />
                    {t.courseOverview.keyTopics}
                  </Eyebrow>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.keyTopics.map((tt, i) => (
                      <Badge key={i} tone="neutral" variant="soft">
                        {tt}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {summary.tips.length > 0 && (
                <div>
                  <Eyebrow className="flex items-center gap-1.5 mb-1.5">
                    <Lightbulb className="h-3 w-3" />
                    {t.courseOverview.studyTips}
                  </Eyebrow>
                  <ul className="space-y-1">
                    {summary.tips.map((tip, i) => (
                      <li
                        key={i}
                        className="text-[12.5px] text-[var(--fg-muted)] flex items-start gap-1.5 leading-[1.55]"
                      >
                        <span className="text-[var(--accent-500)] mt-0.5">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button variant="ghost" size="sm" onClick={handleSummary}>
                <RotateCcw className="h-3 w-3" />
                {t.courseOverview.regenerate}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Post announcement */}
      {canPost &&
        (!show ? (
          <Button variant="secondary" size="md" onClick={() => setShow(true)}>
            <MessageSquare className="h-3.5 w-3.5" />
            {t.courseOverview.postAnnouncement}
          </Button>
        ) : (
          <Card padding="lg">
            <div className="space-y-3">
              <Input
                placeholder={t.courseOverview.titlePlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <MarkdownEditor placeholder={t.courseOverview.bodyPlaceholder} value={body} onChange={setBody} rows={4} />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShow(false)}>
                  {t.common.cancel}
                </Button>
                <Button variant="primary" onClick={() => post.mutate({ title, body })} disabled={!title || !body}>
                  <Send className="h-3.5 w-3.5" />
                  {t.common.post}
                </Button>
              </div>
            </div>
          </Card>
        ))}

      {/* Announcements stream */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Eyebrow>{t.courseOverview.streamTitle}</Eyebrow>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : !anns?.length ? (
          <Card className="flex flex-col items-center py-12 text-center gap-3 border-dashed">
            <div className="h-11 w-11 rounded-[12px] bg-[var(--bg-muted)] flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-[var(--fg-subtle)]" />
            </div>
            <div className="space-y-1">
              <p className="text-[13px] font-medium text-[var(--fg)]">{t.courseOverview.noAnnouncements}</p>
              <p className="text-[12px] text-[var(--fg-muted)] max-w-xs">
                {canPost
                  ? 'Post the first update to keep your students informed.'
                  : "Your instructor hasn't posted any updates yet."}
              </p>
            </div>
            {canPost && (
              <button
                onClick={() => setShow(true)}
                className="text-[12px] text-[var(--accent-700)] hover:underline mt-1"
              >
                Post the first announcement →
              </button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {anns.map((a) => {
              const content = getAnnouncementContent(a, lang);
              return (
                <Card key={a.id} padding="md" hoverable>
                  <h3 className="text-[14px] font-semibold text-[var(--fg)]">{content.title}</h3>
                  <p className="text-[11px] text-[var(--fg-muted)] font-mono mt-0.5">
                    {(a as any).author?.fullName} · {formatDateTime(a.createdAt)}
                  </p>
                  <div className="mt-2 text-[var(--fg-muted)]">
                    <MarkdownView source={content.body} compact />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
