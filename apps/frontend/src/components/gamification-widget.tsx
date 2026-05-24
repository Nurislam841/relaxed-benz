'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap,
  Send,
  TrendingUp,
  Trophy,
  Crown,
  Brain,
  Sparkles,
  Award,
  CalendarCheck,
  Star,
  CheckCircle2,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AchievementSummary {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  earned: boolean;
  earnedAt: string | null;
}

const ICONS: Record<string, React.ElementType> = {
  GraduationCap,
  Send,
  TrendingUp,
  Trophy,
  Crown,
  Brain,
  Sparkles,
  Award,
  CalendarCheck,
  Star,
  CheckCircle2,
};

const TIER_COLOR: Record<AchievementSummary['tier'], string> = {
  bronze: 'text-amber-700 dark:text-amber-300',
  silver: 'text-slate-600 dark:text-slate-300',
  gold: 'text-yellow-600 dark:text-yellow-300',
  platinum: 'text-violet-600 dark:text-violet-300',
};

/**
 * Compact dashboard widget showing badge progress + the 3 most recent unlocks.
 * Clicking it navigates to the full /achievements page.
 */
export function GamificationWidget() {
  const { data: achievements = [] } = useQuery<AchievementSummary[]>({
    queryKey: ['achievements'],
    queryFn: () => api.get<AchievementSummary[]>('/me/achievements'),
    staleTime: 60_000,
  });

  if (achievements.length === 0) return null;

  const earned = achievements.filter((a) => a.earned);
  const recent = [...earned].sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '')).slice(0, 3);
  const next = achievements.find((a) => !a.earned);
  const pct = Math.round((earned.length / achievements.length) * 100);

  return (
    <Link href="/achievements" className="block group">
      <Card padding="md" hoverable className="h-full">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
              Achievements
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-[var(--fg-muted)] group-hover:translate-x-0.5 transition-transform" />
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-2xl text-[var(--fg)]">{earned.length}</span>
            <span className="text-[13px] text-[var(--fg-muted)]">/ {achievements.length} earned</span>
          </div>

          <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, var(--accent-500), var(--accent-700))',
              }}
            />
          </div>

          {/* Recent badges row */}
          {recent.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              {recent.map((a) => {
                const Icon = ICONS[a.icon] ?? Trophy;
                return (
                  <div
                    key={a.key}
                    className={cn(
                      'h-8 w-8 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center',
                      'ring-1 ring-[var(--border-color)]',
                    )}
                    title={a.title}
                  >
                    <Icon className={cn('h-4 w-4', TIER_COLOR[a.tier])} />
                  </div>
                );
              })}
              {next && (
                <div
                  className="h-8 w-8 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center opacity-50"
                  title={`Next: ${next.title}`}
                >
                  <Lock className="h-3.5 w-3.5 text-[var(--fg-muted)]" />
                </div>
              )}
            </div>
          )}

          {next && (
            <p className="text-[11px] text-[var(--fg-muted)] truncate">
              Next: <span className="text-[var(--fg)]">{next.title}</span>
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
