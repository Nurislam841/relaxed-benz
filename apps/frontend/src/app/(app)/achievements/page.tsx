'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  RefreshCw,
  Lock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { badgePop } from '@/lib/celebrate';

interface Achievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  earned: boolean;
  earnedAt: string | null;
  metadata: Record<string, unknown> | null;
}

// Icon name → component map. Server sends icon as a lucide name string so
// the catalog stays in one place (backend) and the UI just looks it up.
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

const TIER_TONE: Record<Achievement['tier'], { ring: string; bg: string; text: string; label: string }> = {
  bronze: {
    ring: 'ring-amber-700/30',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-800 dark:text-amber-200',
    label: 'Bronze',
  },
  silver: {
    ring: 'ring-slate-400/40',
    bg: 'bg-slate-50 dark:bg-slate-800/40',
    text: 'text-slate-700 dark:text-slate-200',
    label: 'Silver',
  },
  gold: {
    ring: 'ring-yellow-500/40',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-800 dark:text-yellow-200',
    label: 'Gold',
  },
  platinum: {
    ring: 'ring-violet-500/50',
    bg: 'bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-900/30 dark:to-fuchsia-900/30',
    text: 'text-violet-700 dark:text-violet-200',
    label: 'Platinum',
  },
};

export default function AchievementsPage() {
  const qc = useQueryClient();

  const { data: achievements = [], isLoading } = useQuery<Achievement[]>({
    queryKey: ['achievements'],
    queryFn: () => api.get<Achievement[]>('/me/achievements'),
  });

  const recompute = useMutation({
    mutationFn: () => api.post<{ newlyEarned: string[] }>('/me/achievements/recompute', {}),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['achievements'] });
      if (r.newlyEarned.length === 0) {
        toast({ title: 'No new badges yet — keep going!' });
      } else {
        badgePop();
        toast({
          title: `Unlocked ${r.newlyEarned.length} new badge${r.newlyEarned.length === 1 ? '' : 's'}!`,
          description: r.newlyEarned.join(', '),
        });
      }
    },
    onError: (e: Error) => toast({ title: 'Failed to refresh', description: e.message, variant: 'destructive' }),
  });

  const earnedCount = achievements.filter((a) => a.earned).length;
  const totalCount = achievements.length;
  const pct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <Eyebrow>Achievements</Eyebrow>
          <HDisplay size="lg" as="h1">
            Your <em>progress</em> badges
          </HDisplay>
          <p className="text-[14px] text-[var(--fg-muted)] max-w-[60ch]">
            Earn badges by submitting work, acing quizzes, and showing up to class. New unlocks appear automatically —
            hit refresh if you just completed something.
          </p>
        </div>
        <Button variant="secondary" onClick={() => recompute.mutate()} disabled={recompute.isPending}>
          <RefreshCw className={cn('h-3.5 w-3.5', recompute.isPending && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats strip */}
      <Card padding="md">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] font-mono">Earned</p>
            <p className="font-serif text-3xl text-[var(--fg)]">
              {earnedCount} <span className="text-[var(--fg-muted)] text-xl">/ {totalCount}</span>
            </p>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, var(--accent-500), var(--accent-700))',
                }}
              />
            </div>
            <p className="text-[12px] text-[var(--fg-muted)] mt-1">{pct}% complete</p>
          </div>
        </div>
      </Card>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-[var(--bg-subtle)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {achievements.map((a) => {
            const Icon = ICONS[a.icon] ?? Trophy;
            const tone = TIER_TONE[a.tier];
            return (
              <Card
                key={a.key}
                padding="md"
                className={cn(
                  'relative transition-all',
                  a.earned && 'shadow-ds-md',
                  !a.earned && 'opacity-60 grayscale',
                )}
              >
                <div className="flex flex-col items-center text-center gap-2">
                  <div
                    className={cn(
                      'h-14 w-14 rounded-full flex items-center justify-center ring-4 ring-offset-2',
                      tone.ring,
                      tone.bg,
                      'ring-offset-[var(--surface)]',
                    )}
                  >
                    {a.earned ? (
                      <Icon className={cn('h-7 w-7', tone.text)} />
                    ) : (
                      <Lock className="h-6 w-6 text-[var(--fg-muted)]" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <h3 className="font-serif text-[15px] font-semibold leading-tight">{a.title}</h3>
                    </div>
                    <Badge tone={a.earned ? 'success' : 'neutral'} variant="soft">
                      {tone.label}
                    </Badge>
                  </div>
                  <p className="text-[12px] text-[var(--fg-muted)] leading-snug">{a.description}</p>
                  {a.earned && a.earnedAt && (
                    <p className="text-[11px] font-mono text-[var(--fg-subtle)] mt-1">
                      {new Date(a.earnedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
