'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import type { ActivityLog } from '@/lib/types';
import { Select, Skeleton } from '@/components/ui/form-elements';
import {
  Activity, Award, BookOpen, FileText, FilePlus, Layers3, User,
  PenSquare, Trash2, Send,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { motion } from 'framer-motion';

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, {
  label: string;
  node: string;        // node bg + border
  badge: string;       // pill bg + text (light)
  badgeDark: string;   // pill bg + text (dark)
  icon: React.ComponentType<{ className?: string }>;
}> = {
  CREATE: {
    label: 'Created',
    node: 'bg-blue-500 border-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeDark: 'dark:bg-blue-500/[0.12] dark:text-blue-300 dark:border-blue-500/25',
    icon: FilePlus,
  },
  SUBMIT: {
    label: 'Submitted',
    node: 'bg-amber-500 border-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeDark: 'dark:bg-amber-500/[0.12] dark:text-amber-300 dark:border-amber-500/25',
    icon: Send,
  },
  GRADE: {
    label: 'Graded',
    node: 'bg-emerald-500 border-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeDark: 'dark:bg-emerald-500/[0.12] dark:text-emerald-300 dark:border-emerald-500/25',
    icon: Award,
  },
  UPDATE: {
    label: 'Updated',
    node: 'bg-purple-500 border-purple-500',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    badgeDark: 'dark:bg-purple-500/[0.12] dark:text-purple-300 dark:border-purple-500/25',
    icon: PenSquare,
  },
  DELETE: {
    label: 'Deleted',
    node: 'bg-rose-500 border-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    badgeDark: 'dark:bg-rose-500/[0.12] dark:text-rose-300 dark:border-rose-500/25',
    icon: Trash2,
  },
};

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Assignment: FileText,
  Submission: BookOpen,
  Grade: Award,
  Course: Layers3,
  User: User,
};

const FALLBACK_ACTION = {
  label: 'Action',
  node: 'bg-muted-foreground/40 border-muted-foreground/40',
  badge: 'bg-muted text-muted-foreground border-border',
  badgeDark: 'dark:bg-white/[0.06] dark:text-foreground/70 dark:border-white/[0.1]',
  icon: Activity,
};

type ActionFilter = 'ALL' | 'CREATE' | 'SUBMIT' | 'GRADE' | 'UPDATE' | 'DELETE';

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn(
      'flex flex-col items-center rounded-xl border px-5 py-3.5 min-w-[80px]',
      'bg-background dark:bg-card/80 dark:backdrop-blur-sm',
      'border-border/50 dark:border-white/[0.07]',
      'shadow-card hover:shadow-lift transition-shadow duration-150',
    )}>
      <span className={cn('text-2xl font-bold tabular-nums', color)}>{value}</span>
      <span className="text-[11px] text-muted-foreground mt-0.5 whitespace-nowrap">{label}</span>
    </div>
  );
}

// ─── Timeline entry ───────────────────────────────────────────────────────────

function TimelineEntry({
  log, isFirst, isLast, showUser,
}: {
  log: ActivityLog;
  isFirst: boolean;
  isLast: boolean;
  showUser: boolean;
}) {
  const cfg = ACTION_CONFIG[log.action] ?? FALLBACK_ACTION;
  const ActionIcon = cfg.icon;
  const EntityIcon = ENTITY_ICONS[log.entity] ?? FileText;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, x: -8 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
      }}
      className="flex gap-4 group"
    >
      {/* Track */}
      <div className="flex flex-col items-center shrink-0 w-5">
        {/* Top line */}
        <div className={cn('w-px', isFirst ? 'h-2 opacity-0' : 'h-3 bg-border/50 dark:bg-white/[0.08]')} />
        {/* Node */}
        <div className={cn(
          'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
          'ring-2 ring-background dark:ring-card',
          cfg.node,
        )}>
          <ActionIcon className="h-2.5 w-2.5 text-white" />
        </div>
        {/* Bottom line */}
        {!isLast && <div className="flex-1 w-px min-h-[2rem] bg-border/50 dark:bg-white/[0.08]" />}
      </div>

      {/* Card */}
      <div className={cn(
        'flex-1 min-w-0 rounded-lg border p-3.5 mb-3 last:mb-0',
        'bg-background dark:bg-card/70 dark:backdrop-blur-sm',
        'border-border/40 dark:border-white/[0.06]',
        'hover:border-border/80 dark:hover:border-white/[0.1] hover:shadow-card',
        'transition-all duration-150',
      )}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Action badge */}
            <span className={cn(
              'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border',
              cfg.badge, cfg.badgeDark,
            )}>
              <ActionIcon className="h-3 w-3" />
              {cfg.label}
            </span>
            {/* Entity */}
            <div className="flex items-center gap-1.5 text-sm text-foreground font-medium">
              <EntityIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {log.entity}
            </div>
            {/* Who (admin view) */}
            {showUser && log.user && (
              <span className="text-xs text-muted-foreground">
                by <span className="font-medium text-foreground/80">{log.user.fullName}</span>
              </span>
            )}
          </div>
          <time className="text-[11px] text-muted-foreground/70 shrink-0 whitespace-nowrap">
            {formatDateTime(log.createdAt)}
          </time>
        </div>

      </div>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyTimeline({ isAdmin }: { isAdmin: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="h-16 w-16 rounded-2xl bg-muted dark:bg-white/[0.04] flex items-center justify-center mb-4">
        <Activity className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <p className="font-serif font-medium text-foreground mb-1">No activity yet</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        {isAdmin
          ? 'Platform events will appear here as users interact with the system.'
          : 'Your submissions, grades, and other events will show up here.'}
      </p>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const { data: me } = useMe();
  const t = useT();
  const isAdmin = me?.role === 'ADMIN';
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');

  const { data: logs, isLoading } = useQuery<ActivityLog[]>({
    queryKey: ['activity', isAdmin],
    queryFn: () => api.get(isAdmin ? '/admin/activity' : '/me/activity'),
    enabled: !!me,
  });

  const filteredLogs = (logs || []).filter(log => actionFilter === 'ALL' || log.action === actionFilter);

  const counts = {
    total:  logs?.length || 0,
    create: (logs || []).filter(l => l.action === 'CREATE').length,
    submit: (logs || []).filter(l => l.action === 'SUBMIT').length,
    grade:  (logs || []).filter(l => l.action === 'GRADE').length,
  };

  if (isLoading) {
    return (
      <div className="space-y-5 max-w-2xl">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-24 rounded-xl" />)}
        </div>
        <div className="space-y-3 pl-9">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
            Audit timeline
          </span>
          <h1 className="font-serif text-[36px] tracking-[-0.015em] leading-[1.05] text-[var(--fg)]">
            {t.activity.title}
          </h1>
          <p className="text-[13px] text-[var(--fg-muted)] max-w-[60ch]">
            {isAdmin ? t.activity.adminSubtitle : t.activity.userSubtitle}
          </p>
        </div>

        <div className="w-48">
          <Select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value as ActionFilter)}
            className="text-xs"
          >
            <option value="ALL">{t.activity.allActions}</option>
            <option value="CREATE">{t.activity.create}</option>
            <option value="SUBMIT">{t.activity.submit}</option>
            <option value="GRADE">{t.activity.gradeAction}</option>
            <option value="UPDATE">{t.activity.update}</option>
            <option value="DELETE">{t.activity.delete}</option>
          </Select>
        </div>
      </div>

      {/* Stat pills */}
      <div className="flex gap-3 flex-wrap">
        <StatPill label={t.activity.total}       value={counts.total}  color="text-foreground" />
        <StatPill label={t.activity.create}      value={counts.create} color="text-blue-600 dark:text-blue-400" />
        <StatPill label={t.activity.submit}      value={counts.submit} color="text-amber-600 dark:text-amber-400" />
        <StatPill label={t.activity.gradeAction} value={counts.grade}  color="text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Timeline */}
      {!filteredLogs.length ? (
        <EmptyTimeline isAdmin={isAdmin} />
      ) : (
        <motion.div
          className="pl-2"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
          initial="hidden"
          animate="visible"
        >
          {filteredLogs.map((log, idx) => (
            <TimelineEntry
              key={log.id}
              log={log}
              isFirst={idx === 0}
              isLast={idx === filteredLogs.length - 1}
              showUser={isAdmin}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
