'use client';

import * as React from 'react';
import Link from 'next/link';
import { LucideIcon, Bell } from 'lucide-react';
import type { Assignment, Grade, Notification as N, ScheduleItem } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Returns a user-friendly first name to greet by. Falls back to full name
 *  if first token looks like a generic role word (e.g. "System Admin" → "Admin"). */
function pickGreetingName(fullName?: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2 && /^(system|admin|user|guest)$/i.test(parts[0])) {
    return parts[1];
  }
  return parts[0];
}

// ── Types ─────────────────────────────────────────────────────
export type HeroStat = { label: string; value: number | string };

// ── DashboardHero ─────────────────────────────────────────────
interface DashboardHeroProps {
  name?: string;
  roleLabel?: string;
  subtitle?: string;
  formattedDate?: string;
  stats?: HeroStat[];
}

export function DashboardHero({
  name,
  roleLabel,
  subtitle,
  formattedDate,
  stats = [],
}: DashboardHeroProps) {
  const t = useT();
  return (
    <Card className="relative overflow-hidden p-6 sm:p-8" hoverable={false}>
      {/* Decorative violet glow */}
      <div
        aria-hidden
        className="absolute -top-24 -right-24 w-[280px] h-[280px] rounded-full pointer-events-none opacity-50"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--accent-300), transparent 60%), transparent 65%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            {roleLabel && <Eyebrow>{roleLabel}</Eyebrow>}
            {formattedDate && (
              <>
                <span className="text-[var(--fg-subtle)]">·</span>
                <Eyebrow>{formattedDate}</Eyebrow>
              </>
            )}
          </div>
          {name && (
            <HDisplay size="md" as="h1">
              {t.dashboard.welcomeBack}, <em>{pickGreetingName(name)}</em>
            </HDisplay>
          )}
          {subtitle && (
            <p className="text-[15px] text-[var(--fg-muted)] leading-[1.55] max-w-[60ch]">
              {subtitle}
            </p>
          )}
        </div>

        {stats.length > 0 && (
          <div className="flex flex-wrap gap-6 lg:gap-8 lg:pl-4 shrink-0">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <Eyebrow>{s.label}</Eyebrow>
                <span className="font-serif text-[34px] tracking-[-0.02em] tabular-nums leading-none text-[var(--fg)]">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── StatTile ──────────────────────────────────────────────────
interface StatTileProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  delta?: string;
}

export function StatTile({ label, value, icon: Icon, delta }: StatTileProps) {
  return (
    <Card hoverable padding="md" className="flex items-center gap-3">
      {Icon && (
        <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 bg-[var(--accent-100)] text-[var(--accent-700)]">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <Eyebrow>{label}</Eyebrow>
        <div className="flex items-baseline gap-2">
          <span className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--fg)] leading-none">
            {value}
          </span>
          {delta && (
            <span className="text-[11px] font-mono text-[var(--success)]">↑ {delta}</span>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── QuickActionCard ───────────────────────────────────────────
interface QuickActionCardProps {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
}

export function QuickActionCard({ href, label, description, icon: Icon }: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group block rounded-[12px] border border-[var(--border-color)] bg-[var(--surface)] p-3.5',
        'transition-[box-shadow,border-color,transform] duration-ds-base ease-ds-out',
        'hover:border-[var(--accent-300)] hover:shadow-ds-md hover:-translate-y-px'
      )}
    >
      <div className="flex items-center gap-3 mb-1.5">
        <div className="w-7 h-7 rounded-[7px] bg-[var(--accent-100)] text-[var(--accent-700)] flex items-center justify-center group-hover:bg-[var(--accent-200)] transition-colors">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[13px] font-semibold text-[var(--fg)]">{label}</span>
      </div>
      {description && (
        <p className="text-[11.5px] text-[var(--fg-muted)] leading-snug">{description}</p>
      )}
    </Link>
  );
}

// ── SectionCard ────────────────────────────────────────────────
interface SectionCardProps {
  title: string;
  icon?: LucideIcon;
  variant?: 'default' | 'primary';
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, icon: Icon, variant, action, children, className }: SectionCardProps) {
  const isPrimary = variant === 'primary';
  return (
    <Card
      className={cn(
        'p-5',
        isPrimary && 'bg-gradient-to-b from-[var(--accent-50)] to-[var(--surface)]',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-3.5 h-3.5 text-[var(--accent-600)]" />}
        <h3 className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--fg)]">{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

// ── ScheduleRow ────────────────────────────────────────────────
interface ScheduleRowProps {
  item: ScheduleItem;
}

const TYPE_TONES: Record<string, { bg: string; fg: string; labelKey: string; fallback: string }> = {
  LECTURE: { bg: 'var(--accent-100)', fg: 'var(--accent-700)', labelKey: 'typeLecture', fallback: 'Lecture' },
  PRACTICE: { bg: 'color-mix(in oklch, var(--info), transparent 85%)', fg: 'var(--info)', labelKey: 'typePractice', fallback: 'Practice' },
  LAB: { bg: 'color-mix(in oklch, var(--success), transparent 85%)', fg: 'var(--success)', labelKey: 'typeLab', fallback: 'Lab' },
  EXAM: { bg: 'color-mix(in oklch, var(--danger), transparent 85%)', fg: 'var(--danger)', labelKey: 'typeExam', fallback: 'Exam' },
};

export function ScheduleRow({ item }: ScheduleRowProps) {
  const t = useT() as any;
  const tone = TYPE_TONES[item.type] ?? TYPE_TONES.LECTURE;
  const label = t.ui?.[tone.labelKey] ?? tone.fallback;
  const start = new Date(item.startsAt);
  const end = new Date(item.endsAt);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="flex items-start gap-3 rounded-[8px] border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5">
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ background: tone.fg }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[var(--fg)] truncate">
          {item.course?.title || 'Class'}
        </p>
        <p className="text-[11px] text-[var(--fg-muted)] font-mono mt-0.5">
          {fmt(start)} – {fmt(end)} · {item.room || '—'}
        </p>
      </div>
      <span
        className="text-[10px] font-mono uppercase tracking-[0.06em] px-1.5 py-0.5 rounded shrink-0"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {label}
      </span>
    </div>
  );
}

// ── DeadlineTimeline ──────────────────────────────────────────
interface DeadlineTimelineProps {
  assignments: Assignment[];
}

export function DeadlineTimeline({ assignments }: DeadlineTimelineProps) {
  const now = Date.now();
  return (
    <div className="space-y-2">
      {assignments.map((a) => {
        const due = new Date(a.dueAt).getTime();
        const hoursLeft = (due - now) / (1000 * 60 * 60);
        const tone =
          hoursLeft < 24 ? 'danger' : hoursLeft < 72 ? 'warning' : 'neutral';
        const dotColor =
          tone === 'danger'
            ? 'var(--danger)'
            : tone === 'warning'
            ? 'var(--warning)'
            : 'var(--accent-500)';
        return (
          <Link
            key={a.id}
            href={`/courses/${a.courseId}/assignments/${a.id}`}
            className="flex items-start gap-3 rounded-[8px] border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5 hover:bg-[var(--bg-subtle)] transition-colors duration-ds-fast"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0 mt-1.5"
              style={{ background: dotColor }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--fg)] truncate">{a.title}</p>
              <p className="text-[11px] text-[var(--fg-muted)] font-mono mt-0.5">
                {a.course?.code ?? ''} · due{' '}
                {new Date(a.dueAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <Badge
              tone={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'neutral'}
              variant="soft"
              size="sm"
            >
              {hoursLeft < 24 ? 'today' : hoursLeft < 48 ? 'tomorrow' : `${Math.round(hoursLeft / 24)}d`}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

// ── GradeRow ──────────────────────────────────────────────────
interface GradeRowProps {
  grade: Grade;
}

export function GradeRow({ grade }: GradeRowProps) {
  const max = grade.submission?.assignment?.maxScore ?? 100;
  const pct = max > 0 ? Math.round((grade.score / max) * 100) : 0;
  const color =
    pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="flex items-center justify-between rounded-[8px] border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--fg)] truncate">
          {grade.submission?.assignment?.title ?? 'Assignment'}
        </p>
        <p className="text-[11px] text-[var(--fg-muted)] font-mono mt-0.5 truncate">
          {grade.submission?.assignment?.course?.code ?? ''}
        </p>
      </div>
      <div className="text-right shrink-0 ml-3">
        <span className="text-[15px] font-semibold tabular-nums" style={{ color }}>
          {grade.score}
        </span>
        <span className="text-[12px] text-[var(--fg-muted)]">/{max}</span>
      </div>
    </div>
  );
}

// ── NotificationItem ──────────────────────────────────────────
interface NotificationItemProps {
  notification: N;
  content?: { title: string; body?: string } | null;
}

export function NotificationItem({ notification, content }: NotificationItemProps) {
  const title = content?.title ?? notification.title;
  const body = content?.body ?? notification.body;

  return (
    <Link
      href={notification.link ?? '/notifications'}
      className={cn(
        'flex items-start gap-3 rounded-[8px] px-3 py-2.5',
        'transition-colors duration-ds-fast',
        notification.isRead
          ? 'bg-[var(--surface)] border border-[var(--border-color)]'
          : 'bg-[var(--accent-50)] border border-[var(--accent-200)] hover:bg-[var(--accent-100)]'
      )}
    >
      <Bell
        className={cn(
          'h-3.5 w-3.5 mt-0.5 shrink-0',
          notification.isRead ? 'text-[var(--fg-subtle)]' : 'text-[var(--accent-600)]'
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[var(--fg)] truncate">{title}</p>
        {body && (
          <p className="text-[11px] text-[var(--fg-muted)] mt-0.5 line-clamp-2 leading-snug">
            {body}
          </p>
        )}
      </div>
    </Link>
  );
}
