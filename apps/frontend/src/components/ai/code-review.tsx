'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Bug, AlertTriangle, Info, Zap, ShieldAlert, Wrench, Loader2, X, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface CodeReviewIssue {
  line: number | null;
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: 'bug' | 'style' | 'performance' | 'security' | 'design';
  message: string;
  suggestion?: string;
}

export interface CodeReviewResult {
  _demo?: boolean;
  _empty?: boolean;
  _parseFailed?: boolean;
  summary: string;
  language: string;
  issues: CodeReviewIssue[];
  positiveAspects?: string[];
  truncated?: boolean;
  rawText?: string;
}

interface CodeReviewProps {
  submissionId: string;
  language?: string;
  code?: string;
}

const severityTone: Record<CodeReviewIssue['severity'], string> = {
  critical:
    'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-500/[0.14] dark:text-rose-200 dark:border-rose-500/40',
  major:
    'bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-500/[0.14] dark:text-orange-200 dark:border-orange-500/40',
  minor:
    'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/[0.14] dark:text-amber-200 dark:border-amber-500/40',
  info: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-500/[0.14] dark:text-blue-200 dark:border-blue-500/40',
};

const categoryIcon = {
  bug: Bug,
  style: Wrench,
  performance: Zap,
  security: ShieldAlert,
  design: Sparkles,
};

export function CodeReviewPanel({ submissionId, language, code }: CodeReviewProps) {
  const [result, setResult] = useState<CodeReviewResult | null>(null);
  const [open, setOpen] = useState(false);

  const codeLines = (code ?? '').split('\n');

  const review = useMutation<CodeReviewResult, Error>({
    mutationFn: () => api.post<CodeReviewResult>('/ai/code-review', { submissionId, language }),
    onSuccess: (data) => {
      setResult(data);
      setOpen(true);
    },
    onError: (e) => toast({ title: 'AI Code Review failed', description: e.message, variant: 'destructive' }),
  });

  // Index issues by line for inline highlights
  const issuesByLine = new Map<number, CodeReviewIssue[]>();
  if (result?.issues) {
    for (const issue of result.issues) {
      if (issue.line == null) continue;
      const arr = issuesByLine.get(issue.line) ?? [];
      arr.push(issue);
      issuesByLine.set(issue.line, arr);
    }
  }
  const generalIssues = result?.issues.filter((i) => i.line == null) ?? [];

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => review.mutate()}
        disabled={review.isPending}
        title="Ask Claude to review this code for bugs, style, and optimization opportunities"
      >
        {review.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        AI Code Review
      </Button>

      {open && result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-border/60"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))',
                  }}
                >
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-semibold">AI Code Review</h3>
                  <p className="text-xs text-muted-foreground">
                    Language: {result.language}
                    {result._demo && ' · demo mode'}
                    {result.truncated && ' · code truncated to 12 KB'}
                    {' · '}
                    {result.issues.length} issue{result.issues.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              {/* Summary */}
              <div className="rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">{result.summary}</div>

              {/* Positive aspects */}
              {result.positiveAspects && result.positiveAspects.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    What you did well
                  </h4>
                  <ul className="space-y-1.5">
                    {result.positiveAspects.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* General issues (no specific line) */}
              {generalIssues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    General observations
                  </h4>
                  <div className="space-y-2">
                    {generalIssues.map((issue, i) => (
                      <IssueCard key={i} issue={issue} />
                    ))}
                  </div>
                </div>
              )}

              {/* Code with inline issue annotations */}
              {code && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Code with annotations
                  </h4>
                  <div className="rounded-lg border border-border/60 overflow-hidden text-sm font-mono">
                    {codeLines.map((line, idx) => {
                      const lineNumber = idx + 1;
                      const issues = issuesByLine.get(lineNumber) ?? [];
                      const hasIssue = issues.length > 0;
                      const worstSeverity = issues.reduce<CodeReviewIssue['severity'] | null>((worst, i) => {
                        const order = { critical: 4, major: 3, minor: 2, info: 1 } as const;
                        if (!worst) return i.severity;
                        return order[i.severity] > order[worst] ? i.severity : worst;
                      }, null);
                      return (
                        <div key={idx}>
                          <div
                            className={cn(
                              'flex gap-3 px-3 py-0.5',
                              hasIssue && severityTone[worstSeverity!],
                              !hasIssue && 'hover:bg-muted/30',
                            )}
                          >
                            <span className="text-muted-foreground w-8 shrink-0 text-right select-none">
                              {lineNumber}
                            </span>
                            <span className="whitespace-pre-wrap break-all">{line || ' '}</span>
                          </div>
                          {issues.map((issue, i) => (
                            <IssueCard key={i} issue={issue} inlineWithCode />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {result._parseFailed && result.rawText && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs">
                  <p className="font-semibold mb-1 text-amber-800 dark:text-amber-200">
                    Raw AI response (could not be parsed)
                  </p>
                  <pre className="whitespace-pre-wrap font-mono text-[11px] text-amber-900 dark:text-amber-100">
                    {result.rawText}
                  </pre>
                </div>
              )}

              {result._empty && (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No code text was submitted. AI Code Review currently only analyses inline code text, not file
                  attachments.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IssueCard({ issue, inlineWithCode }: { issue: CodeReviewIssue; inlineWithCode?: boolean }) {
  const Icon = categoryIcon[issue.category] ?? AlertTriangle;
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 px-3 py-2 text-xs border-l-2',
        severityTone[issue.severity],
        inlineWithCode && 'mx-0 -mt-px',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1 font-sans">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            tone={
              issue.severity === 'critical' || issue.severity === 'major'
                ? 'danger'
                : issue.severity === 'minor'
                  ? 'warning'
                  : 'accent'
            }
            variant="soft"
          >
            {issue.severity}
          </Badge>
          <span className="text-[11px] uppercase tracking-wide opacity-70">{issue.category}</span>
          {issue.line != null && <span className="text-[11px] opacity-70">line {issue.line}</span>}
        </div>
        <p className="font-medium">{issue.message}</p>
        {issue.suggestion && (
          <p className="opacity-80">
            <Info className="h-3 w-3 inline mr-1" />
            {issue.suggestion}
          </p>
        )}
      </div>
    </div>
  );
}
