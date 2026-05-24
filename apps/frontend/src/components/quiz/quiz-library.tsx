'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Trash2, Eye, EyeOff, BookOpen, Radio, Brain, Pencil, Send } from 'lucide-react';
import { api } from '@/lib/api';
import type { SavedQuiz } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { toast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';

interface QuizLibraryProps {
  courseId: string;
  isTeacher: boolean;
  onPlay: (quizId: string) => void;
}

export function QuizLibrary({ courseId, isTeacher, onPlay }: QuizLibraryProps) {
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();

  const hostLive = useMutation({
    mutationFn: (quizId: string) => api.post<{ sessionId: string; joinCode: string }>('/kahoot/sessions', { quizId }),
    onSuccess: (r) => router.push(`/kahoot/host/${r.sessionId}`),
    onError: (e: Error) =>
      toast({ title: 'Could not host live session', description: e.message, variant: 'destructive' }),
  });

  /**
   * Telegram quiz broadcast (Phase 2.1). Fires the questions out as native
   * Telegram quiz polls to every linked student in the course. The endpoint
   * returns immediately; actual delivery is paced by the backend's rate
   * limiter, so a "Started" toast is the right UX — we don't await every
   * single poll over the wire.
   */
  const broadcastTelegram = useMutation({
    mutationFn: (quizId: string) =>
      api.post<{ recipientCount: number; questionCount: number }>(`/quizzes/${quizId}/broadcast-telegram`),
    onSuccess: (r) =>
      toast({
        title: '📡 Broadcast started',
        description:
          r.recipientCount === 0
            ? 'No linked students in this course yet.'
            : `Sending ${r.questionCount} questions to ${r.recipientCount} student${r.recipientCount === 1 ? '' : 's'}.`,
      }),
    onError: (e: Error) => toast({ title: 'Broadcast failed', description: e.message, variant: 'destructive' }),
  });

  const { data: quizzes = [], isLoading } = useQuery<SavedQuiz[]>({
    queryKey: ['quizzes', courseId],
    queryFn: () => api.get<SavedQuiz[]>(`/courses/${courseId}/quizzes`),
  });

  const togglePublish = useMutation({
    mutationFn: async (q: SavedQuiz) => api.patch(`/quizzes/${q.id}`, { isPublished: !q.isPublished }),
    onSuccess: (_d, q) => {
      qc.invalidateQueries({ queryKey: ['quizzes', courseId] });
      toast({ title: q.isPublished ? t.quizLibrary.unpublishedToast : t.quizLibrary.publishedToast });
    },
    onError: (e: Error) => toast({ title: t.common.error, description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/quizzes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quizzes', courseId] });
      toast({ title: t.quizLibrary.deletedToast });
    },
    onError: (e: Error) => toast({ title: t.common.error, description: e.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <Card padding="md">
        <div className="text-sm text-[var(--fg-muted)]">Loading…</div>
      </Card>
    );
  }

  if (!quizzes.length) {
    return (
      <Card padding="md">
        <div className="flex items-center gap-3 text-sm text-[var(--fg-muted)]">
          <BookOpen className="h-4 w-4" />
          {isTeacher ? t.quizLibrary.emptyTeacher : t.quizLibrary.emptyStudent}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      <Eyebrow>{t.quizLibrary.heading}</Eyebrow>
      <div className="space-y-2">
        {quizzes.map((q) => (
          <Card key={q.id} padding="md" hoverable>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[14px] font-semibold truncate">{q.title}</span>
                  {!q.isPublished && (
                    <Badge tone="warning" variant="soft">
                      {t.quizLibrary.draft}
                    </Badge>
                  )}
                  {q.source === 'AI_GENERATED' && (
                    <Badge tone="accent" variant="soft">
                      AI
                    </Badge>
                  )}
                </div>
                <div className="text-[12px] text-[var(--fg-muted)]">
                  {q._count?.questions ?? 0} {t.quizLibrary.questions}
                  {' · '}
                  {q._count?.attempts ?? 0} {t.quizLibrary.attempts}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => onPlay(q.id)}>
                  <Play className="h-3.5 w-3.5" />
                  {t.quizLibrary.start}
                </Button>

                {q.isPublished && (
                  <Button
                    size="sm"
                    variant="ai"
                    onClick={() => router.push(`/quizzes/${q.id}/adaptive`)}
                    title="Adaptive practice: difficulty steps up as you answer correctly, down as you miss"
                  >
                    <Brain className="h-3.5 w-3.5" />
                    Adaptive
                  </Button>
                )}

                {isTeacher && (
                  <>
                    <Button
                      size="sm"
                      variant="ai"
                      onClick={() => hostLive.mutate(q.id)}
                      disabled={hostLive.isPending}
                      title={t.quizLibrary.hostKahootTitle}
                    >
                      <Radio className="h-3.5 w-3.5" />
                      {t.quizLibrary.hostKahoot}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (
                          confirm(
                            `Broadcast "${q.title}" as native Telegram quiz polls to every linked student in this course?`,
                          )
                        )
                          broadcastTelegram.mutate(q.id);
                      }}
                      disabled={broadcastTelegram.isPending}
                      title="Send this quiz as native Telegram quiz polls to all linked students"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Broadcast to TG
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => router.push(`/quizzes/${q.id}/edit`)}
                      title="Edit questions"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => togglePublish.mutate(q)}
                      disabled={togglePublish.isPending}
                      title={q.isPublished ? t.quizLibrary.unpublish : t.quizLibrary.publish}
                    >
                      {q.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(t.quizLibrary.confirmDelete)) remove.mutate(q.id);
                      }}
                      disabled={remove.isPending}
                      title={t.quizLibrary.delete}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
