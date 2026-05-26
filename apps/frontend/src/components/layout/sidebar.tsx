'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Bell,
  User as UI,
  Shield,
  Users,
  Layers,
  GraduationCap,
  UserPlus,
  ChevronDown,
  Menu,
  X,
  Search,
  Activity,
  Sparkles,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMe } from '@/hooks/use-auth';
import { useT } from '@/lib/i18n';
import { stagger, item, slideLeft, fade } from '@/lib/motion';

type NavItem = { href: string; key: string; icon: React.ElementType };

const MAIN_GROUP: NavItem[] = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/courses', key: 'courses', icon: BookOpen },
  { href: '/schedule', key: 'schedule', icon: Calendar },
];

const SECONDARY_GROUP: NavItem[] = [
  { href: '/ai-analysis', key: 'aiAnalysis', icon: Sparkles },
  { href: '/kahoot/play', key: 'joinLive', icon: Radio },
  { href: '/search', key: 'search', icon: Search },
  { href: '/notifications', key: 'notifications', icon: Bell },
  { href: '/activity', key: 'activity', icon: Activity },
  { href: '/profile', key: 'profile', icon: UI },
];

const ADMIN_GROUP: NavItem[] = [
  { href: '/admin', key: 'adminOverview', icon: Shield },
  { href: '/admin/users', key: 'adminUsers', icon: Users },
  { href: '/admin/groups', key: 'adminGroups', icon: Layers },
  { href: '/admin/courses', key: 'adminCourses', icon: BookOpen },
  { href: '/admin/enrollments', key: 'adminEnroll', icon: UserPlus },
  { href: '/admin/schedule', key: 'adminSchedule', icon: Calendar },
];

export function Sidebar() {
  const path = usePathname();
  const { data: user } = useMe();
  const t = useT();
  // Admin section opens by default for admin users; clicking the header toggles.
  const [adminOpen, setAdminOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (h: string) => path === h || (h !== '/dashboard' && h !== '/admin' && path.startsWith(h + '/'));

  const roleLabel = user?.role
    ? {
        ADMIN: t.adminCrud.userRoleAdmin,
        TEACHER: t.adminCrud.userRoleTeacher,
        STUDENT: t.adminCrud.userRoleStudent,
      }[user.role]
    : '';

  const renderItem = (i: NavItem) => {
    const active = isActive(i.href);
    return (
      <motion.div key={i.href} variants={item}>
        <Link
          href={i.href}
          onClick={() => setMobileOpen(false)}
          data-active={active}
          className={cn(
            'group relative flex items-center gap-3 px-3 py-1.5 rounded-[6px] text-[13px] font-medium',
            'transition-colors duration-ds-fast ease-ds-out',
            active
              ? 'bg-[var(--accent-100)] text-[var(--accent-700)] dark:bg-[var(--accent-50)]'
              : 'text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]',
          )}
        >
          <span
            aria-hidden
            className={cn('w-1 h-1 rounded-full shrink-0', active ? 'bg-[var(--accent-500)]' : 'bg-[var(--fg-subtle)]')}
          />
          <i.icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{(t.nav as any)[i.key]}</span>
        </Link>
      </motion.div>
    );
  };

  const navContent = (
    <>
      {/* Brand */}
      <div className="px-5 pb-5 mb-4 border-b border-[var(--border-color)]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div
            className="relative w-7 h-7 rounded-[7px] shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))',
              boxShadow: 'var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <span
              aria-hidden
              className="absolute inset-[6px] rounded-[4px] mix-blend-overlay"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, rgba(255,255,255,.85), transparent 50%), conic-gradient(from 200deg, transparent, rgba(255,255,255,.4), transparent)',
              }}
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-serif italic text-[20px] tracking-[-0.01em] text-[var(--fg)]">UniLMS</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Learning OS
            </span>
          </div>
        </Link>
      </div>

      <motion.nav variants={stagger} initial="hidden" animate="visible" className="flex-1 px-3 pb-4 overflow-y-auto">
        {/* Main group */}
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-subtle)] px-3 mb-1.5">
          {t.nav.workspace ?? 'Workspace'}
        </div>
        <div className="space-y-px mb-5">{MAIN_GROUP.map(renderItem)}</div>

        {/* Secondary */}
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-subtle)] px-3 mb-1.5">
          {t.nav.activityGroup ?? 'Activity'}
        </div>
        <div className="space-y-px mb-5">{SECONDARY_GROUP.map(renderItem)}</div>

        {user?.role === 'ADMIN' && (
          <>
            <motion.button
              variants={item}
              type="button"
              onClick={() => setAdminOpen(!adminOpen)}
              className="flex w-full items-center gap-1.5 px-3 mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
            >
              <span>{t.nav.admin}</span>
              <ChevronDown
                className={cn('h-3 w-3 ml-auto transition-transform duration-ds-base', adminOpen && 'rotate-180')}
              />
            </motion.button>
            <AnimatePresence initial={false}>
              {adminOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    duration: 0.25,
                    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
                  }}
                  className="overflow-hidden space-y-px"
                >
                  {ADMIN_GROUP.map(renderItem)}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.nav>

      {/* User card */}
      <div className="border-t border-[var(--border-color)] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[var(--accent-100)] flex items-center justify-center text-[13px] font-semibold text-[var(--accent-700)] shrink-0">
            {user?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate leading-tight text-[var(--fg)]">{user?.fullName}</p>
            <p className="text-[11px] text-[var(--fg-subtle)] font-mono">{roleLabel}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-40 lg:hidden rounded-[7px] border border-[var(--border-color)] bg-[var(--surface)] p-2 shadow-ds-xs"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4 text-[var(--fg)]" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              variants={fade}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed inset-0 bg-[var(--overlay)]"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              variants={slideLeft}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed left-0 top-0 bottom-0 w-[260px] bg-[var(--bg-subtle)] border-r border-[var(--border-color)] flex flex-col z-50 pt-5"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-3 right-3 text-[var(--fg-subtle)] hover:text-[var(--fg)] p-1"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              {navContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        variants={slideLeft}
        initial="hidden"
        animate="visible"
        className="hidden lg:flex lg:flex-col lg:w-[248px] lg:border-r lg:border-[var(--border-color)] lg:bg-[var(--bg-subtle)] lg:fixed lg:inset-y-0 lg:pt-5"
      >
        {navContent}
      </motion.aside>
    </>
  );
}
