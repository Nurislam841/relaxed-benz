'use client';
import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Submission, SubmissionAttachment, Grade } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea, Label, Skeleton } from '@/components/ui/form-elements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Award,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Archive,
  ExternalLink,
  Code2,
  AlignLeft,
  Paperclip,
  Download,
  Eye,
  EyeOff,
  Send,
  Globe,
  MessageSquare,
  ChevronDown,
  Users,
  BarChart2,
  Loader2,
  CalendarClock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMe } from '@/hooks/use-auth';
import dynamic from 'next/dynamic';

// CodeReviewPanel renders a full-screen dialog with annotated source code,
// only opened when the teacher clicks "AI Code Review". Markdown view is for
// non-code text answers — both can be deferred until they're actually needed.
const CodeReviewPanel = dynamic(
  () => import('@/components/ai/code-review').then((m) => ({ default: m.CodeReviewPanel })),
  { ssr: false },
);
const MarkdownView = dynamic(
  () => import('@/components/markdown/markdown-view').then((m) => ({ default: m.MarkdownView })),
  { ssr: false },
);

// ─── Types ───────────────────────────────────────────────────────────────────

type SubmissionDetail = Submission & {
  student: { id: string; fullName: string; email: string };
  grade: (Grade & { gradedBy: { id: string; fullName: string } | null }) | null;
  attachments: SubmissionAttachment[];
  assignment: {
    id: string;
    title: string;
    maxScore: number;
    dueAt: string;
    courseId: string;
    course: { id: string; title: string; code: string };
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getFileTypeLabel(mime: string): string {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('word')) return 'DOCX';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'XLSX';
  if (mime.includes('powerpoint') || mime.includes('presentation')) return 'PPTX';
  if (mime.startsWith('image/')) return mime.split('/')[1].toUpperCase();
  if (mime.includes('zip')) return 'ZIP';
  if (mime === 'text/plain') return 'TXT';
  if (mime === 'text/csv') return 'CSV';
  if (mime === 'text/markdown') return 'MD';
  return (mime.split('/')[1] ?? 'FILE').toUpperCase();
}

function getFileIcon(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime.includes('zip')) return Archive;
  if (mime === 'application/pdf') return FileText;
  return FileIcon;
}

function looksLikeCode(text: string): boolean {
  const patterns = [
    /^\s*(import|export|function|class|const|let|var|def |public |private |return |if |for |while |#include|package |using )/m,
    /[{};]\s*$/m,
    /^\s{4,}\S/m,
    /\/\//,
    /=>/,
  ];
  return patterns.filter((p) => p.test(text)).length >= 2;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function fmtDt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── AttachmentItem ───────────────────────────────────────────────────────────

function AttachmentItem({ att }: { att: SubmissionAttachment }) {
  const [open, setOpen] = useState(false);
  const FileIco = getFileIcon(att.mimeType);
  const isImage = att.mimeType.startsWith('image/');
  const isPdf = att.mimeType === 'application/pdf';
  const canPreview = isImage || isPdf;

  return (
    <div className="rounded-lg border border-border/50 dark:border-white/[0.07] overflow-hidden bg-background dark:bg-card/70">
      <div className="flex items-center gap-3 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] dark:bg-primary/[0.1]">
          <FileIco className="h-5 w-5 text-primary/70" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{att.fileName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getFileTypeLabel(att.mimeType)} · {fmtSize(att.fileSize)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canPreview && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setOpen((v) => !v)}>
              {open ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {open ? 'Hide' : 'Preview'}
            </Button>
          )}
          <a href={att.fileUrl} download={att.fileName} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
              <Download className="h-3 w-3" /> Download
            </Button>
          </a>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 dark:border-white/[0.05]">
              {isImage ? (
                <div className="p-3 flex justify-center bg-muted/20 dark:bg-black/10">
                  <img
                    src={att.fileUrl}
                    alt={att.fileName}
                    className="max-h-[480px] w-auto rounded-md object-contain"
                  />
                </div>
              ) : isPdf ? (
                <iframe
                  src={att.fileUrl}
                  className="w-full border-0"
                  style={{ height: '600px' }}
                  title={att.fileName}
                />
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── GradePanel ───────────────────────────────────────────────────────────────

function GradePanel({ sub }: { sub: SubmissionDetail }) {
  const qc = useQueryClient();
  const [score, setScore] = useState(sub.grade?.score?.toString() ?? '');
  const [feedback, setFeedback] = useState(sub.grade?.feedback ?? '');

  const maxScore = sub.assignment.maxScore;
  const numScore = parseFloat(score);
  const isValid = !isNaN(numScore) && numScore >= 0 && numScore <= maxScore;
  const pct = isValid ? Math.round((numScore / maxScore) * 100) : null;
  const pctColor =
    pct == null
      ? ''
      : pct >= 80
        ? 'text-emerald-600 dark:text-emerald-400'
        : pct >= 60
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-rose-600 dark:text-rose-400';
  const borderColor =
    !isValid || pct == null
      ? ''
      : pct >= 80
        ? 'border-emerald-300 dark:border-emerald-500/40 focus:ring-emerald-500/20'
        : pct >= 60
          ? 'border-amber-300 dark:border-amber-500/40 focus:ring-amber-500/20'
          : 'border-rose-300 dark:border-rose-500/40 focus:ring-rose-500/20';

  const gradeMut = useMutation({
    mutationFn: (d: { score: number; feedback?: string }) => api.post(`/submissions/${sub.id}/grade`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sub-review', sub.id] });
      toast({ title: sub.grade ? 'Grade updated' : 'Grade published' });
    },
    onError: (e: any) => toast({ title: 'Failed to save grade', description: e.message, variant: 'destructive' }),
  });

  const circR = 26;
  const circC = 2 * Math.PI * circR;
  const circPct = pct ?? 0;

  return (
    <div className="space-y-5">
      {/* Visual score ring + input */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width="68" height="68" className="-rotate-90">
            <circle cx="34" cy="34" r={circR} strokeWidth="5" fill="none" className="stroke-muted" />
            <circle
              cx="34"
              cy="34"
              r={circR}
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circC}
              strokeDashoffset={circC - (circC * Math.min(circPct, 100)) / 100}
              className={cn(
                'transition-all duration-500',
                pct == null
                  ? 'stroke-border'
                  : pct >= 80
                    ? 'stroke-emerald-500'
                    : pct >= 60
                      ? 'stroke-amber-500'
                      : 'stroke-rose-500',
              )}
            />
          </svg>
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center text-xs font-bold',
              pctColor || 'text-muted-foreground',
            )}
          >
            {pct != null ? `${pct}%` : '—'}
          </span>
        </div>

        <div className="flex-1">
          <Label className="text-xs mb-1.5 block">Score</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={maxScore}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className={cn('flex-1 text-xl font-bold h-11 text-center tabular-nums', borderColor)}
              placeholder="0"
            />
            <div className="text-center shrink-0">
              <p className="text-lg font-semibold text-muted-foreground leading-tight">/{maxScore}</p>
              <p className="text-[10px] text-muted-foreground">pts</p>
            </div>
          </div>
          {score !== '' && !isValid && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">Must be 0–{maxScore}</p>
          )}
        </div>
      </div>

      {/* Feedback */}
      <div className="space-y-1.5">
        <Label className="text-xs">
          Feedback <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={5}
          placeholder="Provide constructive feedback to help the student improve…"
          className="resize-none text-sm"
        />
        <p className="text-right text-[11px] text-muted-foreground">{feedback.length} chars</p>
      </div>

      {/* Publish */}
      <Button
        className="w-full gap-2 h-10"
        disabled={!isValid || gradeMut.isPending}
        onClick={() => gradeMut.mutate({ score: numScore, feedback: feedback || undefined })}
      >
        {gradeMut.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
          </>
        ) : sub.grade ? (
          <>
            <Award className="h-4 w-4" /> Update Grade
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> Publish Grade
          </>
        )}
      </Button>

      {/* Existing grade display */}
      {sub.grade && (
        <div className="rounded-lg bg-muted/40 dark:bg-white/[0.03] border border-border/40 dark:border-white/[0.05] p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Current grade</p>
          <div className="flex items-center justify-between">
            <span className={cn('text-2xl font-bold', pctColor)}>{sub.grade.score}</span>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{sub.grade.gradedBy?.fullName ?? 'Teacher'}</p>
              <p className="text-[11px] text-muted-foreground/60">{fmtDt(sub.grade.gradedAt)}</p>
            </div>
          </div>
          {sub.grade.feedback && (
            <p className="text-xs text-foreground/70 leading-relaxed pt-1 border-t border-border/30 dark:border-white/[0.04]">
              {sub.grade.feedback}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubmissionReviewPage() {
  const {
    id: courseId,
    assignmentId,
    submissionId,
  } = useParams<{
    id: string;
    assignmentId: string;
    submissionId: string;
  }>();
  const router = useRouter();
  const { data: me } = useMe();

  const [contentTab, setContentTab] = useState<'text' | 'files' | 'link'>('text');

  const { data: sub, isLoading } = useQuery<SubmissionDetail>({
    queryKey: ['sub-review', submissionId],
    queryFn: () => api.get(`/submissions/${submissionId}`),
  });

  const isStaff = me?.role === 'TEACHER' || me?.role === 'ADMIN';

  const { data: plagiarism } = useQuery<
    Array<{
      id: string;
      similarity: number;
      matchedNgrams: number;
      createdAt: string;
      otherSubmission: { id: string; studentId: string; student: { fullName: string } };
    }>
  >({
    queryKey: ['plagiarism', submissionId],
    queryFn: () => api.get(`/submissions/${submissionId}/plagiarism`),
    enabled: isStaff && !!submissionId,
  });

  const topMatch = plagiarism && plagiarism.length > 0 ? plagiarism[0] : null;
  const topMatchPct = topMatch ? Math.round(topMatch.similarity * 100) : 0;
  const matchTone = topMatchPct >= 70 ? 'high' : topMatchPct >= 40 ? 'medium' : 'low';

  const hasText = !!sub?.contentText;
  const hasFiles = (sub?.attachments?.length ?? 0) > 0;
  const hasLink = !!sub?.contentUrl;
  const isCode = hasText && looksLikeCode(sub!.contentText!);
  const isLate = !!(sub?.submittedAt && new Date(sub.submittedAt) > new Date(sub.assignment.dueAt));

  const tabs = useMemo(() => {
    if (!sub) return [];
    const t: Array<{ key: 'text' | 'files' | 'link'; label: string; icon: React.ElementType; count?: number }> = [];
    if (hasText) t.push({ key: 'text', label: isCode ? 'Code' : 'Text', icon: isCode ? Code2 : AlignLeft });
    if (hasFiles) t.push({ key: 'files', label: 'Files', icon: Paperclip, count: sub.attachments.length });
    if (hasLink) t.push({ key: 'link', label: 'Link', icon: ExternalLink });
    return t;
  }, [sub, hasText, hasFiles, hasLink, isCode]);

  const activeTab = tabs.find((t) => t.key === contentTab) ? contentTab : (tabs[0]?.key ?? 'text');

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-5 mt-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid lg:grid-cols-[2fr_1fr] gap-5">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Submission not found.</p>
      </div>
    );
  }

  const hasAnyContent = hasText || hasFiles || hasLink || sub.fileUrl;

  return (
    <div className="space-y-5 mt-1">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm flex-wrap">
        <button
          onClick={() => router.push(`/courses/${courseId}/assignments`)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Assignments
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-muted-foreground truncate max-w-[160px]">{sub.assignment.title}</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground font-medium truncate max-w-[140px]">{sub.student.fullName}</span>
      </div>

      {/* Header card */}
      <div className="rounded-xl border border-border/60 dark:border-white/[0.07] bg-card dark:bg-card/80 dark:backdrop-blur-sm p-5 shadow-card">
        {/* Top row: assignment meta + status badges */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium mb-1">
              {sub.assignment.course.code} · {sub.assignment.course.title}
            </p>
            <h1 className="font-serif text-xl font-semibold leading-tight">{sub.assignment.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Award className="h-3.5 w-3.5" />
                {sub.assignment.maxScore} pts max
              </span>
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                Due{' '}
                {new Date(sub.assignment.dueAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {topMatch && (
              <span
                title={`${topMatchPct}% similar to ${topMatch.otherSubmission.student.fullName}'s submission (${topMatch.matchedNgrams} matching n-grams). Click "View comparison" to investigate.`}
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border',
                  matchTone === 'high'
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/[0.12] dark:text-rose-300 dark:border-rose-500/30'
                    : matchTone === 'medium'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/[0.12] dark:text-amber-300 dark:border-amber-500/30'
                      : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/[0.12] dark:text-yellow-200 dark:border-yellow-500/30',
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                {topMatchPct}% similar to {topMatch.otherSubmission.student.fullName.split(' ')[0]}
              </span>
            )}
            {isLate && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/[0.12] dark:text-rose-300 dark:border-rose-500/30">
                <AlertTriangle className="h-3 w-3" /> Late
              </span>
            )}
            {sub.grade ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/[0.12] dark:text-amber-300 dark:border-amber-500/30">
                <Award className="h-3 w-3" />
                Graded · {sub.grade.score}/{sub.assignment.maxScore}
              </span>
            ) : sub.status === 'SUBMITTED' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/[0.12] dark:text-blue-300 dark:border-blue-500/30">
                <CheckCircle2 className="h-3 w-3" /> Submitted
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border text-muted-foreground bg-muted/50 border-border">
                Draft
              </span>
            )}
          </div>
        </div>

        {/* Student row */}
        <div className="mt-4 pt-4 border-t border-border/40 dark:border-white/[0.05] flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 dark:bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
              {sub.student.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold">{sub.student.fullName}</p>
              <p className="text-xs text-muted-foreground">{sub.student.email}</p>
            </div>
          </div>
          {sub.submittedAt ? (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Submitted</p>
              <p className="text-xs text-foreground mt-0.5">{fmtDt(sub.submittedAt)}</p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Not submitted</p>
            </div>
          )}
        </div>
      </div>

      {/* Main 2-col grid */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-5 items-start">
        {/* ── LEFT: Submission content ── */}
        <div className="space-y-4 min-w-0">
          {!hasAnyContent ? (
            <div className="rounded-xl border border-border/60 dark:border-white/[0.07] bg-card p-10 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted dark:bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                <AlignLeft className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No content submitted</p>
              <p className="text-xs text-muted-foreground">
                The student submitted without attaching any text, files, or links.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 dark:border-white/[0.07] bg-card dark:bg-card/80 dark:backdrop-blur-sm shadow-card overflow-hidden">
              {/* Tab bar */}
              {tabs.length > 0 && (
                <div className="flex border-b border-border/40 dark:border-white/[0.05] bg-muted/30 dark:bg-white/[0.02]">
                  {tabs.map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setContentTab(tab.key)}
                        className={cn(
                          'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all duration-150 border-b-2 -mb-px',
                          activeTab === tab.key
                            ? 'text-foreground border-primary'
                            : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40',
                        )}
                      >
                        <TabIcon className="h-3.5 w-3.5" />
                        {tab.label}
                        {tab.count != null && (
                          <span className="rounded-full bg-primary/10 text-primary text-[10px] px-1.5 min-w-[18px] h-[18px] flex items-center justify-center font-semibold">
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="p-5">
                {/* TEXT / CODE tab */}
                {activeTab === 'text' &&
                  hasText &&
                  (isCode ? (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Code2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Code Submission</span>
                        <span className="font-mono text-[10px] text-muted-foreground/60 bg-muted/40 dark:bg-white/[0.04] px-2 py-0.5 rounded">
                          {sub.contentText!.length} chars
                        </span>
                        <div className="ml-auto">
                          <CodeReviewPanel submissionId={sub.id} code={sub.contentText!} />
                        </div>
                      </div>
                      <div className="relative rounded-lg bg-zinc-950 dark:bg-black/50 border border-zinc-800/60 dark:border-white/[0.06] overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
                        {/* Line numbers + code */}
                        <div className="flex overflow-auto max-h-[540px]">
                          <div className="select-none shrink-0 px-3 py-4 text-right border-r border-zinc-800/50 dark:border-white/[0.05]">
                            {sub.contentText!.split('\n').map((_, i) => (
                              <div key={i} className="text-[11px] font-mono text-zinc-600 leading-[1.6rem]">
                                {i + 1}
                              </div>
                            ))}
                          </div>
                          <pre className="flex-1 p-4 text-sm font-mono text-zinc-100 dark:text-zinc-200 leading-[1.6rem] overflow-x-auto whitespace-pre">
                            <code>{sub.contentText}</code>
                          </pre>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <AlignLeft className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Text Answer</span>
                        <span className="ml-auto text-[10px] text-muted-foreground/60">
                          {sub.contentText!.split(/\s+/).filter(Boolean).length} words
                        </span>
                      </div>
                      <div className="rounded-lg bg-muted/20 dark:bg-white/[0.02] border border-border/30 dark:border-white/[0.04] p-4">
                        <MarkdownView source={sub.contentText!} />
                      </div>
                    </div>
                  ))}

                {/* FILES tab */}
                {activeTab === 'files' && hasFiles && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {sub.attachments.length} file{sub.attachments.length !== 1 ? 's' : ''} attached
                      </span>
                    </div>
                    {sub.attachments.map((a) => (
                      <AttachmentItem key={a.id} att={a} />
                    ))}
                  </div>
                )}

                {/* LINK tab */}
                {activeTab === 'link' && hasLink && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Submitted Link</span>
                    </div>

                    <div className="rounded-xl border border-border/50 dark:border-white/[0.07] overflow-hidden">
                      <div className="flex items-center gap-3 p-4 bg-muted/30 dark:bg-white/[0.02]">
                        <div className="h-10 w-10 rounded-md bg-primary/[0.08] dark:bg-primary/[0.1] flex items-center justify-center shrink-0">
                          <Globe className="h-5 w-5 text-primary/70" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-muted-foreground mb-0.5">{getDomain(sub.contentUrl!)}</p>
                          <a
                            href={sub.contentUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary hover:underline break-all"
                          >
                            {sub.contentUrl}
                          </a>
                        </div>
                        <a href={sub.contentUrl!} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                            <ExternalLink className="h-3.5 w-3.5" /> Open
                          </Button>
                        </a>
                      </div>
                    </div>

                    {hasText && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Notes from student</p>
                        <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap p-4 rounded-lg bg-muted/20 dark:bg-white/[0.02] border border-border/40 dark:border-white/[0.04]">
                          {sub.contentText}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legacy single fileUrl (not in attachments system) */}
          {sub.fileUrl && !hasFiles && (
            <div className="rounded-xl border border-border/60 dark:border-white/[0.07] bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/[0.08] flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-primary/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Uploaded file</p>
                  <p className="text-xs text-muted-foreground truncate">{sub.fileUrl}</p>
                </div>
                <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Grade panel ── */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <div className="rounded-xl border border-border/60 dark:border-white/[0.07] bg-card dark:bg-card/80 dark:backdrop-blur-sm shadow-card p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              Grade Submission
            </h2>
            <GradePanel sub={sub} />
          </div>

          {/* Quick stats */}
          <div className="rounded-xl border border-border/60 dark:border-white/[0.07] bg-card dark:bg-card/80 p-4 space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Submission Info</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">
                  {sub.grade ? 'Graded' : sub.status === 'SUBMITTED' ? 'Submitted' : 'Draft'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Content types</span>
                <span className="font-medium flex items-center gap-1">
                  {hasText && <span title={isCode ? 'Code' : 'Text'}>{isCode ? '⌨' : '📝'}</span>}
                  {hasFiles && <span title="Files">📎</span>}
                  {hasLink && <span title="Link">🔗</span>}
                  {!hasText && !hasFiles && !hasLink && '—'}
                </span>
              </div>
              {hasFiles && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Files</span>
                  <span className="font-medium">{sub.attachments.length}</span>
                </div>
              )}
              {hasText && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{isCode ? 'Code length' : 'Word count'}</span>
                  <span className="font-medium">
                    {isCode
                      ? `${sub.contentText!.length} chars`
                      : `${sub.contentText!.split(/\s+/).filter(Boolean).length} words`}
                  </span>
                </div>
              )}
              {isLate && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>Submitted</span>
                  <span className="font-medium">Late</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
