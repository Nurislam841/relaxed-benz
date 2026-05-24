'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, CalendarClock, Award, FileText, Paperclip, Users, Send } from 'lucide-react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/form-elements';
import { Eyebrow } from '@/components/ds/eyebrow';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';

// Markdown rendering is heavy; defer until after first paint.
const MarkdownView = dynamic(
  () => import('@/components/markdown/markdown-view').then((m) => ({ default: m.MarkdownView })),
  { ssr: false },
);

interface AssignmentDetail {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueAt: string;
  maxScore: number;
  course?: { id: string; code: string; title: string };
  resources?: Array<{ id: string; fileName: string; fileUrl: string; fileSize?: number; mimeType?: string }>;
  _count?: { submissions: number };
}

interface MySubmission {
  id: string;
  status: string;
  submittedAt: string | null;
  contentText: string | null;
  contentUrl: string | null;
  grade?: { score: number; feedback: string | null } | null;
  attachments?: Array<{ fileName: string; fileUrl: string }>;
}

/**
 * Single assignment landing page.
 *
 * What it does:
 *   - Loads /assignments/:id (any authenticated user can read course content
 *     they're enrolled in — RBAC is enforced server-side).
 *   - Renders the title, due date, max score, description (Markdown), resources.
 *   - For students: shows their own submission status with a link to the
 *     submit/edit flow (which still lives in /courses/[id]/assignments).
 *   - For teachers/admins: links to the per-submission review pages.
 *
 * The full submit + grade UX lives on the assignments list (it uses dialogs).
 * This page is a lightweight detail/landing — typically reached by clicking
 * an item in the dashboard "upcoming assignments" widget or in a notification.
 */
export default function AssignmentDetailPage() {
  const { id: courseId, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const router = useRouter();
  const { data: user } = useMe();

  const { data: assignment, isLoading } = useQuery<AssignmentDetail>({
    queryKey: ['assignment-detail', assignmentId],
    queryFn: () => api.get(`/assignments/${assignmentId}`),
  });

  const isStudent = user?.role === 'STUDENT';
  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const { data: mySubmission } = useQuery<MySubmission | null>({
    queryKey: ['my-submission', assignmentId],
    queryFn: () => api.get(`/assignments/${assignmentId}/submission`),
    enabled: !!isStudent && !!assignmentId,
    // Server returns null/empty when no submission yet — don't error on that.
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-4">
        <p className="text-[14px] text-[var(--fg-muted)]">
          This assignment doesn't exist or you don't have access to it.
        </p>
        <Button variant="ghost" onClick={() => router.push(`/courses/${courseId}/assignments`)}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to assignments
        </Button>
      </div>
    );
  }

  const dueDate = new Date(assignment.dueAt);
  const isOverdue = dueDate < new Date();
  const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[var(--fg-muted)]">
        <Link
          href={`/courses/${courseId}/assignments`}
          className="flex items-center gap-1 hover:text-[var(--fg)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Assignments
        </Link>
        {assignment.course && (
          <>
            <span className="text-[var(--fg-subtle)]">/</span>
            <span>{assignment.course.code}</span>
          </>
        )}
      </div>

      {/* Header */}
      <div className="space-y-2">
        <Eyebrow>Assignment</Eyebrow>
        <h1 className="font-serif text-[28px] leading-tight tracking-[-0.015em] text-[var(--fg)]">
          {assignment.title}
        </h1>
        <div className="flex items-center gap-4 flex-wrap text-[13px] text-[var(--fg-muted)]">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Due {formatDateTime(assignment.dueAt)}
            {isOverdue ? (
              <Badge tone="danger" variant="soft" className="ml-1">
                overdue
              </Badge>
            ) : daysLeft <= 1 ? (
              <Badge tone="warning" variant="soft" className="ml-1">
                due {daysLeft === 0 ? 'today' : 'tomorrow'}
              </Badge>
            ) : (
              <span className="text-[var(--fg-subtle)]">· {daysLeft} days left</span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5" />
            {assignment.maxScore} pts max
          </span>
          {typeof assignment._count?.submissions === 'number' && isStaff && (
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {assignment._count.submissions} submission{assignment._count.submissions === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {assignment.description ? (
        <Card padding="lg">
          <Eyebrow className="mb-2">Description</Eyebrow>
          <MarkdownView source={assignment.description} />
        </Card>
      ) : (
        <Card padding="md">
          <p className="text-[13px] text-[var(--fg-muted)] italic">No description provided.</p>
        </Card>
      )}

      {/* Teacher-provided resources */}
      {assignment.resources && assignment.resources.length > 0 && (
        <Card padding="md">
          <Eyebrow className="mb-3">Resources</Eyebrow>
          <ul className="space-y-1.5">
            {assignment.resources.map((r) => (
              <li key={r.id}>
                <a
                  href={r.fileUrl}
                  download={r.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[13px] text-[var(--accent-700)] hover:underline"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {r.fileName}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Student: my submission status */}
      {isStudent && (
        <Card padding="md">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <Eyebrow>Your submission</Eyebrow>
              {mySubmission ? (
                <div className="text-[13px]">
                  <p className="font-medium">
                    {mySubmission.grade ? (
                      <>
                        Graded:{' '}
                        <span className="text-[var(--accent-700)]">
                          {mySubmission.grade.score} / {assignment.maxScore}
                        </span>
                      </>
                    ) : mySubmission.status === 'SUBMITTED' ? (
                      'Submitted, awaiting grade'
                    ) : mySubmission.status === 'DRAFT' ? (
                      'Draft saved (not submitted)'
                    ) : (
                      'Not submitted'
                    )}
                  </p>
                  {mySubmission.submittedAt && (
                    <p className="text-[12px] text-[var(--fg-muted)]">
                      Submitted {formatDateTime(mySubmission.submittedAt)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--fg-muted)]">No submission yet.</p>
              )}
            </div>
            <Link href={`/courses/${courseId}/assignments`}>
              <Button variant="primary" size="sm">
                <Send className="h-3.5 w-3.5" />
                {mySubmission ? 'Edit submission' : 'Submit'}
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Staff: jump to submissions */}
      {isStaff && (
        <Card padding="md">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <Eyebrow>Submissions</Eyebrow>
              <p className="text-[13px] text-[var(--fg-muted)] mt-1">
                Review and grade student submissions for this assignment.
              </p>
            </div>
            <Link href={`/courses/${courseId}/assignments`}>
              <Button variant="secondary" size="sm">
                <FileText className="h-3.5 w-3.5" />
                Open submissions list
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
