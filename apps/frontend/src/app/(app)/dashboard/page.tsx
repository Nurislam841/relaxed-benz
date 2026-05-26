'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMe } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import type {
  AdminStats,
  Announcement,
  Assignment,
  Course,
  Grade,
  GradeStats,
  Notification as N,
  ScheduleItem,
  Submission,
} from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/form-elements';
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { stagger, item as motionItem } from '@/lib/motion';
import { useLanguage, useT } from '@/lib/i18n';
import { getNotificationContent } from '@/lib/notification-content';
import { getAnnouncementContent } from '@/lib/announcement-content';
import {
  DashboardHero,
  SectionCard,
  StatTile,
  ScheduleRow,
  DeadlineTimeline,
  GradeRow,
  NotificationItem,
  QuickActionCard,
  type HeroStat,
} from './_components';

// ─── Types ────────────────────────────────────────────────────────────────────

type TeacherDashboardData = {
  courses: Course[];
  assignments: Assignment[];
  pendingSubmissions: Submission[];
  courseStats: Array<{
    courseId: string;
    courseTitle: string;
    courseCode: string;
    courseAverage: number | null;
    gradedCount: number;
    assignmentsCount: number;
  }>;
};

const LOCALES = { en: 'en-US', ru: 'ru-RU', kz: 'kk-KZ' } as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { from: monday.toISOString(), to: sunday.toISOString() };
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ text, sub, cta, ctaHref }: { text: string; sub?: string; cta?: string; ctaHref?: string }) {
  return (
    <div className="flex flex-col items-center py-7 text-center gap-2">
      <p className="text-sm font-medium text-foreground/80">{text}</p>
      {sub && <p className="text-xs text-muted-foreground max-w-xs">{sub}</p>}
      {cta && ctaHref && (
        <Link href={ctaHref} className="text-xs text-primary hover:underline mt-1">
          {cta}
        </Link>
      )}
    </div>
  );
}

// ─── Announcement item ────────────────────────────────────────────────────────

function AnnouncementCard({
  announcement,
  lang,
  globalLabel,
}: {
  announcement: Announcement;
  lang: 'en' | 'ru' | 'kz';
  globalLabel: string;
}) {
  const content = getAnnouncementContent(announcement, lang);
  return (
    <div className="rounded-lg border border-border/40 dark:border-white/[0.06] bg-background dark:bg-white/[0.02] p-4 space-y-1.5">
      <p className="text-sm font-medium leading-snug line-clamp-2">{content.title}</p>
      <p className="text-xs text-muted-foreground line-clamp-2">{content.body}</p>
      <div className="flex items-center gap-2 pt-0.5">
        <span className="text-xs text-muted-foreground/60">{announcement.author?.fullName}</span>
        {announcement.course ? (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {announcement.course.code}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {globalLabel}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: user } = useMe();
  const t = useT();
  const { lang } = useLanguage();
  const wk = weekRange();
  const locale = LOCALES[lang];
  const isStudent = user?.role === 'STUDENT';
  const isTeacher = user?.role === 'TEACHER';
  const isAdmin = user?.role === 'ADMIN';

  // ── Queries (PRESERVED) ────────────────────────────────────────────────────

  const { data: schedule, isLoading: scheduleLoading } = useQuery<ScheduleItem[]>({
    queryKey: ['sched', wk.from],
    queryFn: () => api.get(`/me/schedule?from=${wk.from}&to=${wk.to}`),
  });

  const { data: announcements, isLoading: announcementsLoading } = useQuery<Announcement[]>({
    queryKey: ['anns'],
    queryFn: () => api.get('/announcements'),
  });

  const { data: notifications = [] } = useQuery<N[]>({
    queryKey: ['notifs'],
    queryFn: () => api.get('/me/notifications'),
  });

  const { data: grades = [] } = useQuery<Grade[]>({
    queryKey: ['my-grades'],
    queryFn: () => api.get('/me/grades'),
    enabled: isStudent,
  });

  const { data: upcomingAssignments = [] } = useQuery<Assignment[]>({
    queryKey: ['upcoming-assignments'],
    queryFn: async () => {
      const raw = await api.get<{ items: Course[] } | Course[]>('/courses');
      const courses = Array.isArray(raw) ? raw : raw.items;
      const assignmentLists = await Promise.all(
        (courses || []).slice(0, 5).map((c) =>
          api
            .get<{ items: Assignment[] } | Assignment[]>(`/courses/${c.id}/assignments`)
            .then((r) => (Array.isArray(r) ? r : r.items))
            .catch(() => []),
        ),
      );
      return assignmentLists
        .flat()
        .filter((a) => new Date(a.dueAt) > new Date())
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
        .slice(0, 5);
    },
    enabled: isStudent,
  });

  const { data: teacherData, isLoading: teacherLoading } = useQuery<TeacherDashboardData>({
    queryKey: ['teacher-dashboard'],
    queryFn: async () => {
      const raw = await api.get<{ items: Course[] } | Course[]>('/courses');
      const allCourses = (Array.isArray(raw) ? raw : raw.items) ?? [];
      const courses = allCourses.filter((c) => c.roleInCourse === 'TEACHER');
      const assignmentLists = await Promise.all(
        courses.map((c) =>
          api
            .get<{ items: Assignment[] } | Assignment[]>(`/courses/${c.id}/assignments`)
            .then((r) => (Array.isArray(r) ? r : r.items))
            .catch(() => []),
        ),
      );
      const assignments = assignmentLists.flat();
      const submissionLists = await Promise.all(
        assignments.map((a) => api.get<Submission[]>(`/assignments/${a.id}/submissions`).catch(() => [])),
      );
      const pendingSubmissions = submissionLists.flat().filter((s) => !s.grade);
      const stats = await Promise.all(
        courses.map((c) => api.get<GradeStats>(`/courses/${c.id}/grades/stats`).catch(() => null)),
      );
      const courseStats = courses.map((c, i) => ({
        courseId: c.id,
        courseTitle: c.title,
        courseCode: c.code,
        courseAverage: stats[i]?.courseAverage ?? null,
        gradedCount: stats[i]?.assignments.reduce((s, x) => s + x.gradedCount, 0) ?? 0,
        assignmentsCount: assignmentLists[i]?.length ?? 0,
      }));
      return { courses, assignments, pendingSubmissions, courseStats };
    },
    enabled: isTeacher,
  });

  const { data: adminStats } = useQuery<AdminStats>({
    queryKey: ['admin-dashboard-stats'],
    queryFn: () => api.get('/admin/stats'),
    enabled: isAdmin,
  });

  // ── Derived data ──────────────────────────────────────────────────────────

  const today = new Date().toDateString();
  const todayClasses = useMemo(
    () =>
      (schedule || [])
        .filter((i) => new Date(i.startsAt).toDateString() === today)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [schedule, today],
  );

  const unreadNotifs = notifications.filter((n) => !n.isRead).slice(0, 5);

  const nextClassItem = useMemo(
    () =>
      (schedule || [])
        .filter((i) => new Date(i.startsAt) > new Date())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0],
    [schedule],
  );

  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const roleLabel = isAdmin ? t.profile.roleAdmin : isTeacher ? t.profile.roleTeacher : t.profile.roleStudent;

  const heroSubtitle = isTeacher
    ? t.dashboard.teacherSubtitle
    : isAdmin
      ? t.dashboard.adminSubtitle
      : t.dashboard.subtitle;

  // ── Hero stats (role-aware) ────────────────────────────────────────────────

  const heroStats = useMemo<HeroStat[]>(() => {
    if (isStudent) {
      return [
        { label: t.dashboard.upcoming, value: upcomingAssignments.length },
        { label: t.dashboard.recentGrades, value: grades.length },
        ...(todayClasses.length > 0 ? [{ label: t.dashboard.todayClasses, value: todayClasses.length }] : []),
      ];
    }
    if (isTeacher) {
      return [
        { label: t.dashboard.myCourses, value: teacherData?.courses.length ?? '—' },
        { label: t.dashboard.pendingReviews, value: teacherData?.pendingSubmissions.length ?? '—' },
        { label: t.dashboard.totalAssignments, value: teacherData?.assignments.length ?? '—' },
      ];
    }
    if (isAdmin && adminStats) {
      return [
        { label: t.dashboard.totalUsers, value: adminStats.users.total },
        { label: t.admin.courses, value: adminStats.courses },
        { label: t.admin.assignments, value: adminStats.assignments },
        { label: t.admin.enrollments, value: adminStats.enrollments },
      ];
    }
    return [];
  }, [
    isStudent,
    isTeacher,
    isAdmin,
    upcomingAssignments.length,
    grades.length,
    todayClasses.length,
    teacherData,
    adminStats,
    t,
  ]);

  // ── Quick links (role-aware) ───────────────────────────────────────────────

  const quickLinks = isAdmin
    ? [
        { href: '/admin', label: t.admin.title, icon: Shield, description: t.dashboard.qlAdminDesc },
        { href: '/courses', label: t.nav.courses, icon: BookOpen, description: t.dashboard.qlAdminCoursesDesc },
        { href: '/activity', label: t.nav.activity, icon: LayoutDashboard, description: t.dashboard.qlActivityDesc },
        {
          href: '/notifications',
          label: t.nav.notifications,
          icon: Bell,
          description: t.dashboard.qlNotificationsDesc,
        },
      ]
    : isTeacher
      ? [
          { href: '/courses', label: t.nav.courses, icon: BookOpen, description: t.dashboard.qlTeacherCoursesDesc },
          { href: '/schedule', label: t.nav.schedule, icon: Calendar, description: t.dashboard.qlScheduleDesc },
          {
            href: '/activity',
            label: t.nav.activity,
            icon: LayoutDashboard,
            description: t.dashboard.qlTeacherActivityDesc,
          },
          { href: '/search', label: t.nav.search, icon: Search, description: t.dashboard.qlSearchDesc },
        ]
      : [
          { href: '/courses', label: t.nav.courses, icon: BookOpen, description: t.dashboard.qlStudentCoursesDesc },
          { href: '/schedule', label: t.nav.schedule, icon: Calendar, description: t.dashboard.qlStudentScheduleDesc },
          {
            href: '/notifications',
            label: t.nav.notifications,
            icon: Bell,
            description: t.dashboard.qlStudentNotificationsDesc,
          },
        ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl space-y-6">
      {/* ── 1. HERO ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      >
        <DashboardHero
          name={user?.fullName}
          roleLabel={roleLabel}
          subtitle={heroSubtitle}
          formattedDate={formattedDate}
          stats={heroStats}
        />
      </motion.div>

      {/* ── 2. STAT TILES ROW (admin/teacher) ── */}

      {isAdmin && adminStats && (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[
            { label: t.dashboard.totalUsers, value: adminStats.users.total, icon: Users },
            { label: t.admin.courses, value: adminStats.courses, icon: BookOpen },
            { label: t.admin.assignments, value: adminStats.assignments, icon: ClipboardList },
            { label: t.admin.submissions, value: adminStats.submissions, icon: Award },
          ].map((s) => (
            <motion.div key={s.label} variants={motionItem}>
              <StatTile label={s.label} value={s.value} icon={s.icon} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {isTeacher && (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[
            {
              label: t.dashboard.myCourses,
              value: teacherLoading ? '…' : (teacherData?.courses.length ?? 0),
              icon: BookOpen,
            },
            {
              label: t.dashboard.totalAssignments,
              value: teacherLoading ? '…' : (teacherData?.assignments.length ?? 0),
              icon: ClipboardList,
            },
            {
              label: t.dashboard.pendingReviews,
              value: teacherLoading ? '…' : (teacherData?.pendingSubmissions.length ?? 0),
              icon: Clock,
            },
            {
              label: t.dashboard.gradedSubmissions,
              value: teacherLoading ? '…' : (teacherData?.courseStats.reduce((s, x) => s + x.gradedCount, 0) ?? 0),
              icon: Award,
            },
          ].map((s) => (
            <motion.div key={s.label} variants={motionItem}>
              <StatTile label={s.label} value={s.value} icon={s.icon} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── 3. QUICK ACTIONS — standalone full-width strip ── */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {quickLinks.map((link) => (
          <motion.div key={link.href} variants={motionItem}>
            <QuickActionCard href={link.href} label={link.label} description={link.description} icon={link.icon} />
          </motion.div>
        ))}
      </motion.div>

      {/* ── 4. MAIN CONTENT GRID ── */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-12 gap-5">
        {/* ── STUDENT layout ── */}
        {isStudent && (
          <>
            {/* Upcoming Deadlines — PRIMARY 8-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-8">
              <SectionCard title={t.dashboard.upcoming} icon={ClipboardList} variant="primary">
                {upcomingAssignments.length === 0 ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/[0.07] border border-emerald-100 dark:border-emerald-500/[0.15] px-3.5 py-2.5 mb-4">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                          {t.dashboard.noUpcoming}
                        </p>
                        <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70">
                          Check back once your instructors post assignments.
                        </p>
                      </div>
                    </div>
                    {[
                      { title: 'SQL Optimization Task', course: 'Database Systems', due: 'Tomorrow', urgent: true },
                      { title: 'API Design Report', course: 'Software Engineering', due: 'in 4 days', urgent: false },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-lg border border-dashed border-border/40 dark:border-white/[0.05] p-3 opacity-35 select-none pointer-events-none"
                      >
                        <div
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.urgent ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.course} · Due {item.due}
                          </p>
                        </div>
                        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground/40 shrink-0 mt-1">
                          demo
                        </span>
                      </div>
                    ))}
                    <div className="pt-1 text-center">
                      <Link href="/courses" className="text-xs text-primary hover:underline">
                        Browse your courses →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <DeadlineTimeline assignments={upcomingAssignments} />
                )}
              </SectionCard>
            </motion.div>

            {/* Today's schedule — 4-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-4">
              <SectionCard title={t.dashboard.todayClasses} icon={Clock}>
                {scheduleLoading ? (
                  <div className="space-y-2.5">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : todayClasses.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-muted dark:bg-white/[0.04] flex items-center justify-center">
                      <Clock className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t.dashboard.noClasses}</p>
                    {nextClassItem ? (
                      <p className="text-xs text-muted-foreground/70">
                        Next: <span className="font-medium text-foreground/60">{nextClassItem.course?.title}</span>
                        {' · '}
                        {new Intl.DateTimeFormat(locale, {
                          weekday: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(nextClassItem.startsAt))}
                      </p>
                    ) : (
                      <Link href="/schedule" className="text-xs text-primary/80 hover:text-primary hover:underline">
                        View full schedule →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayClasses.map((si) => (
                      <ScheduleRow key={si.id} item={si} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* Recent Grades + Gamification — 6-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-6 space-y-4">
              <SectionCard title={t.dashboard.recentGrades} icon={Award}>
                {grades.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-center text-muted-foreground py-2">
                      Grades appear here once your instructor reviews your work.
                    </p>
                    {[
                      { title: 'Lab Exercise #1', score: 87, max: 100 },
                      { title: 'Quiz: SQL Basics', score: 14, max: 20 },
                    ].map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-dashed border-border/40 dark:border-white/[0.05] px-3 py-2.5 opacity-35 select-none pointer-events-none"
                      >
                        <p className="text-xs font-medium text-foreground">{d.title}</p>
                        <p className="text-xs font-bold text-foreground">
                          {d.score}
                          <span className="font-normal text-muted-foreground">/{d.max}</span>
                        </p>
                      </div>
                    ))}
                    <div className="pt-1 text-center">
                      <Link href="/grades" className="text-xs text-primary hover:underline">
                        View all grades →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {grades.slice(0, 4).map((g) => (
                      <GradeRow key={g.id} grade={g} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* Notifications — 6-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-6">
              <SectionCard
                title={t.dashboard.notifications}
                icon={Bell}
                action={
                  <Link href="/notifications" className="text-[11px] text-primary hover:underline underline-offset-2">
                    {t.nav.notifications} →
                  </Link>
                }
              >
                {unreadNotifs.length === 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/[0.07] border border-emerald-100 dark:border-emerald-500/[0.15] px-3 py-2.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
                        {t.dashboard.allCaughtUp}
                      </p>
                    </div>
                    {notifications[0] ? (
                      <div className="rounded-lg border border-border/30 dark:border-white/[0.04] px-3 py-2.5 opacity-45 select-none pointer-events-none">
                        <p className="text-xs font-medium text-foreground line-clamp-1">{notifications[0].title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
                            new Date(notifications[0].createdAt),
                          )}{' '}
                          · read
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-center text-muted-foreground/60 py-2">
                        Grades, announcements, and updates will show here.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unreadNotifs.map((n) => (
                      <NotificationItem key={n.id} notification={n} content={getNotificationContent(n, t)} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>
          </>
        )}

        {/* ── TEACHER layout ── */}
        {isTeacher && (
          <>
            {/* Schedule — 7-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-7">
              <SectionCard title={t.dashboard.todayClasses} icon={Clock}>
                {scheduleLoading ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : todayClasses.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-muted dark:bg-white/[0.04] flex items-center justify-center">
                      <Clock className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t.dashboard.noClasses}</p>
                    {nextClassItem ? (
                      <p className="text-xs text-muted-foreground/70">
                        Next: <span className="font-medium text-foreground/60">{nextClassItem.course?.title}</span>
                        {' · '}
                        {new Intl.DateTimeFormat(locale, {
                          weekday: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(nextClassItem.startsAt))}
                      </p>
                    ) : (
                      <Link href="/schedule" className="text-xs text-primary/80 hover:text-primary hover:underline">
                        View full schedule →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayClasses.map((si) => (
                      <ScheduleRow key={si.id} item={si} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* Notifications — 5-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-5">
              <SectionCard
                title={t.dashboard.notifications}
                icon={Bell}
                action={
                  <Link href="/notifications" className="text-[11px] text-primary hover:underline underline-offset-2">
                    {t.nav.notifications} →
                  </Link>
                }
              >
                {unreadNotifs.length === 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/[0.07] border border-emerald-100 dark:border-emerald-500/[0.15] px-3 py-2.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
                        {t.dashboard.allCaughtUp}
                      </p>
                    </div>
                    {notifications[0] ? (
                      <div className="rounded-lg border border-border/30 dark:border-white/[0.04] px-3 py-2.5 opacity-45 select-none pointer-events-none">
                        <p className="text-xs font-medium text-foreground line-clamp-1">{notifications[0].title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
                            new Date(notifications[0].createdAt),
                          )}{' '}
                          · read
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-center text-muted-foreground/60 py-2">
                        Grades, announcements, and updates will show here.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unreadNotifs.map((n) => (
                      <NotificationItem key={n.id} notification={n} content={getNotificationContent(n, t)} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* Pending Reviews — PRIMARY 8-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-8">
              <SectionCard title={t.dashboard.pendingReviews} icon={ClipboardList} variant="primary">
                {teacherLoading ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !teacherData?.pendingSubmissions.length ? (
                  <div className="flex flex-col items-center py-8 text-center gap-2">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.08] flex items-center justify-center mb-1">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{t.dashboard.teacherReviewEmpty}</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      All submissions have been reviewed. New ones appear as students submit work.
                    </p>
                    <Link href="/courses" className="text-xs text-primary hover:underline mt-1">
                      View your courses →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {teacherData.pendingSubmissions.slice(0, 5).map((s) => (
                      <div key={s.id} className="rounded-lg border border-border/40 dark:border-white/[0.05] p-3">
                        <p className="text-sm font-medium">{s.student?.fullName}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{s.student?.email}</p>
                        {s.contentText && (
                          <p className="mt-1 truncate text-xs text-muted-foreground/70">{s.contentText}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* Course Performance — 4-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-4">
              <SectionCard title={t.dashboard.coursePerformance} icon={CheckCircle2}>
                {teacherLoading ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !teacherData?.courseStats.length ? (
                  <div className="flex flex-col items-center py-8 text-center gap-2">
                    <div className="h-10 w-10 rounded-xl bg-muted dark:bg-white/[0.04] flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t.dashboard.noCourseStats}</p>
                    <Link href="/courses" className="text-xs text-primary hover:underline">
                      Set up your first course →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {teacherData.courseStats.slice(0, 5).map((stat) => (
                      <div
                        key={stat.courseId}
                        className="rounded-lg border border-border/40 dark:border-white/[0.05] px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{stat.courseTitle}</p>
                            <p className="text-xs text-muted-foreground">{stat.courseCode}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {stat.courseAverage !== null ? `${t.dashboard.courseAverage}: ${stat.courseAverage}` : '—'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          {stat.gradedCount} {t.dashboard.gradedSubmissions.toLowerCase()}
                          {' · '}
                          {stat.assignmentsCount} {t.dashboard.totalAssignments.toLowerCase()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>
          </>
        )}

        {/* ── ADMIN layout ── */}
        {isAdmin && adminStats && (
          <>
            {/* Schedule — 7-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-7">
              <SectionCard title={t.dashboard.todayClasses} icon={Clock}>
                {scheduleLoading ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : todayClasses.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-muted dark:bg-white/[0.04] flex items-center justify-center">
                      <Clock className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t.dashboard.noClasses}</p>
                    {nextClassItem ? (
                      <p className="text-xs text-muted-foreground/70">
                        Next: <span className="font-medium text-foreground/60">{nextClassItem.course?.title}</span>
                        {' · '}
                        {new Intl.DateTimeFormat(locale, {
                          weekday: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(nextClassItem.startsAt))}
                      </p>
                    ) : (
                      <Link href="/schedule" className="text-xs text-primary/80 hover:text-primary hover:underline">
                        View full schedule →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayClasses.map((si) => (
                      <ScheduleRow key={si.id} item={si} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* Notifications — 5-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-5">
              <SectionCard
                title={t.dashboard.notifications}
                icon={Bell}
                action={
                  <Link href="/notifications" className="text-[11px] text-primary hover:underline underline-offset-2">
                    {t.nav.notifications} →
                  </Link>
                }
              >
                {unreadNotifs.length === 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/[0.07] border border-emerald-100 dark:border-emerald-500/[0.15] px-3 py-2.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
                        {t.dashboard.allCaughtUp}
                      </p>
                    </div>
                    {notifications[0] ? (
                      <div className="rounded-lg border border-border/30 dark:border-white/[0.04] px-3 py-2.5 opacity-45 select-none pointer-events-none">
                        <p className="text-xs font-medium text-foreground line-clamp-1">{notifications[0].title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
                            new Date(notifications[0].createdAt),
                          )}{' '}
                          · read
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-center text-muted-foreground/60 py-2">
                        Grades, announcements, and updates will show here.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unreadNotifs.map((n) => (
                      <NotificationItem key={n.id} notification={n} content={getNotificationContent(n, t)} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* Platform Stats — PRIMARY 8-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-8">
              <SectionCard title={t.dashboard.platformStats} icon={Shield} variant="primary">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: t.admin.students, value: adminStats.users.students },
                    { label: t.admin.teachers, value: adminStats.users.teachers },
                    { label: t.admin.enrollments, value: adminStats.enrollments },
                    { label: t.admin.grades, value: adminStats.grades },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-border/40 dark:border-white/[0.05] p-3">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="mt-1 text-xl font-semibold dark:text-primary">{s.value}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </motion.div>

            {/* Platform Health — 4-col */}
            <motion.div variants={motionItem} className="col-span-12 lg:col-span-4">
              <SectionCard title={t.dashboard.platformHealth} icon={Users}>
                <div className="space-y-3">
                  <div className="rounded-lg border border-border/40 dark:border-white/[0.05] p-3">
                    <p className="text-xs text-muted-foreground">{t.dashboard.avgGrade}</p>
                    <p className="mt-1 text-xl font-semibold dark:text-primary">{adminStats.avgGrade ?? '—'}</p>
                  </div>
                  <div className="rounded-lg border border-border/40 dark:border-white/[0.05] p-3">
                    <p className="text-xs text-muted-foreground">{t.dashboard.attendanceRate}</p>
                    <p className="mt-1 text-xl font-semibold dark:text-primary">
                      {adminStats.attendanceRate != null ? `${adminStats.attendanceRate}%` : '—'}
                    </p>
                  </div>
                </div>
              </SectionCard>
            </motion.div>
          </>
        )}

        {/* ── ANNOUNCEMENTS — full-width grid ── */}
        <motion.div variants={motionItem} className="col-span-12">
          <SectionCard
            title={t.dashboard.announcements}
            icon={Bell}
            action={
              announcements && announcements.length > 3 ? (
                <span className="text-[11px] text-muted-foreground">+{announcements.length - 3} more</span>
              ) : undefined
            }
          >
            {announcementsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : !announcements?.length ? (
              <div className="flex flex-col items-center py-8 text-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-muted dark:bg-white/[0.04] flex items-center justify-center">
                  <Bell className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm text-muted-foreground">{t.dashboard.noAnnouncements}</p>
                <p className="text-xs text-muted-foreground/60 max-w-xs">
                  Course announcements from your instructors will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {announcements.slice(0, 3).map((a) => (
                  <AnnouncementCard key={a.id} announcement={a} lang={lang} globalLabel={t.dashboard.global} />
                ))}
              </div>
            )}
          </SectionCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
