'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ScheduleItem, Assignment, Grade, Notification } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, BookOpen, ChevronRight } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HeroStat = { label: string; value: string | number };

// ── DashboardHero ─────────────────────────────────────────────────────────────

export function DashboardHero({
  name,
  roleLabel,
  subtitle,
  formattedDate,
  stats,
}: {
  name?: string;
  roleLabel?: string;
  subtitle?: string;
  formattedDate?: string;
  stats?: HeroStat[];
}) {
  const firstName = name?.split(' ')[0] ?? '';
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/40 bg-card px-6 py-8">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          {formattedDate && (
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {formattedDate}
            </p>
          )}
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">WELCOME BACK</p>
            {roleLabel && <Badge variant="outline" className="text-xs">{roleLabel}</Badge>}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{firstName || name}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {stats && stats.length > 0 && (
          <div className="flex flex-wrap gap-6">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-primary">{s.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SectionCard ───────────────────────────────────────────────────────────────

export function SectionCard({
  title,
  icon: Icon,
  variant,
  children,
  action,
}: {
  title: string;
  icon?: React.ElementType;
  variant?: 'default' | 'primary';
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className={cn(variant === 'primary' && 'border-primary/20 bg-primary/[0.02]')}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {Icon && <Icon className="h-4 w-4" />}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ── StatTile ──────────────────────────────────────────────────────────────────

export function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-0.5">{value}</p>
        </div>
        {Icon && (
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── ScheduleRow ───────────────────────────────────────────────────────────────

export function ScheduleRow({ item }: { item: ScheduleItem }) {
  const start = new Date(item.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const end   = new Date(item.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Clock className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.course?.title ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{start} – {end} · {item.room}</p>
      </div>
      <Badge variant="secondary" className="text-xs flex-shrink-0">{item.type}</Badge>
    </div>
  );
}

// ── DeadlineTimeline ──────────────────────────────────────────────────────────

export function DeadlineTimeline({ assignments }: { assignments: Assignment[] }) {
  if (!assignments.length) return (
    <p className="text-sm text-muted-foreground py-4 text-center">No upcoming deadlines</p>
  );
  return (
    <div className="space-y-2">
      {assignments.slice(0, 5).map(a => {
        const due = new Date(a.dueAt);
        const now = new Date();
        const diff = due.getTime() - now.getTime();
        const hours = Math.floor(diff / 3600000);
        const isUrgent = hours < 24 && hours >= 0;
        const isOverdue = diff < 0;
        return (
          <Link key={a.id} href={`/courses/${a.courseId}/assignments`} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition-colors group">
            <div className={cn(
              'h-2 w-2 rounded-full flex-shrink-0',
              isOverdue ? 'bg-destructive' : isUrgent ? 'bg-yellow-500' : 'bg-primary'
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.course?.title ?? ''}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={cn('text-xs font-medium', isOverdue ? 'text-destructive' : isUrgent ? 'text-yellow-500' : 'text-muted-foreground')}>
                {isOverdue ? 'Overdue' : `${hours}h`}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── GradeRow ──────────────────────────────────────────────────────────────────

export function GradeRow({ grade }: { grade: Grade }) {
  const assignment = grade.submission?.assignment;
  const pct = assignment ? Math.round((grade.score / assignment.maxScore) * 100) : null;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
        <BookOpen className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{assignment?.title ?? 'Assignment'}</p>
        <p className="text-xs text-muted-foreground">{assignment?.course?.title ?? ''}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold">{grade.score}<span className="text-muted-foreground text-xs">/{assignment?.maxScore}</span></p>
        {pct !== null && <p className="text-xs text-muted-foreground">{pct}%</p>}
      </div>
    </div>
  );
}

// ── NotificationItem ──────────────────────────────────────────────────────────

export function NotificationItem({
  notification,
  content,
}: {
  notification: Notification;
  content: { title: string; body: string };
}) {
  const el = (
    <div className={cn(
      'flex items-start gap-3 py-2 border-b border-border/40 last:border-0',
      !notification.isRead && 'opacity-100',
      notification.isRead && 'opacity-70',
    )}>
      <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{content.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{content.body}</p>
      </div>
      {notification.link && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
    </div>
  );
  if (notification.link) return <Link href={notification.link}>{el}</Link>;
  return el;
}

// ── QuickActionCard ───────────────────────────────────────────────────────────

export function QuickActionCard({
  href,
  label,
  description,
  icon: Icon,
}: {
  href: string;
  label: string;
  description?: string;
  icon?: React.ElementType;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/40 hover:bg-primary/[0.02] transition-colors cursor-pointer h-full">
        <CardContent className="pt-4 pb-4 space-y-2">
          {Icon && (
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{label}</p>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
