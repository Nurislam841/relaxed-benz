import { Role } from '@prisma/client';

/**
 * Achievement catalog — single source of truth for badge metadata.
 *
 * Why in code, not the DB:
 *  - Adding/changing a badge is a code review, not a runtime migration.
 *  - Frontend ships the same icon/title/description, so they MUST stay in sync.
 *  - Backfilling is trivial (no foreign keys to update) since we store the
 *    key as a string in `user_achievements.achievement_key`.
 *
 * To add a new achievement: append an entry below + extend the evaluator in
 * achievements.service.ts. Order here = display order in the UI.
 */
export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string; // lucide-react icon name — frontend maps it to a component
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  /** Restrict to roles that can earn it (defaults to STUDENT only). */
  roles?: Role[];
}

export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  // ─── Onboarding ────────────────────────────────────────────────────────
  {
    key: 'first_steps',
    title: 'First Steps',
    description: 'Logged into UniLMS for the first time.',
    icon: 'GraduationCap',
    tier: 'bronze',
    roles: [Role.STUDENT, Role.TEACHER, Role.ADMIN],
  },

  // ─── Assignments ───────────────────────────────────────────────────────
  {
    key: 'first_submission',
    title: 'Getting Started',
    description: 'Submitted your first assignment.',
    icon: 'Send',
    tier: 'bronze',
  },
  {
    key: 'five_submissions',
    title: 'On a Roll',
    description: 'Submitted 5 assignments.',
    icon: 'TrendingUp',
    tier: 'silver',
  },
  {
    key: 'perfect_score',
    title: 'Perfect Score',
    description: 'Received a 100% grade on an assignment.',
    icon: 'Trophy',
    tier: 'gold',
  },
  {
    key: 'three_perfect_scores',
    title: 'Triple Crown',
    description: 'Received three 100% grades — exceptional consistency.',
    icon: 'Crown',
    tier: 'platinum',
  },

  // ─── Quizzes ───────────────────────────────────────────────────────────
  {
    key: 'first_quiz',
    title: 'Quiz Rookie',
    description: 'Completed your first quiz.',
    icon: 'Brain',
    tier: 'bronze',
  },
  {
    key: 'quiz_perfect',
    title: 'Quiz Master',
    description: 'Scored 100% on a quiz.',
    icon: 'Sparkles',
    tier: 'gold',
  },
  {
    key: 'five_quizzes',
    title: 'Quiz Veteran',
    description: 'Completed 5 quizzes.',
    icon: 'Award',
    tier: 'silver',
  },

  // ─── Attendance ────────────────────────────────────────────────────────
  {
    key: 'attendance_streak_5',
    title: 'Reliable',
    description: 'Marked PRESENT for 5 consecutive sessions.',
    icon: 'CalendarCheck',
    tier: 'silver',
  },
  {
    key: 'perfect_attendance_course',
    title: 'Never Misses a Class',
    description: '100% attendance on a course (no absences across 5+ sessions).',
    icon: 'Star',
    tier: 'gold',
  },

  // ─── Teacher achievements ──────────────────────────────────────────────
  {
    key: 'teacher_first_quiz_created',
    title: 'Quiz Author',
    description: 'Created your first quiz for students.',
    icon: 'Sparkles',
    tier: 'bronze',
    roles: [Role.TEACHER, Role.ADMIN],
  },
  {
    key: 'teacher_active_grader',
    title: 'Active Grader',
    description: 'Graded 10 submissions.',
    icon: 'CheckCircle2',
    tier: 'silver',
    roles: [Role.TEACHER, Role.ADMIN],
  },
];

export function getAchievementDef(key: string): AchievementDef | undefined {
  return ACHIEVEMENT_CATALOG.find((a) => a.key === key);
}
