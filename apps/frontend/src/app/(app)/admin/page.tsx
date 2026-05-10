'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AdminStats } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Layers, BookOpen, UserPlus, FileText, Award, GraduationCap, Briefcase, BarChart2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useT } from '@/lib/i18n';

export default function AdminPage() {
  const t = useT();
  const { data: stats, isError, refetch } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats'),
    retry: 1,
  });

  const cards = [
    { l: t.admin.totalUsers,  v: stats?.users.total ?? '—',      icon: Users,        href: '/admin/users',       c: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/[0.15]'    },
    { l: t.admin.students,    v: stats?.users.students ?? '—',   icon: GraduationCap,href: '/admin/users',       c: 'text-sky-600 bg-sky-100 dark:text-sky-400 dark:bg-sky-500/[0.15]'      },
    { l: t.admin.teachers,    v: stats?.users.teachers ?? '—',   icon: Briefcase,    href: '/admin/users',       c: 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/[0.15]' },
    { l: t.admin.courses,     v: stats?.courses ?? '—',           icon: BookOpen,     href: '/admin/courses',     c: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/[0.15]' },
    { l: t.admin.enrollments, v: stats?.enrollments ?? '—',       icon: UserPlus,     href: '/admin/enrollments', c: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/[0.15]'  },
    { l: t.admin.assignments, v: stats?.assignments ?? '—',       icon: FileText,     href: '/admin/courses',     c: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/[0.15]' },
    { l: t.admin.submissions, v: stats?.submissions ?? '—',       icon: Layers,       href: '/admin/courses',     c: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/[0.15]' },
    { l: t.admin.grades,      v: stats?.grades ?? '—',            icon: Award,        href: '/admin/courses',     c: 'text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-500/[0.15]'    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
          Platform analytics
        </span>
        <h1 className="font-serif text-[36px] tracking-[-0.015em] leading-[1.05] text-[var(--fg)]">
          {t.admin.title}
        </h1>
      </div>

      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/[0.08] px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <p className="text-sm text-rose-700 dark:text-rose-300 flex-1">Failed to load stats.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5 h-7 text-xs">
            <RefreshCw className="h-3 w-3" /> Retry
          </Button>
        </div>
      )}

      {/* Core stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(s => (
          <Link key={s.l} href={s.href}>
            <Card className="hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="pt-5 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.c}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-serif">{s.v}</p>
                  <p className="text-xs text-muted-foreground">{s.l}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Analytics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <BarChart2 className="h-5 w-5"/>
            </div>
            <div>
              <p className="text-2xl font-bold font-serif">
                {stats?.avgGrade !== null && stats?.avgGrade !== undefined ? `${stats.avgGrade} pts` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">{t.admin.avgGrade}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-700 dark:bg-emerald-500/[0.15] dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5"/>
            </div>
            <div>
              <p className="text-2xl font-bold font-serif">
                {stats?.attendanceRate !== null && stats?.attendanceRate !== undefined ? `${stats.attendanceRate}%` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">{t.admin.attendance}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick navigation */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {[
          {
            l: t.admin.manageUsers,
            h: '/admin/users',
            icon: Users,
            desc: 'Create, edit, and manage student and teacher accounts',
            stat: stats?.users.total,
            statLabel: 'total users',
            iconColor: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-50 dark:bg-blue-500/[0.12]',
          },
          {
            l: t.admin.manageCourses,
            h: '/admin/courses',
            icon: BookOpen,
            desc: 'Add courses, assign teachers, manage semesters',
            stat: stats?.courses,
            statLabel: 'courses',
            iconColor: 'text-purple-600 dark:text-purple-400',
            iconBg: 'bg-purple-50 dark:bg-purple-500/[0.12]',
          },
          {
            l: t.admin.manageGroups,
            h: '/admin/groups',
            icon: Layers,
            desc: 'Organize students into academic groups',
            stat: undefined,
            statLabel: 'groups',
            iconColor: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-500/[0.12]',
          },
          {
            l: t.admin.manageEnrollments,
            h: '/admin/enrollments',
            icon: UserPlus,
            desc: 'Enroll students and assign roles in courses',
            stat: stats?.enrollments,
            statLabel: 'enrollments',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            iconBg: 'bg-emerald-50 dark:bg-emerald-500/[0.12]',
          },
        ].map(x => (
          <Link key={x.h} href={x.h}>
            <Card className="hover:border-primary/30 hover:shadow-sm transition-all duration-150 cursor-pointer h-full">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${x.iconBg}`}>
                    <x.icon className={`h-4.5 w-4.5 ${x.iconColor}`} />
                  </div>
                  {x.stat != null && (
                    <span className="text-xl font-bold font-serif text-foreground">{x.stat}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{x.l}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{x.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
