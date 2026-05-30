import { Role } from '@prisma/client';
import { t, type BotLang } from './bot-i18n';

/**
 * Clamp Telegram sendPoll arguments to the API's hard limits.
 *
 *   - question ≤ 300 chars
 *   - each option ≤ 100 chars
 *   - 2 ≤ options ≤ 10
 *
 * Returns `null` when fewer than two non-empty options are available (Telegram
 * rejects a 1-option poll). Without this clamping, a Kahoot question longer
 * than 300 chars used to silently disappear from the live game because the
 * underlying `sendPoll` call would throw and the gateway caught + swallowed it.
 */
export function sanitizePollArgs(
  question: string,
  options: string[],
  correctIndex: number,
): { q: string; opts: string[]; ci: number } | null {
  const q = (question || ' ').slice(0, 300) || ' ';
  const opts = options.map((o) => (o && o.trim() ? o : ' ').slice(0, 100)).slice(0, 10);
  if (opts.length < 2) return null;
  const ci = Math.min(Math.max(correctIndex, 0), opts.length - 1);
  return { q, opts, ci };
}

/**
 * Bot compose-menu command set per role.
 *
 *   - 'unlinked'  → [help, link] (visible while the chat is not yet linked).
 *   - STUDENT     → personal-account commands (/grades, /join, /submit, …).
 *   - TEACHER     → oversight commands (/at_risk, /bind, /unbind, …) — no
 *                   /grades or /join (those would be no-ops for a teacher).
 *   - ADMIN       → lean cross-cutting set; admins drive the platform via web.
 *
 * Hiding role-irrelevant commands keeps the compose menu honest — students
 * never see /at_risk (which would 403 server-side), teachers never see /grades
 * (which is student-self-grades), etc.
 */
export function commandsForRole(mode: 'unlinked' | Role, lang: BotLang): { command: string; description: string }[] {
  if (mode === 'unlinked') {
    return [
      { command: 'help', description: 'Help' },
      { command: 'link', description: 'Connect your UniLMS account — /link 123456' },
    ];
  }
  const tr = (k: any) => t(k, lang).slice(2, 64);
  if (mode === Role.ADMIN) {
    return [
      { command: 'ask', description: tr('cmdAsk') },
      { command: 'at_risk', description: tr('cmdAtRisk') },
      { command: 'today_attendance', description: tr('cmdAttendance') },
      { command: 'app', description: tr('cmdApp') },
      { command: 'help', description: 'Help' },
      { command: 'unlink', description: tr('cmdUnlink') },
    ];
  }
  if (mode === Role.TEACHER) {
    return [
      { command: 'today', description: tr('cmdToday') },
      { command: 'schedule', description: tr('cmdSchedule') },
      { command: 'upcoming', description: tr('cmdUpcoming') },
      { command: 'ask', description: tr('cmdAsk') },
      { command: 'at_risk', description: tr('cmdAtRisk') },
      { command: 'today_attendance', description: tr('cmdAttendance') },
      { command: 'bind', description: tr('cmdBind') },
      { command: 'unbind', description: tr('cmdUnbind') },
      { command: 'app', description: tr('cmdApp') },
      { command: 'help', description: 'Help' },
      { command: 'unlink', description: tr('cmdUnlink') },
    ];
  }
  // student (default)
  return [
    { command: 'today', description: tr('cmdToday') },
    { command: 'schedule', description: tr('cmdSchedule') },
    { command: 'grades', description: tr('cmdGrades') },
    { command: 'upcoming', description: tr('cmdUpcoming') },
    { command: 'ask', description: tr('cmdAsk') },
    { command: 'coach', description: tr('cmdCoach') },
    { command: 'join', description: tr('cmdJoin') },
    { command: 'submit', description: tr('cmdSubmit') },
    { command: 'app', description: tr('cmdApp') },
    { command: 'help', description: 'Help' },
    { command: 'unlink', description: tr('cmdUnlink') },
  ];
}
