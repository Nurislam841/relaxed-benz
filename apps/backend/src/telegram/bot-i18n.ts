/**
 * Telegram-bot i18n.
 *
 * Three languages mirror the web app's locale set (English / Russian / Kazakh).
 * All bot replies should flow through `t(key, lang)` so the user gets messages
 * in whichever language they picked on /start. Linked users have a
 * `preferredLang` row in DB; for unlinked users the choice is kept in
 * TelegramService.unlinkedLangs (in-memory, cleared after linking or 1h TTL).
 *
 * Keep the keys flat — nested namespaces just make the call-site noisier.
 * Substitutions use `{name}` placeholders; pass a vars map to `t()` to fill.
 */

export type BotLang = 'en' | 'ru' | 'kk';

const STRINGS = {
  pickLanguage: {
    en: '👋 Welcome to UniLMS bot! Please pick your language:',
    ru: '👋 Добро пожаловать в UniLMS-бот! Выберите язык:',
    kk: '👋 UniLMS-ботқа қош келдіңіз! Тілді таңдаңыз:',
  },
  languageSet: {
    en: '✅ Language set to English.',
    ru: '✅ Язык установлен: Русский.',
    kk: '✅ Тіл орнатылды: Қазақша.',
  },
  promptCode: {
    en: 'Now open your UniLMS Profile → tap "Connect Telegram in one tap" → you\'ll get a 6-digit code.\n\nSend it here as:\n/link 123456',
    ru: 'Теперь открой профиль UniLMS → нажми «Связать Telegram в один тап» → получишь 6-значный код.\n\nОтправь его сюда командой:\n/link 123456',
    kk: 'Енді UniLMS профиліңді аш → «Connect Telegram in one tap» батырмасын бас → 6-таңбалы кодты аласың.\n\nОны мынадай командамен жібер:\n/link 123456',
  },
  linkUsage: {
    en: 'Usage: /link 123456\n\nOpen your UniLMS Profile → tap "Connect Telegram in one tap" to get a fresh code.',
    ru: 'Использование: /link 123456\n\nОткрой профиль UniLMS → нажми «Connect Telegram in one tap», чтобы получить код.',
    kk: 'Қолданысы: /link 123456\n\nUniLMS профиліңде «Connect Telegram in one tap» батырмасын басып код ал.',
  },
  linkBadCode: {
    en: '❌ Code not recognised or expired (5-minute TTL). Open your UniLMS Profile and generate a fresh code.',
    ru: '❌ Код не распознан или истёк (5-минутный TTL). Открой профиль UniLMS и сгенерируй новый код.',
    kk: '❌ Код танылмады немесе мерзімі бітті (5 минут). UniLMS профиліңде жаңа кодты жаса.',
  },
  linkSuccess: {
    en: "✅ UniLMS linked! You'll get notifications here. Try /today, /grades, /ask.",
    ru: '✅ UniLMS подключён! Уведомления будут приходить сюда. Попробуй /today, /grades, /ask.',
    kk: '✅ UniLMS қосылды! Хабарламалар осы жерге келеді. /today, /grades, /ask командаларын көр.',
  },
  notLinked: {
    en: '🔒 You are not linked yet. Open UniLMS Profile, get a code, then send /link 123456.',
    ru: '🔒 Ты ещё не подключён. Открой профиль UniLMS, получи код и отправь /link 123456.',
    kk: '🔒 Сен әлі қосылмағансың. UniLMS профиліңде кодты ал да /link 123456 жібер.',
  },
  welcomeBack: {
    en: '👋 Welcome back, {name}! Type /help to see what I can do.',
    ru: '👋 С возвращением, {name}! Напиши /help, чтобы увидеть список команд.',
    kk: '👋 Қош келдің, {name}! Командаларды көру үшін /help деп жаз.',
  },
  unlinked: {
    en: '🔌 Disconnected. Your account is no longer linked.',
    ru: '🔌 Отключено. Аккаунт больше не связан с этим чатом.',
    kk: '🔌 Ажыратылды. Аккаунт енді осы чатпен байланыспаған.',
  },
  unlinkAlready: {
    en: 'You are not linked.',
    ru: 'Ты не подключён.',
    kk: 'Сен қосылмағансың.',
  },
  helpTitle: {
    en: 'UniLMS bot — commands',
    ru: 'UniLMS-бот — команды',
    kk: 'UniLMS-боты — командалар',
  },
  helpStudentsHeader: {
    en: '— For students —',
    ru: '— Для студентов —',
    kk: '— Студенттерге —',
  },
  helpTeachersHeader: {
    en: '— For teachers —',
    ru: '— Для преподавателей —',
    kk: '— Оқытушыларға —',
  },
  helpOtherHeader: {
    en: '— Other —',
    ru: '— Другое —',
    kk: '— Басқа —',
  },
  cmdToday: {
    en: "/today — today's schedule + due assignments",
    ru: '/today — расписание на сегодня + задания со сроком сдачи',
    kk: '/today — бүгінгі сабақ кестесі + тапсырыс мерзімдері',
  },
  cmdSchedule: {
    en: '/schedule — week ahead',
    ru: '/schedule — расписание на неделю',
    kk: '/schedule — апта кестесі',
  },
  cmdGrades: {
    en: '/grades — latest grades',
    ru: '/grades — последние оценки',
    kk: '/grades — соңғы бағалар',
  },
  cmdUpcoming: {
    en: '/upcoming — assignments due this week',
    ru: '/upcoming — задания на эту неделю',
    kk: '/upcoming — осы аптадағы тапсырмалар',
  },
  cmdAsk: {
    en: '/ask <question> — ask the AI assistant',
    ru: '/ask <вопрос> — спросить AI-ассистента',
    kk: '/ask <сұрақ> — AI-көмекшіге сұрақ қой',
  },
  cmdCoach: {
    en: '/coach — personal AI study coach',
    ru: '/coach — личный AI-репетитор',
    kk: '/coach — жеке AI-тренер',
  },
  cmdJoin: {
    en: '/join CODE — join a live Kahoot session',
    ru: '/join КОД — присоединиться к live-Kahoot сессии',
    kk: '/join КОД — live-Kahoot сессиясына қосылу',
  },
  cmdSubmit: {
    en: '/submit <assignmentId> — submit a photo / PDF',
    ru: '/submit <id-задания> — сдать фото / PDF',
    kk: '/submit <тапсырма-id> — фото / PDF тапсыру',
  },
  cmdApp: {
    en: '/app — open full UniLMS inside Telegram',
    ru: '/app — открыть UniLMS прямо в Telegram',
    kk: '/app — UniLMS-ті Telegram ішінде ашу',
  },
  cmdAtRisk: {
    en: '/at_risk <courseCode> — at-risk students (AI)',
    ru: '/at_risk <код-курса> — студенты с риском (AI)',
    kk: '/at_risk <курс-коды> — қауіптегі студенттер (AI)',
  },
  cmdAttendance: {
    en: '/today_attendance <courseCode> — quick stats',
    ru: '/today_attendance <код-курса> — статистика на сегодня',
    kk: '/today_attendance <курс-коды> — бүгінгі статистика',
  },
  cmdBind: {
    en: '/bind <courseCode> — link this group to a course',
    ru: '/bind <код-курса> — привязать эту группу к курсу',
    kk: '/bind <курс-коды> — осы топты курспен байланыстыру',
  },
  cmdUnbind: {
    en: '/unbind — unlink group',
    ru: '/unbind — отвязать группу',
    kk: '/unbind — топты ажырату',
  },
  cmdUnlink: {
    en: '/unlink — disconnect this Telegram',
    ru: '/unlink — отключить Telegram от аккаунта',
    kk: '/unlink — Telegram-ды аккаунттан ажырату',
  },
} as const;

type StringKey = keyof typeof STRINGS;

/**
 * Look up a translated string. If the key is missing for the requested lang
 * (shouldn't happen at runtime but defensive code) we fall back to English so
 * the user gets *something* rather than a confused empty message.
 *
 * `vars` substitutes `{key}` placeholders — call sites stay terse.
 */
export function t(key: StringKey, lang: BotLang, vars?: Record<string, string | number>): string {
  const table = STRINGS[key];
  let text = (table as any)[lang] ?? (table as any).en;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

/** Normalise any free-form locale string into our 3-language set. */
export function normaliseLang(raw: string | null | undefined): BotLang {
  const s = (raw ?? 'en').toLowerCase();
  if (s.startsWith('ru')) return 'ru';
  if (s.startsWith('kk') || s.startsWith('kz')) return 'kk';
  return 'en';
}

export const BOT_LANGS: ReadonlyArray<{ code: BotLang; label: string }> = [
  { code: 'en', label: '🇬🇧 English' },
  { code: 'ru', label: '🇷🇺 Русский' },
  { code: 'kk', label: '🇰🇿 Қазақша' },
];
