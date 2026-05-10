'use client';

/**
 * Course workspace layout.
 *
 * Structure:
 *   1. Rich course hero — editorial light / glass dark
 *   2. Sticky subnav — animated spring indicator, replaces plain tabs
 *   3. Two-column body — main content + sticky right sidebar (xl+)
 *
 * Right sidebar acts as an "assistant panel" — always shows the
 * most relevant course context regardless of the active sub-page.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Assignment, Course, CourseProgress, Grade, PaginatedResponse } from '@/lib/types';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/form-elements';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle, ArrowLeft, BarChart3, BookMarked, Brain, Calendar,
  CalendarCheck, CheckCircle2, ClipboardList, Clock,
  LayoutDashboard, Sparkles, Users,
} from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useT } from '@/lib/i18n';
import { useMe } from '@/hooks/use-auth';
import { formatDate } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string) {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ progress, size = 64 }: { progress: number; size?: number }) {
  const r = (size - 8) / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
    >
      <circle
        cx={size / 2} cy={size / 2} r={r}
        strokeWidth={4} fill="none"
        className="stroke-foreground/10 dark:stroke-white/[0.08]"
      />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        strokeWidth={4} fill="none"
        strokeLinecap="round"
        className="stroke-primary"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: Math.max(0, Math.min(1, progress / 100)) }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.4 }}
      />
    </svg>
  );
}

// ─── Course hero ──────────────────────────────────────────────────────────────

const HERO_STAGGER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const HERO_ITEM: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

function CourseHero({
  course, progress, isStudent, id,
}: {
  course:    Course;
  progress:  CourseProgress | undefined;
  isStudent: boolean;
  id:        string;
}) {
  const pct  = progress?.progress ?? 0;

  return (
    <div className="relative overflow-hidden rounded-2xl">

      {/* ── LIGHT: editorial backdrop — layered depth ── */}
      <div className="absolute inset-0 dark:hidden">
        <Image
          src="https://images.unsplash.com/photo-1562774053-701939374585?w=1200&q=80&auto=format&fit=crop"
          alt=""
          fill
          className="object-cover object-center opacity-[0.18]"
          priority
        />
        {/* Left anchor fog */}
        <div className="absolute inset-0 bg-gradient-to-r from-background/[0.99] via-background/96 to-background/72" />
        {/* Bottom fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
        {/* Radial depth vignette — creates distance illusion */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 72% 50%, transparent 25%, hsl(var(--background) / 0.55) 75%)' }}
        />
        {/* Top edge darkening for containment */}
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-background/60 to-transparent" />
      </div>

      {/* ── DARK: animated grid + layered teal glow ── */}
      <div className="absolute inset-0 hidden dark:block bg-card overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),' +
              'linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            animation: 'grid-shift 8s linear infinite',
          }}
        />
        {/* Primary glow — floats organically top-left */}
        <motion.div
          className="absolute -top-16 -left-16 h-80 w-80 rounded-full bg-primary/[0.14] blur-[100px]"
          animate={{ x: [0, 14, -10, 0], y: [0, -12, 8, 0], scale: [1, 1.09, 0.96, 1], opacity: [0.5, 0.72, 0.58, 0.5] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Secondary glow — floats bottom-right with offset phase */}
        <motion.div
          className="absolute bottom-0 right-8 h-44 w-60 rounded-full bg-primary/[0.07] blur-[80px]"
          animate={{ x: [0, -16, 9, 0], y: [0, 10, -7, 0], scale: [1, 1.15, 0.93, 1], opacity: [0.3, 0.52, 0.38, 0.3] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-card/10 to-card/65" />
        <div className="absolute inset-0 bg-gradient-to-t from-card/55 via-transparent to-transparent" />
        {/* Soft blur vignette at bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card/70 to-transparent" />
      </div>

      {/* ── Noise texture — adds grain depth to both themes ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Two-column hero content ── */}
      <motion.div
        variants={HERO_STAGGER}
        initial="hidden"
        animate="visible"
        className="relative flex flex-col lg:flex-row lg:items-stretch"
      >
        {/* ── LEFT: course identity ── */}
        <div className="flex-1 px-8 pt-8 pb-7 lg:px-11 lg:pt-11 lg:pb-10">

          {/* Back + course code eyebrow */}
          <motion.div variants={HERO_ITEM} className="flex items-center gap-3 mb-5">
            <Link
              href="/courses"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:bg-[var(--bg-muted)] transition-colors"
              aria-label="Back to courses"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
                'font-mono text-[10px] font-semibold tracking-[0.10em] uppercase',
                'border-[var(--accent-200)] text-[var(--accent-700)] bg-[var(--accent-50)]',
                'dark:shadow-[0_0_12px_-2px_color-mix(in_oklch,var(--accent-500),transparent_40%)]',
                'transition-colors duration-ds-fast'
              )}
            >
              <span className="w-1 h-1 rounded-full bg-[var(--accent-500)]" />
              {course.code}
            </span>
          </motion.div>

          {/* Title — Instrument Serif italic */}
          <motion.h1
            variants={HERO_ITEM}
            className="font-serif font-normal leading-[1.05] tracking-[-0.02em] text-foreground text-[34px] lg:text-[42px] max-w-xl"
          >
            {course.title}
          </motion.h1>

          {/* Teacher */}
          <motion.div variants={HERO_ITEM} className="mt-3 flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 dark:bg-primary/20 text-[11px] font-semibold text-primary">
              {course.teacher?.fullName?.charAt(0) ?? '?'}
            </div>
            <span className="text-sm text-foreground/65 dark:text-foreground/60">
              {course.teacher?.fullName}
            </span>
          </motion.div>

          {/* Description */}
          {course.description && (
            <motion.p
              variants={HERO_ITEM}
              className="mt-3 text-sm text-foreground/65 dark:text-muted-foreground leading-relaxed max-w-lg line-clamp-2"
            >
              {course.description}
            </motion.p>
          )}

          {/* Metadata badges */}
          <motion.div variants={HERO_ITEM} className="mt-4 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral" variant="soft">
              <Calendar className="h-2.5 w-2.5" />
              {course.semester}
            </Badge>
            {(course as any)?._count?.enrollments != null && (
              <Badge tone="neutral" variant="soft">
                <Users className="h-2.5 w-2.5" />
                {(course as any)._count.enrollments} enrolled
              </Badge>
            )}
            {(course as any)?._count?.assignments != null && (
              <Badge tone="neutral" variant="soft">
                <ClipboardList className="h-2.5 w-2.5" />
                {(course as any)._count.assignments} assignments
              </Badge>
            )}
          </motion.div>
        </div>

        {/* ── RIGHT: info panel ── */}
        <motion.div
          variants={HERO_ITEM}
          className={cn(
            'flex flex-col gap-4 m-4 p-5 rounded-xl lg:m-5 lg:w-56 xl:w-60 shrink-0',
            // Light — clean white card
            'bg-white/90 border border-border/50 shadow-card backdrop-blur-sm',
            // Dark — glassmorphic
            'dark:bg-white/[0.04] dark:border-white/[0.1] dark:backdrop-blur-md dark:shadow-glass',
          )}
        >
          {/* Progress (student only) */}
          {isStudent && (
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <ProgressRing progress={pct} size={58} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-foreground dark:text-primary">{pct}%</span>
                </div>
              </div>
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
                  Progress
                </p>
                <p className="text-sm font-semibold text-[var(--fg)] mt-0.5">
                  {progress?.completedAssignments ?? 0}
                  <span className="font-normal text-[var(--fg-muted)] text-xs"> / {progress?.totalAssignments ?? 0}</span>
                </p>
              </div>
            </div>
          )}

          {isStudent && <div className="h-px bg-border/40 dark:bg-white/[0.07]" />}

          {/* CTA buttons */}
          <div className="flex flex-col gap-2">
            <Link href={`/courses/${id}/assignments`}>
              <Button
                size="sm"
                className="w-full gap-2 dark:shadow-glow-sm dark:hover:shadow-glow transition-shadow duration-200"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Assignments
              </Button>
            </Link>
            <Link href={`/courses/${id}/grades`}>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 dark:hover:border-primary/40 dark:hover:text-primary transition-colors duration-150"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                {isStudent ? 'My Grades' : 'Grades'}
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Sticky subnav ────────────────────────────────────────────────────────────

function StickySubnav({
  tabs,
  path,
  id,
  isSticky,
}: {
  tabs:     { l: string; h: string; icon: React.ComponentType<{ className?: string }> }[];
  path:     string;
  id:       string;
  isSticky: boolean;
}) {
  return (
    <div
      className={cn(
        'sticky top-14 z-20 -mx-px transition-all duration-200',
        isSticky
          ? 'bg-background/96 backdrop-blur-md border-b border-border/80 shadow-sm dark:bg-card/92 dark:backdrop-blur-md dark:border-white/[0.08]'
          : 'border-b border-border dark:border-white/[0.08]',
      )}
    >
      <div className="flex overflow-x-auto gap-0 scrollbar-none">
        {tabs.map(tab => {
          const href     = `/courses/${id}/${tab.h}`;
          const isActive = path.endsWith(tab.h);
          return (
            <Link
              key={tab.h}
              href={href}
              className={cn(
                'group relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap',
                'transition-all duration-150',
                isActive
                  ? 'text-primary dark:text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 dark:hover:text-foreground/80 dark:hover:bg-white/[0.03]',
              )}
            >
              <tab.icon className={cn(
                'h-3.5 w-3.5 shrink-0 transition-colors duration-150',
                isActive ? 'text-primary' : '',
              )} />
              {tab.l}
              {/* Hover glow trail — grows from center on inactive tabs */}
              {!isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-0 group-hover:w-full bg-primary/25 dark:bg-primary/35 transition-[width] duration-200 ease-out rounded-full" />
              )}
              {isActive && (
                <motion.div
                  layoutId="course-subnav-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary dark:shadow-[0_0_8px_0px_hsl(var(--primary)/0.7)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI Assistant panel ───────────────────────────────────────────────────────

function AiAssistantPanel({
  nextDeadline,
  progress,
  isStudent,
  id,
}: {
  nextDeadline: Assignment | undefined;
  progress:     CourseProgress | undefined;
  isStudent:    boolean;
  id:           string;
}) {
  if (!isStudent) return null;

  const days = nextDeadline ? daysUntil(nextDeadline.dueAt) : null;

  type Urgency = 'critical' | 'warn' | 'ok';
  type Rec = { icon: React.ElementType; urgency: Urgency; title: string; body: string; cta?: string; href?: string };

  let rec: Rec;
  const shortTitle = (s: string) => s.length > 30 ? s.slice(0, 30) + '…' : s;
  if (days !== null && days < 0) {
    rec = { icon: AlertCircle, urgency: 'critical', title: 'Past due',
      body: `Submit "${shortTitle(nextDeadline!.title)}" now to salvage points`,
      cta: 'Submit now', href: `/courses/${id}/assignments` };
  } else if (days === 0) {
    rec = { icon: AlertCircle, urgency: 'critical', title: 'Due today',
      body: `"${shortTitle(nextDeadline!.title)}" — final hours remaining`,
      cta: 'Submit', href: `/courses/${id}/assignments` };
  } else if (days !== null && days <= 3) {
    rec = { icon: Clock, urgency: 'warn', title: `${days}d to deadline`,
      body: `Finish "${shortTitle(nextDeadline!.title)}" to stay on track`,
      cta: 'Start now', href: `/courses/${id}/assignments` };
  } else if (progress && (progress.progress ?? 0) < 40 && (progress.totalAssignments ?? 0) > 0) {
    const needed = progress.totalAssignments - progress.completedAssignments;
    rec = { icon: Clock, urgency: 'warn', title: 'Behind schedule',
      body: `${needed} assignment${needed !== 1 ? 's' : ''} remaining — pick up the pace`,
      cta: 'Catch up', href: `/courses/${id}/assignments` };
  } else if (progress && (progress.totalAssignments ?? 0) > 0) {
    const remaining = progress.totalAssignments - progress.completedAssignments;
    const nextMilestone = Math.min(100, Math.ceil(((progress.completedAssignments + 1) / progress.totalAssignments) * 10) * 10);
    rec = { icon: CheckCircle2, urgency: 'ok', title: 'On track',
      body: remaining > 0
        ? `Complete ${remaining === 1 ? 'this one' : '1 more'} to reach ${nextMilestone}%`
        : 'All assignments complete — well done',
      cta: remaining > 0 ? 'View tasks' : undefined,
      href: remaining > 0 ? `/courses/${id}/assignments` : undefined };
  } else if (nextDeadline) {
    rec = { icon: CheckCircle2, urgency: 'ok', title: 'On track',
      body: `Next due: ${formatDate(nextDeadline.dueAt)}`,
      cta: 'View tasks', href: `/courses/${id}/assignments` };
  } else {
    rec = { icon: CheckCircle2, urgency: 'ok', title: 'All clear', body: 'No pending deadlines. Great work!' };
  }

  const RecIcon = rec.icon;

  return (
    <div className={cn(
      'relative rounded-xl border overflow-hidden p-3.5',
      // Light — clean, minimal primary tint
      'border-primary/15 bg-gradient-to-br from-primary/[0.04] via-primary/[0.02] to-transparent',
      // Dark — futuristic glass panel
      'dark:border-primary/20 dark:bg-primary/[0.06]',
      'dark:shadow-[0_0_28px_-8px_hsl(var(--primary)/0.35)]',
    )}>
      {/* Urgency color bar at top */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-[2px]',
        rec.urgency === 'critical' && 'bg-gradient-to-r from-rose-500/70 via-rose-400 to-rose-500/70',
        rec.urgency === 'warn'     && 'bg-gradient-to-r from-amber-500/70 via-amber-400 to-amber-500/70',
        rec.urgency === 'ok'       && 'bg-gradient-to-r from-primary/40 via-primary/70 to-primary/40',
      )} />

      {/* Dark mode: animated scan line */}
      <motion.div
        className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent pointer-events-none hidden dark:block"
        animate={{ x: ['-10px', '260px'] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 7 }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="h-5 w-5 rounded-[6px] flex items-center justify-center text-white"
          style={{ background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))' }}
        >
          <Sparkles className="h-3 w-3" />
        </div>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.10em] text-[var(--accent-700)]">
          AI Assist
        </span>
        {/* Live pulse indicator */}
        <motion.div
          className="ml-auto h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--accent-500)' }}
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Recommendation */}
      <div className="flex items-start gap-2.5">
        <RecIcon className={cn(
          'h-3.5 w-3.5 shrink-0 mt-0.5',
          rec.urgency === 'critical' && 'text-rose-500 dark:text-rose-400',
          rec.urgency === 'warn'     && 'text-amber-500 dark:text-amber-400',
          rec.urgency === 'ok'       && 'text-primary',
        )} />
        <div className="min-w-0">
          <p className={cn(
            'text-[11px] font-semibold leading-tight',
            rec.urgency === 'critical' && 'text-rose-600 dark:text-rose-400',
            rec.urgency === 'warn'     && 'text-amber-600 dark:text-amber-400',
            rec.urgency === 'ok'       && 'text-foreground',
          )}>
            {rec.title}
          </p>
          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 leading-snug">
            {rec.body}
          </p>
        </div>
      </div>

      {rec.cta && rec.href && (
        <Link href={rec.href}>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              'mt-3 w-full h-6 text-[11px]',
              'border-primary/20 text-primary hover:bg-primary/[0.06]',
              'dark:border-primary/25 dark:hover:bg-primary/[0.1] transition-colors duration-150',
            )}
          >
            {rec.cta}
          </Button>
        </Link>
      )}
    </div>
  );
}

// ─── Right sidebar ────────────────────────────────────────────────────────────

function CourseRightSidebar({
  course, progress, nextDeadline, recentGrade, isStudent, id,
}: {
  course:       Course;
  progress:     CourseProgress | undefined;
  nextDeadline: Assignment | undefined;
  recentGrade:  Grade | undefined;
  isStudent:    boolean;
  id:           string;
}) {
  const days = nextDeadline ? daysUntil(nextDeadline.dueAt) : null;

  const cardCn = cn(
    'rounded-xl border p-4',
    'border-border/50 bg-card',
    'dark:border-white/[0.07] dark:bg-card/80 dark:backdrop-blur-sm dark:shadow-glass',
  );

  return (
    <div className="space-y-3">

      {/* AI assistant panel — student only */}
      <AiAssistantPanel
        nextDeadline={nextDeadline}
        progress={progress}
        isStudent={isStudent}
        id={id}
      />

      {/* Next deadline */}
      {nextDeadline && (
        <div
          className={cn(
            cardCn,
            days !== null && days <= 1 && 'border-destructive/25 dark:border-red-400/20',
            days !== null && days > 1 && days <= 3 && 'border-amber-400/30 dark:border-amber-400/20',
          )}
        >
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.10em] text-[var(--fg-subtle)] mb-2">
            Next Deadline
          </p>
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
            {nextDeadline.title}
          </p>
          <p className={cn(
            'text-xs mt-1 font-medium',
            days !== null && days <= 1 ? 'text-destructive dark:text-red-400' :
            days !== null && days <= 3 ? 'text-amber-600 dark:text-amber-400' :
            'text-muted-foreground',
          )}>
            {days === 0 ? '⚡ Due today' :
             days === 1 ? '⚡ Due tomorrow' :
             days !== null && days < 0 ? '⚠ Overdue' :
             `Due ${formatDate(nextDeadline.dueAt)}`}
          </p>
          <Link href={`/courses/${id}/assignments`}>
            <Button size="sm" variant="outline" className="mt-3 w-full h-7 text-xs">
              View assignment →
            </Button>
          </Link>
        </div>
      )}

      {/* Recent grade — student */}
      {isStudent && recentGrade && (() => {
        const score    = recentGrade.score;
        const maxScore = recentGrade.submission?.assignment?.maxScore ?? 100;
        const pct      = Math.round((score / maxScore) * 100);
        const colorCn  =
          pct >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400' :
          pct >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400' :
                      'bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-400';
        return (
          <div className={cardCn}>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.10em] text-[var(--fg-subtle)] mb-3">
              Recent Grade
            </p>
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold', colorCn)}>
                {score}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                  {recentGrade.submission?.assignment?.title ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{score} / {maxScore} pts · {pct}%</p>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  const { id }    = useParams<{ id: string }>();
  const path      = usePathname();
  const t         = useT();
  const { data: user } = useMe();
  const isStudent = user?.role === 'STUDENT';

  // Sticky sentinel detection
  const sentinelRef             = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 1, rootMargin: '-56px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const tabs = [
    { l: t.courseLayout.overview,     h: 'overview',     icon: LayoutDashboard },
    { l: t.courseLayout.assignments,  h: 'assignments',  icon: ClipboardList   },
    { l: t.courseLayout.materials,    h: 'materials',    icon: BookMarked      },
    { l: t.courseLayout.grades,       h: 'grades',       icon: BarChart3       },
    { l: t.courseLayout.attendance,   h: 'attendance',   icon: CalendarCheck   },
    { l: t.courseLayout.participants, h: 'participants', icon: Users           },
    { l: t.courseLayout.quiz,         h: 'quiz',         icon: Brain           },
  ];

  const activeTab = path.split('/').pop() ?? '';

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: course, isLoading } = useQuery<Course>({
    queryKey: ['course', id],
    queryFn: () => api.get(`/courses/${id}`),
  });

  const { data: progress } = useQuery<CourseProgress>({
    queryKey: ['course-progress', id],
    queryFn: () => api.get(`/courses/${id}/progress`),
    enabled:  isStudent,
  });

  const { data: assignmentsData } = useQuery<PaginatedResponse<Assignment>>({
    queryKey: ['c-asgn', id, 1],
    queryFn: () => api.get(`/courses/${id}/assignments?page=1&limit=8`),
  });

  const nextDeadline = useMemo(() => {
    return (assignmentsData?.items ?? [])
      .filter(a => new Date(a.dueAt) > new Date())
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
  }, [assignmentsData]);

  const { data: myGrades } = useQuery<Grade[]>({
    queryKey: ['my-grades'],
    queryFn: () => api.get('/me/grades'),
    enabled:  isStudent,
  });

  const recentGrade = useMemo(() => {
    return (myGrades ?? [])
      .filter(g => g.submission?.assignment?.course?.id === id)
      .sort((a, b) => new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime())[0];
  }, [myGrades, id]);

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full" />
        <div className="flex gap-6 mt-6">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-72 w-full" />
          </div>
          <div className="hidden xl:block w-60 space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!course) return null;

  return (
    <div className="space-y-0">

      {/* 1. Course hero */}
      <CourseHero
        course={course}
        progress={progress}
        isStudent={isStudent}
        id={id}
      />

      {/* Sentinel — 1px invisible div for sticky detection */}
      <div ref={sentinelRef} className="h-px w-full" />

      {/* 2. Sticky subnav */}
      <StickySubnav tabs={tabs} path={path} id={id} isSticky={isSticky} />

      {/* 3. Two-column body */}
      <div className="mt-6 flex items-start gap-6">

        {/* Main content area */}
        <main className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Right sidebar — visible at xl, sticky below subnav */}
        <aside className="hidden xl:block w-60 shrink-0 sticky top-[6.5rem]">
          <CourseRightSidebar
            course={course}
            progress={progress}
            nextDeadline={nextDeadline}
            recentGrade={recentGrade}
            isStudent={isStudent}
            id={id}
          />
        </aside>
      </div>
    </div>
  );
}
