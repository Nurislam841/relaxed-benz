'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useMe } from '@/hooks/use-auth';
import {
  LayoutDashboard, Calendar, BookOpen, CalendarDays, Bell, User as UI,
  Shield, Users, Layers, GraduationCap, UserPlus, ChevronDown, Menu, X, Search, Activity,
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { stagger, item, slideLeft, fade } from '@/lib/motion';
import { useT } from '@/lib/i18n';

const MN_KEYS = [
  { href: '/dashboard',     key: 'dashboard',     icon: LayoutDashboard },
  { href: '/schedule',      key: 'schedule',      icon: Calendar },
  { href: '/courses',       key: 'courses',       icon: BookOpen },
  { href: '/calendar',      key: 'calendar',      icon: CalendarDays },
  { href: '/search',        key: 'search',        icon: Search },
  { href: '/notifications', key: 'notifications', icon: Bell },
  { href: '/activity',      key: 'activity',      icon: Activity },
  { href: '/profile',       key: 'profile',       icon: UI },
] as const;

const AN_KEYS = [
  { href: '/admin',             key: 'adminOverview', icon: Shield },
  { href: '/admin/users',       key: 'adminUsers',    icon: Users },
  { href: '/admin/groups',      key: 'adminGroups',   icon: Layers },
  { href: '/admin/courses',     key: 'adminCourses',  icon: BookOpen },
  { href: '/admin/enrollments', key: 'adminEnroll',   icon: UserPlus },
] as const;

export function Sidebar() {
  const path = usePathname();
  const { data: user } = useMe();
  const t = useT();
  const [ao, sao] = useState(path.startsWith('/admin'));
  const [mo, smo] = useState(false);

  const ia = (h: string) => path === h || (h !== '/dashboard' && h !== '/admin' && path.startsWith(h + '/'));
  const roleLabel = user?.role
    ? {
        ADMIN: t.adminCrud.userRoleAdmin,
        TEACHER: t.adminCrud.userRoleTeacher,
        STUDENT: t.adminCrud.userRoleStudent,
      }[user.role]
    : '';

  const lk = (i: { href: string; key: keyof typeof t.nav; icon: React.ElementType }) => (
    <motion.div key={i.href} variants={item}>
      <Link
        href={i.href}
        onClick={() => smo(false)}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          ia(i.href)
            ? 'bg-accent text-primary font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        <i.icon className="h-4 w-4 shrink-0" />
        {t.nav[i.key]}
      </Link>
    </motion.div>
  );

  const inner = (
    <>
      <div className="px-5 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-serif text-lg font-semibold text-foreground">UniLMS</span>
        </Link>
      </div>

      <motion.nav
        className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {MN_KEYS.map(lk)}
        {user?.role === 'ADMIN' && (
          <>
            <motion.button
              variants={item}
              onClick={() => sao(!ao)}
              className="flex w-full items-center gap-2 px-3 py-2 mt-5 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              {t.nav.admin}
              <ChevronDown className={cn('h-3 w-3 ml-auto transition-transform', ao && 'rotate-180')} />
            </motion.button>
            <AnimatePresence>
              {ao && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                  className="overflow-hidden space-y-0.5"
                >
                  {AN_KEYS.map(i => (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={() => smo(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        ia(i.href)
                          ? 'bg-accent text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <i.icon className="h-4 w-4 shrink-0" />
                      {t.nav[i.key]}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.nav>

      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
            {user?.fullName?.charAt(0) ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate leading-tight">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => smo(true)}
        className="fixed top-4 left-4 z-40 lg:hidden rounded-md border border-border bg-background p-2"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mo && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              variants={fade}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed inset-0 bg-foreground/20"
              onClick={() => smo(false)}
            />
            <motion.div
              variants={slideLeft}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed left-0 top-0 bottom-0 w-64 bg-background border-r border-border flex flex-col z-50"
            >
              <button onClick={() => smo(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
              {inner}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        variants={slideLeft}
        initial="hidden"
        animate="visible"
        className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-border lg:bg-background lg:fixed lg:inset-y-0"
      >
        {inner}
      </motion.aside>
    </>
  );
}
