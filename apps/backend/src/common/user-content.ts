/**
 * Localized notification + email content.
 * Picks user.preferredLang ("en" | "ru" | "kz") or falls back to English.
 */

type Lang = 'en' | 'ru' | 'kz';

function resolveLang(lang?: string | null): Lang {
  if (lang === 'ru' || lang === 'kz') return lang;
  return 'en';
}

function fmtDate(d: Date, lang: Lang): string {
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'kz' ? 'kk-KZ' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export interface NotificationContent {
  title: string;
  body: string;
}

const ASSIGNMENT_STRINGS: Record<Lang, (title: string, course: string, dueStr: string) => NotificationContent> = {
  en: (title, course, dueStr) => ({
    title: `New assignment: ${title}`,
    body: `${course} · Due ${dueStr}`,
  }),
  ru: (title, course, dueStr) => ({
    title: `Новое задание: ${title}`,
    body: `${course} · Срок ${dueStr}`,
  }),
  kz: (title, course, dueStr) => ({
    title: `Жаңа тапсырма: ${title}`,
    body: `${course} · Мерзімі ${dueStr}`,
  }),
};

const GRADE_STRINGS: Record<Lang, (title: string, score: number, maxScore: number) => NotificationContent> = {
  en: (title, score, maxScore) => ({
    title: `Grade published: ${title}`,
    body: `Your score: ${score} / ${maxScore}`,
  }),
  ru: (title, score, maxScore) => ({
    title: `Оценка выставлена: ${title}`,
    body: `Ваш балл: ${score} / ${maxScore}`,
  }),
  kz: (title, score, maxScore) => ({
    title: `Баға қойылды: ${title}`,
    body: `Сіздің балыңыз: ${score} / ${maxScore}`,
  }),
};

export function getAssignmentNotificationContent(
  title: string,
  course: string,
  dueAt: Date,
  preferredLang?: string | null,
): NotificationContent {
  const lang = resolveLang(preferredLang);
  return ASSIGNMENT_STRINGS[lang](title, course, fmtDate(dueAt, lang));
}

export function getGradeNotificationContent(
  assignmentTitle: string,
  score: number,
  maxScore: number,
  preferredLang?: string | null,
): NotificationContent {
  const lang = resolveLang(preferredLang);
  return GRADE_STRINGS[lang](assignmentTitle, score, maxScore);
}
