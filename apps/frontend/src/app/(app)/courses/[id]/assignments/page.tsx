'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Assignment,
  AssignmentResource,
  Submission,
  AiFeedback,
  PaginatedResponse,
  AssignmentComment,
} from '@/lib/types';
import { useMe } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea, Label, Skeleton } from '@/components/ui/form-elements';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { toast } from '@/hooks/use-toast';
import { formatDateTime, formatDate, cn } from '@/lib/utils';
import { useState, useRef, useCallback, useMemo } from 'react';
import {
  Plus,
  Clock,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  TrendingUp,
  Award,
  CalendarClock,
  ClipboardList,
  List,
  GitBranch,
  Upload,
  FileUp,
  Code2,
  ExternalLink,
  X,
  AlignLeft,
  Brain,
  Loader2,
  MessageSquare,
  ChevronDown,
  LayoutGrid,
  Save,
  Paperclip,
  File as FileIcon,
  Image as ImageIcon,
  Archive,
  FileText,
  Trash2,
  BookOpen,
  Users,
  ChevronRight,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage, useT } from '@/lib/i18n';
import { motion, type Variants } from 'framer-motion';
import { useInView } from 'framer-motion';
import { Segment } from '@/components/ds/segment';
import dynamic from 'next/dynamic';

// Markdown editor/view pulls in react-markdown + remark-gfm (~80KB).
// Only the create-assignment dialog and the text-submission tab use them,
// both of which are below-the-fold for the initial page render.
const MarkdownEditor = dynamic(
  () => import('@/components/markdown/markdown-editor').then((m) => ({ default: m.MarkdownEditor })),
  {
    ssr: false,
    loading: () => <div className="h-32 rounded-md bg-muted/30 animate-pulse" />,
  },
);
const MarkdownView = dynamic(
  () => import('@/components/markdown/markdown-view').then((m) => ({ default: m.MarkdownView })),
  { ssr: false },
);

// ─── Status + urgency ─────────────────────────────────────────────────────────

type AssignmentStatus = 'pending' | 'submitted' | 'late' | 'graded';
type DueUrgency = 'overdue' | 'today' | 'soon' | 'normal';

function getAssignmentStatus(a: Assignment, submission?: Submission): AssignmentStatus {
  if (submission?.grade != null) return 'graded';
  if (submission && submission.status !== 'DRAFT') return 'submitted';
  if (new Date(a.dueAt) < new Date()) return 'late';
  return 'pending';
}

function getDueUrgency(dueAt: string): DueUrgency {
  const diff = Math.floor((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 3) return 'soon';
  return 'normal';
}

const STATUS_CONFIG: Record<
  AssignmentStatus,
  {
    label: string;
    icon: React.ElementType;
    accent: string;
    badge: string;
    badgeDark: string;
  }
> = {
  pending: {
    label: 'Open',
    icon: Clock,
    accent: 'bg-emerald-500 dark:bg-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeDark: 'dark:bg-emerald-500/[0.12] dark:text-emerald-300 dark:border-emerald-500/30',
  },
  submitted: {
    label: 'Submitted',
    icon: CheckCircle2,
    accent: 'bg-blue-500 dark:bg-blue-400',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeDark: 'dark:bg-blue-500/[0.12] dark:text-blue-300 dark:border-blue-500/30',
  },
  late: {
    label: 'Past Due',
    icon: AlertCircle,
    accent: 'bg-rose-500 dark:bg-rose-400',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    badgeDark: 'dark:bg-rose-500/[0.12] dark:text-rose-300 dark:border-rose-500/30',
  },
  graded: {
    label: 'Graded',
    icon: Award,
    accent: 'bg-amber-500 dark:bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeDark: 'dark:bg-amber-500/[0.12] dark:text-amber-300 dark:border-amber-500/30',
  },
};

// ─── Variants ─────────────────────────────────────────────────────────────────

const LIST_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const CARD_ITEM: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

// ─── CommentThread ─────────────────────────────────────────────────────────────

function CommentThread({ assignmentId, currentUserId }: { assignmentId: string; currentUserId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');

  const { data: comments = [], isLoading } = useQuery<AssignmentComment[]>({
    queryKey: ['comments', assignmentId],
    queryFn: () => api.get(`/assignments/${assignmentId}/comments`),
    enabled: open,
  });

  const addComment = useMutation({
    mutationFn: (b: string) => api.post(`/assignments/${assignmentId}/comments`, { body: b }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', assignmentId] });
      setBody('');
    },
  });

  return (
    <div className="border-t border-border/30 dark:border-white/[0.05]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 dark:hover:bg-white/[0.03] transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Discussion
        {comments.length > 0 && (
          <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 py-0 text-[10px] font-medium">
            {comments.length}
          </span>
        )}
        <ChevronDown className={cn('h-3 w-3 ml-auto transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          className="px-4 pb-3 space-y-3"
        >
          {isLoading ? (
            <div className="space-y-2 pt-1">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="h-6 w-6 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
                    <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 py-1 text-center">No comments yet. Start the discussion.</p>
          ) : (
            <div className="space-y-2.5 pt-1">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5 items-start">
                  <div
                    className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5',
                      c.author.role === 'TEACHER' || c.author.role === 'ADMIN'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {c.author.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-foreground">{c.author.fullName}</span>
                      {(c.author.role === 'TEACHER' || c.author.role === 'ADMIN') && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1 py-0 rounded-full">
                          {c.author.role === 'ADMIN' ? 'Admin' : 'Teacher'}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/60 ml-auto">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 text-xs rounded-md border border-border/50 bg-background dark:bg-white/[0.04] px-2.5 py-1.5 outline-none focus:border-primary/50 dark:focus:border-primary/40 placeholder:text-muted-foreground/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && body.trim()) {
                  e.preventDefault();
                  addComment.mutate(body.trim());
                }
              }}
            />
            <button
              onClick={() => body.trim() && addComment.mutate(body.trim())}
              disabled={!body.trim() || addComment.isPending}
              className="shrink-0 rounded-md bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {addComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── AssignmentCard ───────────────────────────────────────────────────────────

function AssignmentCard({
  assignment,
  submission,
  isStu,
  canC,
  onSubmit,
  onAiFeedback,
  onAiExplain,
  currentUserId,
  t,
}: {
  assignment: Assignment;
  submission?: Submission;
  isStu: boolean;
  canC: boolean;
  onSubmit: (id: string) => void;
  onAiFeedback: (id: string) => void;
  onAiExplain: (a: Assignment) => void;
  currentUserId: string;
  t: ReturnType<typeof useT>;
}) {
  const status = getAssignmentStatus(assignment, submission);
  const urgency = status === 'pending' || status === 'late' ? getDueUrgency(assignment.dueAt) : 'normal';
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;
  const ref = useRef<HTMLDivElement>(null);
  useInView(ref, { once: true, margin: '-40px' });

  const isCritical = status === 'late' || (status === 'pending' && (urgency === 'today' || urgency === 'overdue'));
  const isNormal = status === 'pending' && urgency === 'normal';

  const isOverdue = new Date(assignment.dueAt) < new Date();
  const daysUntilDue = Math.ceil((new Date(assignment.dueAt).getTime() - Date.now()) / 86_400_000);

  // Teacher: submissions list state
  const [subsOpen, setSubsOpen] = useState(false);
  const qc = useQueryClient();
  const { data: allSubsList = [], isLoading: subsLoading } = useQuery<Submission[]>({
    queryKey: ['a-subs', assignment.id],
    queryFn: () => api.get(`/assignments/${assignment.id}/submissions`),
    enabled: canC && subsOpen,
  });

  type PlagiarismReportRow = {
    id: string;
    similarity: number;
    submissionA: { id: string; studentId: string; student: { fullName: string } };
    submissionB: { id: string; studentId: string; student: { fullName: string } };
  };

  const { data: plagReports = [] } = useQuery<PlagiarismReportRow[]>({
    queryKey: ['a-plag', assignment.id],
    queryFn: () => api.get(`/assignments/${assignment.id}/plagiarism-reports`),
    enabled: canC && subsOpen,
  });

  // Index: submissionId → highest match (other student + similarity)
  const plagBySub = useMemo(() => {
    const out: Record<string, { otherName: string; pct: number }> = {};
    for (const r of plagReports) {
      const aPct = Math.round(r.similarity * 100);
      const updateIfHigher = (sid: string, otherName: string) => {
        if (!out[sid] || out[sid].pct < aPct) out[sid] = { otherName, pct: aPct };
      };
      updateIfHigher(r.submissionA.id, r.submissionB.student.fullName);
      updateIfHigher(r.submissionB.id, r.submissionA.student.fullName);
    }
    return out;
  }, [plagReports]);

  const runPlagiarism = useMutation({
    mutationFn: () =>
      api.post<{ pairsFound: number; submissionsAnalyzed: number }>(
        `/assignments/${assignment.id}/check-plagiarism`,
        {},
      ),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['a-plag', assignment.id] });
      toast({
        title: 'Plagiarism check complete',
        description: `Analyzed ${r.submissionsAnalyzed} submissions, found ${r.pairsFound} suspicious pairs.`,
      });
    },
    onError: (e: Error) => toast({ title: 'Check failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <motion.div ref={ref} variants={CARD_ITEM}>
      <motion.div
        whileHover={{ y: isCritical ? -4 : isNormal ? -1 : -3, scale: isCritical ? 1.018 : isNormal ? 1.003 : 1.008 }}
        animate={{ scale: isCritical ? 1.01 : isNormal ? 0.995 : 1 }}
        transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        className={cn(
          'relative rounded-lg border overflow-hidden cursor-default',
          'bg-background shadow-card hover:shadow-lift',
          'dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/[0.07]',
          'transition-shadow duration-150',
          // Normal cards: slightly muted, full opacity on hover
          isNormal && 'opacity-[0.82] hover:opacity-100 transition-opacity duration-200',
          // Ambient dark glow for urgent cards
          status === 'late' && 'dark:shadow-[0_2px_16px_-6px_hsl(0_72%_54%_/_.24)]',
          urgency === 'today' && status === 'pending' && 'dark:shadow-[0_2px_16px_-6px_hsl(38_80%_60%_/_.20)]',
          // Hover glow
          status === 'late' && 'dark:hover:shadow-[0_4px_28px_-4px_hsl(0_72%_54%_/_.40)]',
          urgency === 'today' && status === 'pending' && 'dark:hover:shadow-[0_4px_24px_-4px_hsl(38_80%_60%_/_.34)]',
          urgency === 'soon' && status === 'pending' && 'dark:hover:shadow-[0_4px_20px_-4px_hsl(38_72%_54%_/_.22)]',
          status === 'submitted' && 'dark:hover:shadow-[0_4px_20px_-4px_hsl(213_80%_60%_/_.18)]',
          status === 'graded' && 'dark:hover:shadow-[0_4px_20px_-4px_hsl(38_80%_60%_/_.18)]',
          urgency === 'normal' && status === 'pending' && 'dark:hover:shadow-[0_4px_20px_-4px_hsl(142_72%_54%_/_.14)]',
        )}
      >
        {/* Accent bar — pulses for today */}
        {urgency === 'today' && status === 'pending' ? (
          <motion.div
            className="absolute top-0 left-0 right-0 h-[3px] bg-amber-400 dark:bg-amber-300"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : urgency === 'soon' && status === 'pending' ? (
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500 dark:bg-amber-400" />
        ) : (
          <div className={cn('absolute top-0 left-0 right-0 h-[3px]', cfg.accent)} />
        )}

        <div className={cn('p-4 pt-5', isCritical && 'p-5 pt-6')}>
          <div className="flex items-start gap-3">
            {/* Icon badge */}
            <div
              className={cn(
                'mt-0.5 rounded-md flex items-center justify-center shrink-0',
                isCritical ? 'h-9 w-9' : 'h-8 w-8',
                status === 'pending' && urgency === 'today' && 'bg-amber-50 dark:bg-amber-500/[0.15]',
                status === 'pending' && urgency === 'soon' && 'bg-amber-50 dark:bg-amber-500/[0.10]',
                status === 'pending' && urgency === 'normal' && 'bg-emerald-50 dark:bg-emerald-500/[0.12]',
                status === 'submitted' && 'bg-blue-50 dark:bg-blue-500/[0.12]',
                status === 'late' && 'bg-rose-50 dark:bg-rose-500/[0.14]',
                status === 'graded' && 'bg-amber-50 dark:bg-amber-500/[0.12]',
              )}
            >
              <StatusIcon
                className={cn(
                  isCritical ? 'h-4.5 w-4.5' : 'h-4 w-4',
                  status === 'pending' && urgency === 'today' && 'text-amber-600 dark:text-amber-400',
                  status === 'pending' && urgency === 'soon' && 'text-amber-500 dark:text-amber-400',
                  status === 'pending' && urgency === 'normal' && 'text-emerald-600 dark:text-emerald-400',
                  status === 'submitted' && 'text-blue-600 dark:text-blue-400',
                  status === 'late' && 'text-rose-600 dark:text-rose-400',
                  status === 'graded' && 'text-amber-600 dark:text-amber-400',
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3
                  className={cn(
                    'font-serif font-semibold text-foreground leading-tight',
                    isCritical ? 'text-base' : 'text-sm',
                  )}
                >
                  {assignment.title}
                </h3>
                {/* Urgency-aware badge */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0',
                    urgency === 'today' && status === 'pending'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/[0.12] dark:text-amber-300 dark:border-amber-500/30'
                      : urgency === 'soon' && status === 'pending'
                        ? 'bg-amber-50/70 text-amber-600 border-amber-200/70 dark:bg-amber-500/[0.08] dark:text-amber-400 dark:border-amber-500/25'
                        : cn(cfg.badge, cfg.badgeDark),
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {urgency === 'today' && status === 'pending'
                    ? 'Due today'
                    : urgency === 'soon' && status === 'pending'
                      ? `${daysUntilDue}d left`
                      : cfg.label}
                </span>
              </div>
              {assignment.description && (
                <p
                  className={cn(
                    'text-sm leading-relaxed mt-1 line-clamp-2',
                    isCritical ? 'text-foreground/70' : 'text-muted-foreground',
                  )}
                >
                  {assignment.description}
                </p>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span
              className={cn(
                'flex items-center gap-1',
                isOverdue &&
                  status !== 'submitted' &&
                  status !== 'graded' &&
                  'text-rose-600 dark:text-rose-400 font-medium',
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {t.courseAssignments.due}: {formatDateTime(assignment.dueAt)}
            </span>
            <span className="flex items-center gap-1">
              <Award className="h-3.5 w-3.5" />
              {assignment.maxScore} {t.courseAssignments.pointsShort}
            </span>
            {status === 'graded' && submission?.grade != null && (
              <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <TrendingUp className="h-3.5 w-3.5" />
                {submission.grade.score} / {assignment.maxScore}
              </span>
            )}
          </div>

          {/* Teacher-uploaded resources */}
          {(assignment.resources?.length ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-border/30 dark:border-white/[0.04]">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> Resources
              </p>
              <div className="flex flex-wrap gap-1.5">
                {assignment.resources!.map((r) => (
                  <a
                    key={r.id}
                    href={r.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md border border-border/50 dark:border-white/[0.07] bg-blue-50/50 dark:bg-blue-500/[0.07] px-2 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100/60 dark:hover:bg-blue-500/[0.12] transition-colors max-w-[160px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{r.fileName}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Submission preview — attachments */}
          {submission && (submission.attachments?.length ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-border/30 dark:border-white/[0.04]">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Paperclip className="h-3 w-3" /> {submission.attachments!.length} attachment
                {submission.attachments!.length !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {submission.attachments!.map((a) => (
                  <a
                    key={a.id}
                    href={a.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md border border-border/50 dark:border-white/[0.07] bg-muted/30 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60 transition-colors max-w-[160px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileIcon className="h-3 w-3 text-primary/70 shrink-0" />
                    <span className="truncate">{a.fileName}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Draft indicator */}
          {submission?.status === 'DRAFT' && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
              <Save className="h-3 w-3" /> Draft saved — not yet submitted
            </div>
          )}

          {/* Actions */}
          {(isStu || canC) && (
            <div className="mt-3.5 pt-3 border-t border-border/40 dark:border-white/[0.05] flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {status === 'submitted' && (
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {t.courseAssignments.submitted}
                  </span>
                )}
                {status === 'graded' && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Award className="h-3 w-3" />
                    Graded
                  </span>
                )}
              </div>
              {isStu && (
                <div className="flex items-center gap-2">
                  {status !== 'graded' && (
                    <Button
                      size="sm"
                      variant={status === 'submitted' ? 'outline' : 'default'}
                      className="gap-1.5 h-7 text-xs"
                      onClick={() => onSubmit(assignment.id)}
                    >
                      <Send className="h-3 w-3" />
                      {status === 'submitted' ? 'Resubmit' : t.courseAssignments.submit}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs border-purple-200/80 text-purple-700 hover:bg-purple-50 dark:border-purple-500/30 dark:text-purple-300 dark:hover:bg-purple-500/[0.08]"
                    onClick={() => onAiFeedback(assignment.id)}
                    title={submission ? t.courseAssignments.aiFeedbackHint : t.courseAssignments.aiFeedbackHintDisabled}
                  >
                    <Sparkles className="h-3 w-3" />
                    {t.courseAssignments.aiFeedback}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs border-blue-200/80 text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/[0.08]"
                    onClick={() => onAiExplain(assignment)}
                    title="Explain this assignment and suggest an approach"
                  >
                    <Brain className="h-3 w-3" />
                    Explain
                  </Button>
                </div>
              )}
              {canC && (
                <button
                  onClick={() => setSubsOpen(true)}
                  className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {assignment._count?.submissions ?? 0} submission
                    {(assignment._count?.submissions ?? 0) !== 1 ? 's' : ''}
                  </span>
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
              )}
            </div>
          )}
        </div>
        <CommentThread assignmentId={assignment.id} currentUserId={currentUserId} />
      </motion.div>

      {/* Teacher: submissions list dialog */}
      {canC && (
        <Dialog open={subsOpen} onOpenChange={setSubsOpen}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Submissions — {assignment.title}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-1">
            {subsLoading ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
                      <div className="h-2.5 w-1/2 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : allSubsList.length === 0 ? (
              <div className="py-10 text-center">
                <div className="h-12 w-12 rounded-xl bg-muted dark:bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <p className="text-sm text-muted-foreground">No submissions yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Students haven't submitted this assignment.</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1 -mr-1">
                {/* Summary row + plagiarism action */}
                <div className="flex items-center justify-between gap-3 px-3 py-2 mb-1 rounded-lg bg-muted/30 dark:bg-white/[0.03] text-xs">
                  <div className="text-muted-foreground">
                    <span className="font-medium text-foreground">{allSubsList.length}</span> total ·{' '}
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {allSubsList.filter((s) => s.grade).length}
                    </span>{' '}
                    graded ·{' '}
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {allSubsList.filter((s) => s.status === 'SUBMITTED' && !s.grade).length}
                    </span>{' '}
                    pending
                    {plagReports.length > 0 && (
                      <>
                        {' · '}
                        <span className="text-rose-600 dark:text-rose-400 font-medium">{plagReports.length}</span>{' '}
                        suspicious pair{plagReports.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => runPlagiarism.mutate()}
                    disabled={runPlagiarism.isPending || allSubsList.length < 2}
                    title="Run pairwise Jaccard 3-gram similarity check on all submitted text"
                  >
                    {runPlagiarism.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ShieldAlert className="h-3 w-3" />
                    )}
                    Check plagiarism
                  </Button>
                </div>

                {allSubsList.map((sub) => {
                  const subStatus: 'graded' | 'submitted' | 'draft' = sub.grade
                    ? 'graded'
                    : sub.status === 'SUBMITTED'
                      ? 'submitted'
                      : 'draft';
                  const isLate = !!(sub.submittedAt && new Date(sub.submittedAt) > new Date(assignment.dueAt));

                  return (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 dark:hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Avatar */}
                      <div className="h-8 w-8 rounded-full bg-primary/10 dark:bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {(sub.student?.fullName ?? '?').charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{sub.student?.fullName ?? 'Unknown'}</span>
                          {isLate && (
                            <span className="text-[10px] font-medium px-1.5 py-0 rounded-full bg-rose-50 text-rose-600 border border-rose-200/70 dark:bg-rose-500/[0.1] dark:text-rose-300 dark:border-rose-500/25">
                              Late
                            </span>
                          )}
                          {plagBySub[sub.id] && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0 rounded-full border',
                                plagBySub[sub.id].pct >= 70
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/[0.12] dark:text-rose-300 dark:border-rose-500/30'
                                  : plagBySub[sub.id].pct >= 40
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/[0.12] dark:text-amber-300 dark:border-amber-500/30'
                                    : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/[0.12] dark:text-yellow-200 dark:border-yellow-500/30',
                              )}
                              title={`${plagBySub[sub.id].pct}% similar to ${plagBySub[sub.id].otherName}`}
                            >
                              <ShieldAlert className="h-2.5 w-2.5" />
                              {plagBySub[sub.id].pct}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          {sub.submittedAt ? (
                            <span>
                              {new Date(sub.submittedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          ) : (
                            <span>Not submitted</span>
                          )}
                          {subStatus === 'graded' && sub.grade && (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <Award className="h-2.5 w-2.5" />
                              {sub.grade.score}/{assignment.maxScore}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status + review button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                            subStatus === 'graded'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/[0.1] dark:text-amber-300 dark:border-amber-500/25'
                              : subStatus === 'submitted'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/[0.1] dark:text-blue-300 dark:border-blue-500/25'
                                : 'bg-muted text-muted-foreground border-border',
                          )}
                        >
                          {subStatus === 'graded' ? 'Graded' : subStatus === 'submitted' ? 'Submitted' : 'Draft'}
                        </span>
                        <Link
                          href={`/courses/${assignment.courseId}/assignments/${assignment.id}/submissions/${sub.id}`}
                          onClick={() => setSubsOpen(false)}
                          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Eye className="h-3 w-3" /> Review
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </motion.div>
  );
}

// ─── Timeline node ─────────────────────────────────────────────────────────────

function TimelineNode({
  assignment,
  submission,
  isStu,
  canC,
  onSubmit,
  onAiFeedback,
  onAiExplain,
  t,
  isFirst,
  isLast,
  prevDone,
}: {
  assignment: Assignment;
  submission?: Submission;
  isStu: boolean;
  canC: boolean;
  onSubmit: (id: string) => void;
  onAiFeedback: (id: string) => void;
  onAiExplain: (a: Assignment) => void;
  t: ReturnType<typeof useT>;
  isFirst: boolean;
  isLast: boolean;
  prevDone: boolean;
}) {
  const status = getAssignmentStatus(assignment, submission);
  const urgency = status === 'pending' || status === 'late' ? getDueUrgency(assignment.dueAt) : 'normal';
  const isCritical = status === 'late' || (status === 'pending' && (urgency === 'today' || urgency === 'overdue'));
  const isDone = status === 'graded' || status === 'submitted';
  const StatusIcon = STATUS_CONFIG[status].icon;

  const nodeClass = cn(
    'relative flex items-center justify-center rounded-full border-2 shrink-0 transition-all duration-150',
    isCritical ? 'h-6 w-6' : 'h-5 w-5',
    status === 'graded' && 'bg-amber-400 border-amber-500 dark:bg-amber-400 dark:border-amber-400',
    status === 'submitted' && 'bg-blue-400 border-blue-500 dark:bg-blue-400 dark:border-blue-400',
    status === 'late' && 'bg-rose-500 border-rose-500 dark:bg-rose-400 dark:border-rose-400',
    status === 'pending' && (urgency === 'today' || urgency === 'overdue')
      ? 'bg-amber-400 border-amber-400 dark:bg-amber-300 dark:border-amber-300'
      : status === 'pending' && urgency === 'soon'
        ? 'bg-background border-amber-400 dark:bg-card dark:border-amber-400'
        : status === 'pending'
          ? 'bg-background border-emerald-500 dark:bg-card dark:border-emerald-400'
          : '',
  );

  const topLineClass = cn(
    'w-px shrink-0',
    isFirst ? 'h-2' : 'h-3',
    prevDone ? 'bg-primary/50 dark:bg-primary/45' : 'bg-border/50 dark:bg-white/[0.08]',
  );

  const bottomLineClass = 'w-px flex-1 min-h-[2.5rem] bg-border/50 dark:bg-white/[0.08]';

  return (
    <motion.div variants={CARD_ITEM} className="flex gap-4">
      {/* Vertical track */}
      <div className="flex flex-col items-center">
        <div className={topLineClass} />
        <div className={nodeClass}>
          <StatusIcon
            className={cn(
              'shrink-0',
              isCritical ? 'h-3 w-3' : 'h-2.5 w-2.5',
              status === 'graded' ||
                status === 'submitted' ||
                status === 'late' ||
                (status === 'pending' && (urgency === 'today' || urgency === 'overdue'))
                ? 'text-white dark:text-background'
                : 'text-emerald-600 dark:text-emerald-400',
            )}
          />
          {/* Pulse ring for today */}
          {urgency === 'today' && status === 'pending' && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-amber-400"
              animate={{ scale: [1, 1.9], opacity: [0.8, 0] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          {/* Glow ring for late */}
          {status === 'late' && (
            <div className="absolute inset-0 rounded-full ring-2 ring-rose-400/40 dark:ring-rose-400/60 dark:shadow-[0_0_8px_hsl(0_72%_54%_/_.4)]" />
          )}
        </div>
        {!isLast && <div className={bottomLineClass} />}
      </div>

      {/* Content card */}
      <div className={cn('flex-1 min-w-0', isLast ? 'pb-0' : 'pb-4')}>
        <motion.div
          whileHover={{ x: 3 }}
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          className={cn(
            'rounded-lg border p-3.5 transition-all duration-150',
            'bg-background dark:bg-card/80 dark:backdrop-blur-sm',
            isCritical
              ? 'border-rose-200/60 dark:border-rose-400/20 dark:shadow-[0_2px_12px_-4px_hsl(0_72%_54%_/_.22)]'
              : urgency === 'today' && status === 'pending'
                ? 'border-amber-200/60 dark:border-amber-400/20'
                : 'border-border/40 dark:border-white/[0.06]',
            'hover:shadow-lift dark:hover:shadow-glass',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif font-medium text-sm text-foreground leading-snug">{assignment.title}</h3>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0',
                urgency === 'today' && status === 'pending'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/[0.12] dark:text-amber-300 dark:border-amber-500/30'
                  : cn(STATUS_CONFIG[status].badge, STATUS_CONFIG[status].badgeDark),
              )}
            >
              <StatusIcon className="h-2.5 w-2.5" />
              {urgency === 'today' && status === 'pending' ? 'Today' : STATUS_CONFIG[status].label}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
            <span
              className={cn(
                'flex items-center gap-1',
                isCritical && 'text-rose-600 dark:text-rose-400 font-medium',
                urgency === 'today' && status === 'pending' && 'text-amber-600 dark:text-amber-400 font-medium',
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {formatDateTime(assignment.dueAt)}
            </span>
            <span className="flex items-center gap-1">
              <Award className="h-3 w-3" />
              {assignment.maxScore}pts
            </span>
            {status === 'graded' && submission?.grade != null && (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {submission.grade.score}/{assignment.maxScore}
              </span>
            )}
          </div>

          {isStu && (
            <div className="flex gap-2 mt-2.5">
              {status !== 'graded' && (
                <Button
                  size="sm"
                  variant={status === 'submitted' ? 'outline' : 'default'}
                  className="h-6 text-[11px] gap-1"
                  onClick={() => onSubmit(assignment.id)}
                >
                  <Send className="h-2.5 w-2.5" />
                  {status === 'submitted' ? 'Resubmit' : t.courseAssignments.submit}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] gap-1 border-purple-200/80 text-purple-700 hover:bg-purple-50 dark:border-purple-500/30 dark:text-purple-300 dark:hover:bg-purple-500/[0.08]"
                onClick={() => onAiFeedback(assignment.id)}
              >
                <Sparkles className="h-2.5 w-2.5" />
                AI
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] gap-1 border-blue-200/80 text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/[0.08]"
                onClick={() => onAiExplain(assignment)}
              >
                <Brain className="h-2.5 w-2.5" />
                Explain
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Timeline view ─────────────────────────────────────────────────────────────

function TimelineView({
  assignments,
  submissions,
  isStu,
  canC,
  onSubmit,
  onAiFeedback,
  onAiExplain,
  t,
}: {
  assignments: Assignment[];
  submissions: Record<string, Submission>;
  isStu: boolean;
  canC: boolean;
  onSubmit: (id: string) => void;
  onAiFeedback: (id: string) => void;
  onAiExplain: (a: Assignment) => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <motion.div variants={LIST_CONTAINER} initial="hidden" animate="visible">
      {assignments.map((a, idx) => {
        const prevA = idx > 0 ? assignments[idx - 1] : null;
        const prevStatus = prevA ? getAssignmentStatus(prevA, submissions[prevA.id]) : null;
        const prevDone = prevStatus === 'graded' || prevStatus === 'submitted';
        return (
          <TimelineNode
            key={a.id}
            assignment={a}
            submission={submissions[a.id]}
            isStu={isStu}
            canC={canC}
            onSubmit={onSubmit}
            onAiFeedback={onAiFeedback}
            onAiExplain={onAiExplain}
            t={t}
            isFirst={idx === 0}
            isLast={idx === assignments.length - 1}
            prevDone={prevDone}
          />
        );
      })}
    </motion.div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

// ─── Kanban view ───────────────────────────────────────────────────────────────

const KANBAN_COLUMNS: { key: AssignmentStatus; label: string; color: string; bg: string }[] = [
  {
    key: 'pending',
    label: 'To Do',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/[0.08]',
  },
  {
    key: 'late',
    label: 'Overdue',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-500/[0.08]',
  },
  {
    key: 'submitted',
    label: 'Submitted',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-500/[0.08]',
  },
  {
    key: 'graded',
    label: 'Graded',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/[0.08]',
  },
];

function KanbanView({
  assignments,
  submissions,
  onSubmit,
  onAiExplain,
  currentUserId,
  t,
}: {
  assignments: Assignment[];
  submissions: Record<string, Submission>;
  onSubmit: (id: string) => void;
  onAiExplain: (a: Assignment) => void;
  currentUserId: string;
  t: ReturnType<typeof useT>;
}) {
  const grouped: Record<AssignmentStatus, Assignment[]> = { pending: [], late: [], submitted: [], graded: [] };
  assignments.forEach((a) => {
    const s = getAssignmentStatus(a, submissions[a.id]);
    grouped[s].push(a);
  });

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 pt-1">
      {KANBAN_COLUMNS.map((col) => (
        <div key={col.key} className="flex flex-col gap-2">
          {/* Column header */}
          <div className={cn('flex items-center justify-between rounded-lg px-3 py-2', col.bg)}>
            <span className={cn('text-xs font-semibold', col.color)}>{col.label}</span>
            <span className={cn('text-xs font-bold tabular-nums', col.color)}>{grouped[col.key].length}</span>
          </div>
          {/* Cards */}
          <motion.div
            className="space-y-2"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="visible"
          >
            {grouped[col.key].length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/40 dark:border-white/[0.06] py-6 text-center">
                <p className="text-xs text-muted-foreground/50">Empty</p>
              </div>
            ) : (
              grouped[col.key].map((a) => {
                const submission = submissions[a.id];
                const urgency = getDueUrgency(a.dueAt);
                const daysLeft = Math.ceil((new Date(a.dueAt).getTime() - Date.now()) / 86_400_000);
                return (
                  <motion.div
                    key={a.id}
                    variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      'rounded-lg border p-3 cursor-default',
                      'bg-background dark:bg-card/80 shadow-card hover:shadow-lift',
                      'dark:border-white/[0.07] dark:hover:border-white/[0.12]',
                      'transition-shadow duration-150',
                    )}
                  >
                    <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{a.title}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={cn(
                          'text-[10px]',
                          col.key === 'late'
                            ? 'text-rose-500'
                            : urgency === 'today'
                              ? 'text-amber-500'
                              : 'text-muted-foreground/60',
                        )}
                      >
                        {col.key === 'late'
                          ? 'Overdue'
                          : col.key === 'submitted' || col.key === 'graded'
                            ? '✓'
                            : daysLeft > 0
                              ? `${daysLeft}d`
                              : 'Today'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">{a.maxScore}pts</span>
                      {col.key === 'graded' && submission?.grade && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 ml-auto">
                          {submission.grade.score}/{a.maxScore}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 mt-2.5">
                      {col.key !== 'graded' && (
                        <button
                          onClick={() => onSubmit(a.id)}
                          className="flex-1 text-[10px] rounded border border-border/50 py-1 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors text-center"
                        >
                          {col.key === 'submitted' ? 'Resubmit' : 'Submit'}
                        </button>
                      )}
                      <button
                        onClick={() => onAiExplain(a)}
                        className="text-[10px] rounded border border-blue-200/60 text-blue-600 dark:text-blue-400 dark:border-blue-500/25 py-1 px-2 hover:bg-blue-50 dark:hover:bg-blue-500/[0.08] transition-colors"
                      >
                        <Brain className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="h-14 w-14 rounded-2xl bg-muted dark:bg-white/[0.04] flex items-center justify-center mb-4">
        <ClipboardList className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-serif font-medium text-foreground mb-1">No assignments yet</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        {canCreate
          ? 'Create your first assignment to get started.'
          : "Your instructor hasn't posted any assignments yet."}
      </p>
      {canCreate && (
        <Button onClick={onCreate} size="sm" className="mt-5 gap-2">
          <Plus className="h-4 w-4" /> Create Assignment
        </Button>
      )}
    </motion.div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AssignmentsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useMe();
  const qc = useQueryClient();
  const t = useT();
  const { lang } = useLanguage();

  const [cO, sCO] = useState(false);
  const [sO, sSO] = useState<string | null>(null);
  const [nT, sNT] = useState('');
  const [nD, sND] = useState('');
  const [nDu, sNDu] = useState('');
  const [nM, sNM] = useState('100');
  const [sT, sST] = useState('');
  const [sU, sSU] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExplainOpen, setAiExplainOpen] = useState(false);
  const [aiExplainText, setAiExplainText] = useState('');
  const [aiExplainStreaming, setAiExplainStreaming] = useState(false);
  const [aiExplainAssignment, setAiExplainAssignment] = useState<Assignment | null>(null);
  const aiExplainAbort = useRef<AbortController | null>(null);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'cards' | 'timeline' | 'kanban'>('cards');
  const [subTab, setSubTab] = useState<'text' | 'file' | 'link' | 'code'>('text');
  const [subFiles, setSubFiles] = useState<File[]>([]);
  const [isDrag, setIsDrag] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resFiles, setResFiles] = useState<File[]>([]);
  const [resIsDrag, setResIsDrag] = useState(false);
  const pageSize = 8;

  const { data, isLoading } = useQuery<PaginatedResponse<Assignment>>({
    queryKey: ['c-asgn', id, page],
    queryFn: () => api.get(`/courses/${id}/assignments?page=${page}&limit=${pageSize}`),
  });
  const assignments = data?.items || [];

  const { data: mySubmissions } = useQuery<Submission[]>({
    queryKey: ['my-subs', id],
    queryFn: () => api.get(`/courses/${id}/my-submissions`),
    enabled: user?.role === 'STUDENT',
  });

  const submissionByAssignment = (mySubmissions || []).reduce<Record<string, Submission>>((acc, s) => {
    acc[s.assignmentId] = s;
    return acc;
  }, {});

  const cre = useMutation({
    mutationFn: async (d: any) => {
      const assignment = await api.post<Assignment>(`/courses/${id}/assignments`, d);
      if (resFiles.length) {
        const fd = new FormData();
        resFiles.forEach((f) => fd.append('files', f));
        await api.uploadWithProgress(`/assignments/${assignment.id}/resources`, fd, () => {});
      }
      return assignment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['c-asgn', id] });
      toast({ title: t.courseAssignments.created });
      sCO(false);
      sNT('');
      sND('');
      sNDu('');
      sNM('100');
      setResFiles([]);
    },
    onError: (e: any) => toast({ title: t.common.error, description: e.message, variant: 'destructive' }),
  });

  const sub = useMutation({
    mutationFn: ({ aid, d, files }: { aid: string; d: any; files?: File[] }) => {
      if (files?.length) {
        const fd = new FormData();
        files.forEach((f) => fd.append('files', f));
        if (d.contentText) fd.append('contentText', d.contentText);
        if (d.contentUrl) fd.append('contentUrl', d.contentUrl);
        return api.uploadWithProgress(`/assignments/${aid}/submit-files`, fd, setUploadProgress);
      }
      return api.post(`/assignments/${aid}/submit`, d);
    },
    onSuccess: () => {
      toast({ title: t.courseAssignments.submittedToast });
      sSO(null);
      sST('');
      sSU('');
      setSubTab('text');
      setSubFiles([]);
      setUploadProgress(0);
      qc.invalidateQueries({ queryKey: ['my-subs', id] });
    },
    onError: (e: any) => toast({ title: t.common.error, description: e.message, variant: 'destructive' }),
  });

  const draft = useMutation({
    mutationFn: ({ aid, d }: { aid: string; d: any }) => api.post(`/assignments/${aid}/save-draft`, d),
    onSuccess: () => {
      toast({ title: 'Draft saved' });
      qc.invalidateQueries({ queryKey: ['my-subs', id] });
    },
    onError: (e: any) => toast({ title: t.common.error, description: e.message, variant: 'destructive' }),
  });

  const handleAiFeedback = async (assignmentId: string) => {
    const submission = submissionByAssignment[assignmentId];
    if (!submission) {
      toast({
        title: t.courseAssignments.noSubmissionTitle,
        description: t.courseAssignments.noSubmissionDescription,
        variant: 'destructive',
      });
      return;
    }
    setAiFeedback(null);
    setAiOpen(true);
    setAiLoading(true);
    try {
      const result = await api.post<AiFeedback>('/ai/assignment-feedback', {
        assignmentId,
        submissionId: submission.id,
        lang,
      });
      setAiFeedback(result);
    } catch (e: any) {
      toast({ title: t.courseAssignments.aiUnavailable, description: e.message, variant: 'destructive' });
      setAiOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiExplain = useCallback(
    async (assignment: Assignment) => {
      aiExplainAbort.current?.abort();
      const ctrl = new AbortController();
      aiExplainAbort.current = ctrl;
      setAiExplainAssignment(assignment);
      setAiExplainText('');
      setAiExplainStreaming(true);
      setAiExplainOpen(true);
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: `Explain this assignment and suggest a clear approach to solve it:`,
            context: `Assignment: "${assignment.title}"\n\nDescription: ${assignment.description || '(no description)'}\n\nMax score: ${assignment.maxScore} points. Due: ${assignment.dueAt}`,
            lang,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error('AI unavailable');
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) setAiExplainText((t) => t + parsed.text);
            } catch {}
          }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          setAiExplainText('AI is currently unavailable. Please try again later.');
        }
      } finally {
        setAiExplainStreaming(false);
      }
    },
    [lang],
  );

  const canC = user?.role === 'ADMIN' || user?.role === 'TEACHER';
  const isStu = user?.role === 'STUDENT';

  const statusCounts = isStu
    ? assignments.reduce<Record<AssignmentStatus, number>>(
        (acc, a) => {
          const s = getAssignmentStatus(a, submissionByAssignment[a.id]);
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        },
        { pending: 0, submitted: 0, late: 0, graded: 0 },
      )
    : null;

  const sharedCardProps = {
    isStu,
    canC,
    onSubmit: sSO,
    onAiFeedback: handleAiFeedback,
    onAiExplain: handleAiExplain,
    currentUserId: user?.id ?? '',
    t,
  };

  return (
    <div className="space-y-5 mt-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--fg-subtle)] block">
            Assignments
          </span>
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--fg)] mt-0.5">
            {t.courseAssignments.title}
          </h2>
          {isStu && statusCounts && assignments.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {statusCounts.pending > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{statusCounts.pending} open</span>
              )}
              {statusCounts.pending > 0 &&
                (statusCounts.late > 0 || statusCounts.submitted > 0 || statusCounts.graded > 0) && (
                  <span className="mx-1.5 opacity-40">·</span>
                )}
              {statusCounts.submitted > 0 && (
                <span className="text-blue-600 dark:text-blue-400">{statusCounts.submitted} submitted</span>
              )}
              {statusCounts.submitted > 0 && (statusCounts.late > 0 || statusCounts.graded > 0) && (
                <span className="mx-1.5 opacity-40">·</span>
              )}
              {statusCounts.late > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-medium">{statusCounts.late} late</span>
              )}
              {statusCounts.late > 0 && statusCounts.graded > 0 && <span className="mx-1.5 opacity-40">·</span>}
              {statusCounts.graded > 0 && (
                <span className="text-amber-600 dark:text-amber-400">{statusCounts.graded} graded</span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle — DS Segment */}
          {assignments.length > 0 && (
            <Segment
              value={viewMode}
              onChange={(v) => setViewMode(v as 'cards' | 'timeline' | 'kanban')}
              size="sm"
              options={[
                { value: 'cards', label: 'Cards', icon: <List className="h-3 w-3" /> },
                { value: 'timeline', label: 'Timeline', icon: <GitBranch className="h-3 w-3" /> },
                { value: 'kanban', label: 'Board', icon: <LayoutGrid className="h-3 w-3" /> },
              ]}
            />
          )}

          {canC && (
            <Button variant="primary" onClick={() => sCO(true)} size="md">
              <Plus className="h-3.5 w-3.5" /> {t.courseAssignments.new}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-background dark:bg-card/80 overflow-hidden">
              <div className="h-[3px] bg-muted animate-shimmer" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : !assignments.length ? (
        <EmptyState canCreate={canC} onCreate={() => sCO(true)} />
      ) : viewMode === 'kanban' ? (
        <KanbanView
          assignments={assignments}
          submissions={submissionByAssignment}
          onSubmit={sSO}
          onAiExplain={handleAiExplain}
          currentUserId={user?.id ?? ''}
          t={t}
        />
      ) : viewMode === 'timeline' ? (
        <div className="pt-2">
          <TimelineView assignments={assignments} submissions={submissionByAssignment} {...sharedCardProps} />
        </div>
      ) : (
        <div className="space-y-4">
          <motion.div className="space-y-3" variants={LIST_CONTAINER} initial="hidden" animate="visible">
            {assignments.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                submission={submissionByAssignment[a.id]}
                {...sharedCardProps}
              />
            ))}
          </motion.div>
          <PaginationControls
            page={page}
            itemsCount={assignments.length}
            totalItems={data?.total}
            hasNext={data?.hasNext ?? false}
            isLoading={isLoading}
            onPrevious={() => setPage((c) => Math.max(1, c - 1))}
            onNext={() => setPage((c) => c + 1)}
          />
        </div>
      )}

      {/* Create Assignment Dialog */}
      <Dialog open={cO} onOpenChange={sCO}>
        <DialogHeader>
          <DialogTitle>{t.courseAssignments.newAssignment}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t.courseAssignments.titleLabel}</Label>
            <Input value={nT} onChange={(e) => sNT(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-assignment-desc">{t.courseAssignments.descriptionLabel}</Label>
            <MarkdownEditor id="new-assignment-desc" value={nD} onChange={sND} rows={5} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t.courseAssignments.dueDateLabel}</Label>
              <Input type="datetime-local" value={nDu} onChange={(e) => sNDu(e.target.value)} />
            </div>
            <div>
              <Label>{t.courseAssignments.maxScoreLabel}</Label>
              <Input type="number" value={nM} onChange={(e) => sNM(e.target.value)} />
            </div>
          </div>

          {/* Resource files */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Attach Resources <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setResIsDrag(true);
              }}
              onDragLeave={() => setResIsDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setResIsDrag(false);
                setResFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
              }}
              onClick={() => {
                const inp = document.createElement('input');
                inp.type = 'file';
                inp.multiple = true;
                inp.onchange = (ev) =>
                  setResFiles((prev) => [...prev, ...Array.from((ev.target as HTMLInputElement).files || [])]);
                inp.click();
              }}
              className={cn(
                'cursor-pointer rounded-lg border-2 border-dashed transition-all duration-150 text-center select-none',
                resFiles.length > 0 ? 'p-3' : 'p-5',
                resIsDrag
                  ? 'border-primary bg-primary/[0.06] dark:bg-primary/[0.1]'
                  : 'border-border/60 dark:border-white/[0.1] hover:border-primary/40 hover:bg-muted/30',
              )}
            >
              <Upload
                className={cn(
                  'mx-auto mb-1.5 transition-colors',
                  resFiles.length > 0 ? 'h-4 w-4' : 'h-6 w-6',
                  resIsDrag ? 'text-primary' : 'text-muted-foreground/50',
                )}
              />
              <p className="text-xs font-medium">
                {resIsDrag ? 'Drop files' : resFiles.length > 0 ? 'Add more' : 'Drag & drop or click'}
              </p>
              {resFiles.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-0.5">PDFs, slides, templates — up to 10</p>
              )}
            </div>
            {resFiles.length > 0 && (
              <div className="space-y-1">
                {resFiles.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded-md border border-border/50 dark:border-white/[0.07] bg-muted/20 px-2.5 py-1.5"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                    <span className="flex-1 min-w-0 text-xs truncate">{f.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {f.size >= 1048576 ? `${(f.size / 1048576).toFixed(1)}MB` : `${(f.size / 1024).toFixed(0)}KB`}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setResFiles((prev) => prev.filter((_, j) => j !== i));
                      }}
                      className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            className="w-full"
            onClick={() =>
              cre.mutate({ title: nT, description: nD, dueAt: new Date(nDu).toISOString(), maxScore: parseInt(nM) })
            }
            disabled={!nT || !nDu || cre.isPending}
          >
            {cre.isPending ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin mr-1.5" />
                Creating…
              </>
            ) : (
              t.courseAssignments.create
            )}
          </Button>
        </div>
      </Dialog>

      {/* Submit Dialog */}
      <Dialog
        open={!!sO}
        onOpenChange={() => {
          sSO(null);
          sST('');
          sSU('');
          setSubTab('text');
          setSubFiles([]);
          setUploadProgress(0);
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            {t.courseAssignments.submitAssignment}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* Tab switcher */}
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted/50 dark:bg-white/[0.04] p-1">
            {(
              [
                { k: 'text', label: 'Text', Icon: AlignLeft },
                { k: 'file', label: 'Files', Icon: Paperclip },
                { k: 'link', label: 'Link', Icon: ExternalLink },
                { k: 'code', label: 'Code', Icon: Code2 },
              ] as const
            ).map(({ k, label, Icon }) => (
              <button
                key={k}
                onClick={() => setSubTab(k)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all duration-150',
                  subTab === k
                    ? 'bg-background dark:bg-card/90 text-foreground shadow-sm dark:border dark:border-white/[0.07]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {k === 'file' && subFiles.length > 0 && (
                  <span className="rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-1 min-w-[14px] h-3.5 flex items-center justify-center">
                    {subFiles.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Text panel */}
          {subTab === 'text' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t.courseAssignments.yourAnswer}</Label>
              <MarkdownEditor
                value={sT}
                onChange={sST}
                rows={7}
                placeholder="Write your answer here — Markdown is supported (bold, lists, links, code blocks)."
              />
            </div>
          )}

          {/* Files panel — multi-file */}
          {subTab === 'file' && (
            <div className="space-y-3">
              <Label className="text-xs">Attach Files</Label>

              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDrag(true);
                }}
                onDragLeave={() => setIsDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDrag(false);
                  const dropped = Array.from(e.dataTransfer.files);
                  setSubFiles((prev) => [...prev, ...dropped]);
                }}
                onClick={() => {
                  const inp = document.createElement('input');
                  inp.type = 'file';
                  inp.multiple = true;
                  inp.accept =
                    '.pdf,.doc,.docx,.zip,.txt,.py,.js,.ts,.tsx,.jsx,.png,.jpg,.jpeg,.gif,.webp,.csv,.json,.md';
                  inp.onchange = (ev) => {
                    const picked = Array.from((ev.target as HTMLInputElement).files || []);
                    setSubFiles((prev) => [...prev, ...picked]);
                  };
                  inp.click();
                }}
                className={cn(
                  'cursor-pointer rounded-lg border-2 border-dashed transition-all duration-150 select-none text-center',
                  subFiles.length > 0 ? 'p-4' : 'p-8',
                  isDrag
                    ? 'border-primary bg-primary/[0.06] dark:bg-primary/[0.1]'
                    : 'border-border/60 dark:border-white/[0.1] hover:border-primary/40 dark:hover:border-primary/30 hover:bg-muted/30',
                )}
              >
                <motion.div animate={{ scale: isDrag ? 1.1 : 1 }} transition={{ duration: 0.15 }}>
                  <Upload
                    className={cn(
                      'mx-auto mb-2 transition-colors',
                      subFiles.length > 0 ? 'h-5 w-5' : 'h-8 w-8 mb-2.5',
                      isDrag ? 'text-primary' : 'text-muted-foreground/50',
                    )}
                  />
                </motion.div>
                <p className="text-sm font-medium">
                  {isDrag
                    ? 'Drop files here'
                    : subFiles.length > 0
                      ? 'Add more files'
                      : 'Drag & drop or click to browse'}
                </p>
                {subFiles.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, ZIP, images, code — up to 10 files</p>
                )}
              </div>

              {/* File list */}
              {subFiles.length > 0 && (
                <div className="space-y-1.5">
                  {subFiles.map((f, i) => {
                    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
                    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
                    const isArchive = ['zip', 'tar', 'gz', 'rar'].includes(ext);
                    const FileIco = isImage ? ImageIcon : isArchive ? Archive : ext === 'pdf' ? FileText : FileIcon;
                    const sizeStr =
                      f.size >= 1024 * 1024
                        ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${(f.size / 1024).toFixed(1)} KB`;
                    return (
                      <motion.div
                        key={`${f.name}-${i}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-center gap-2.5 rounded-lg border border-border/50 dark:border-white/[0.07] bg-muted/20 dark:bg-white/[0.02] px-3 py-2"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] dark:bg-primary/[0.12]">
                          <FileIco className="h-4 w-4 text-primary/70" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate text-foreground">{f.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {sizeStr} · {ext.toUpperCase()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubFiles((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Upload progress */}
              {uploadProgress > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      {uploadProgress < 100 || sub.isPending ? (
                        <>
                          <div className="h-2.5 w-2.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">Upload complete</span>
                        </>
                      )}
                    </span>
                    <span className="font-medium tabular-nums">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={cn(
                        'h-full rounded-full',
                        uploadProgress === 100 && !sub.isPending ? 'bg-emerald-500' : 'bg-primary',
                      )}
                      initial={{ width: '0%' }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ ease: 'linear', duration: 0.1 }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Link panel */}
          {subTab === 'link' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t.courseAssignments.urlOptional}</Label>
                <div className="relative">
                  <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={sU}
                    onChange={(e) => sSU(e.target.value)}
                    placeholder="https://…"
                    className="pl-9 text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">GitHub repo, Google Doc, Figma, or any hosted resource</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea
                  value={sT}
                  onChange={(e) => sST(e.target.value)}
                  rows={3}
                  placeholder="Describe your work or add context…"
                  className="resize-none text-sm"
                />
              </div>
            </div>
          )}

          {/* Code panel */}
          {subTab === 'code' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Code Snippet</Label>
                <span className="font-mono text-[10px] text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded">
                  plain text
                </span>
              </div>
              <Textarea
                value={sT}
                onChange={(e) => sST(e.target.value)}
                rows={10}
                placeholder="// Paste or type your code here…"
                className="font-mono text-xs resize-none bg-muted/20 dark:bg-black/20 dark:border-white/[0.06] leading-relaxed"
              />
              <p className="text-right text-[11px] text-muted-foreground">{sT.length} chars</p>
            </div>
          )}

          {/* Action row: Draft + Submit */}
          <div className="flex gap-2 pt-1">
            {subTab !== 'file' && (
              <Button
                variant="outline"
                className="gap-1.5 h-9 text-xs"
                onClick={() =>
                  draft.mutate({ aid: sO!, d: { contentText: sT || undefined, contentUrl: sU || undefined } })
                }
                disabled={draft.isPending || (!sT && !sU)}
                title="Save without submitting"
              >
                {draft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Draft
              </Button>
            )}
            <Button
              className="flex-1 gap-2 h-9"
              onClick={() => {
                if (subTab === 'file') {
                  sub.mutate({ aid: sO!, d: {}, files: subFiles });
                } else {
                  sub.mutate({ aid: sO!, d: { contentText: sT || undefined, contentUrl: sU || undefined } });
                }
              }}
              disabled={
                sub.isPending ||
                (subTab === 'text' && !sT) ||
                (subTab === 'file' && subFiles.length === 0) ||
                (subTab === 'link' && !sU) ||
                (subTab === 'code' && !sT)
              }
            >
              {sub.isPending ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />{' '}
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" /> {t.courseAssignments.submit}
                </>
              )}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* AI Feedback Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <div className="relative overflow-hidden">
          {/* glow orb */}
          <span
            aria-hidden
            className="absolute -top-16 -right-16 w-[200px] h-[200px] rounded-full pointer-events-none opacity-50"
            style={{
              background: 'radial-gradient(circle, var(--accent-200), transparent 65%)',
            }}
          />
          <div className="relative p-6 max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-[8px] flex items-center justify-center text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))' }}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--accent-700)] block">
                  AI Review
                </span>
                <DialogTitle className="text-[15px]">{t.courseAssignments.aiFeedbackTitle}</DialogTitle>
              </div>
            </div>

            {aiLoading ? (
              <div className="space-y-3 py-3">
                <div className="inline-flex items-center gap-2 text-[var(--fg-muted)] text-[12.5px]">
                  <span className="inline-flex gap-[3px]">
                    <span className="w-[5px] h-[5px] rounded-full bg-[var(--accent-500)] animate-[ai-pulse_1.2s_0s_infinite_ease-in-out]" />
                    <span className="w-[5px] h-[5px] rounded-full bg-[var(--accent-500)] animate-[ai-pulse_1.2s_0.15s_infinite_ease-in-out]" />
                    <span className="w-[5px] h-[5px] rounded-full bg-[var(--accent-500)] animate-[ai-pulse_1.2s_0.3s_infinite_ease-in-out]" />
                  </span>
                  <span className="font-mono">{t.courseAssignments.aiFeedbackLoading}</span>
                </div>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-3 w-full" />
                ))}
              </div>
            ) : (
              aiFeedback && (
                <div className="space-y-4">
                  <div className="rounded-[8px] bg-[var(--bg-subtle)] p-3 text-[13px] leading-[1.55] border border-[var(--border-color)] text-[var(--fg)]">
                    {aiFeedback.assessment}
                  </div>
                  {aiFeedback.strengths.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.10em] flex items-center gap-1.5 text-[var(--success)]">
                        <CheckCircle2 className="h-3 w-3" /> {t.courseAssignments.strengths}
                      </p>
                      <ul className="space-y-1">
                        {aiFeedback.strengths.map((s, i) => (
                          <li key={i} className="text-[13px] flex items-start gap-2 text-[var(--fg)] leading-[1.55]">
                            <span className="text-[var(--success)] mt-0.5">•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiFeedback.improvements.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.10em] flex items-center gap-1.5 text-[var(--warning)]">
                        <AlertCircle className="h-3 w-3" /> {t.courseAssignments.improvements}
                      </p>
                      <ul className="space-y-1">
                        {aiFeedback.improvements.map((s, i) => (
                          <li key={i} className="text-[13px] flex items-start gap-2 text-[var(--fg)] leading-[1.55]">
                            <span className="text-[var(--warning)] mt-0.5">•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiFeedback.suggestions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.10em] flex items-center gap-1.5 text-[var(--info)]">
                        <Lightbulb className="h-3 w-3" /> {t.courseAssignments.suggestions}
                      </p>
                      <ul className="space-y-1">
                        {aiFeedback.suggestions.map((s, i) => (
                          <li key={i} className="text-[13px] flex items-start gap-2 text-[var(--fg)] leading-[1.55]">
                            <span className="text-[var(--info)] mt-0.5">•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-[11px] text-[var(--fg-subtle)] font-mono flex items-center gap-1 pt-2 border-t border-[var(--border-color)]">
                    <TrendingUp className="h-3 w-3" />
                    {t.courseAssignments.aiDisclaimer}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </Dialog>

      {/* AI Explain Dialog */}
      <Dialog
        open={aiExplainOpen}
        onOpenChange={(v) => {
          if (!v) {
            aiExplainAbort.current?.abort();
          }
          setAiExplainOpen(v);
        }}
      >
        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-[8px] flex items-center justify-center text-white shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--info), color-mix(in oklch, var(--info), black 20%))',
              }}
            >
              <Brain className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--info)] block">
                AI Explain
              </span>
              <DialogTitle className="text-[15px] truncate">
                {aiExplainAssignment?.title ?? 'Assignment Explanation'}
              </DialogTitle>
            </div>
          </div>

          {aiExplainStreaming && aiExplainText === '' ? (
            <div className="flex items-center gap-2 py-6 text-[var(--fg-muted)] text-[12.5px]">
              <span className="inline-flex gap-[3px]">
                <span className="w-[5px] h-[5px] rounded-full bg-[var(--info)] animate-[ai-pulse_1.2s_0s_infinite_ease-in-out]" />
                <span className="w-[5px] h-[5px] rounded-full bg-[var(--info)] animate-[ai-pulse_1.2s_0.15s_infinite_ease-in-out]" />
                <span className="w-[5px] h-[5px] rounded-full bg-[var(--info)] animate-[ai-pulse_1.2s_0.3s_infinite_ease-in-out]" />
              </span>
              <span className="font-mono">Analyzing assignment…</span>
            </div>
          ) : (
            <div className="space-y-3">
              {aiExplainText ? (
                <div className="text-[13.5px] text-[var(--fg)] leading-[1.6] whitespace-pre-wrap">
                  {aiExplainText}
                  {aiExplainStreaming && <span className="ai-caret" />}
                </div>
              ) : null}
            </div>
          )}

          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
            <TrendingUp className="h-3 w-3" />
            AI-generated explanation. Use as a guide, not a final answer.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
