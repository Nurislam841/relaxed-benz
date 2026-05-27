import { Injectable, Logger, OnModuleInit, Optional, forwardRef, Inject } from '@nestjs/common';
import type { Context } from 'grammy';
import { InlineKeyboard, InputFile } from 'grammy';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ScheduleService } from '../schedule/schedule.service';
import { GradesService } from '../grades/grades.service';
import { AssignmentsService } from '../assignments/assignments.service';
import { KahootService } from '../kahoot/kahoot.service';
import { StorageService } from '../storage/storage.service';
import { getBackendPublicUrl, getFrontendUrl, getUserFacingBaseUrl } from '../common/public-url';
import { t, normaliseLang, BOT_LANGS, type BotLang } from './bot-i18n';

/**
 * Inbound message router for the bot.
 *
 * This is the single place where slash commands, callback queries and
 * `poll_answer` events are wired up to backend services. We keep handler
 * functions small and delegate everything heavy to the existing services
 * (Grades, Schedule, AI, etc.) — that way the bot stays a thin presentation
 * layer over the same domain logic the web app uses.
 *
 * Architectural notes:
 *  - We deliberately don't use NestJS DI to register grammY handlers (no
 *    decorator magic): everything wires up in `onModuleInit()` for clarity.
 *  - Inbound user → backend user resolution is done by chat_id lookup
 *    on `User.telegramChatId`. If the user isn't linked, we nudge them to
 *    /start instead of failing silently.
 *  - Photo-submission state (Phase 4.3) and AI ambient-chat state (Phase 3)
 *    are kept in process-local maps. That's fine for a single-instance
 *    deploy; multi-replica would need Redis but we're not there yet.
 */
@Injectable()
export class TelegramUpdatesService implements OnModuleInit {
  private readonly logger = new Logger(TelegramUpdatesService.name);

  /**
   * In-memory state for the "user typed /submit, now waiting for photo" flow
   * (Phase 4.3). Cleared after one upload or 10 minutes, whichever comes first.
   */
  private readonly submitWaiters = new Map<string, { assignmentId: string; expiresAt: number }>();

  constructor(
    private readonly tg: TelegramService,
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
    @Optional() @Inject(forwardRef(() => AiService)) private readonly ai: AiService,
    @Optional() private readonly schedule: ScheduleService,
    @Optional() private readonly grades: GradesService,
    @Optional() @Inject(forwardRef(() => AssignmentsService)) private readonly assignments: AssignmentsService,
    @Optional() @Inject(forwardRef(() => KahootService)) private readonly kahoot: KahootService,
  ) {}

  async onModuleInit() {
    const bot = this.tg.bot;
    if (!bot) return; // graceful no-op when token missing

    // Tests don't exercise inbound flows and would conflict with the real
    // bot if TELEGRAM_BOT_TOKEN is set in the environment.
    if (process.env.JEST_WORKER_ID) return;

    // ── Slash commands ────────────────────────────────────────────────────
    bot.command('start', (ctx) => this.handleStart(ctx));
    bot.command('link', (ctx) => this.handleLink(ctx));
    bot.command('help', (ctx) => this.handleHelp(ctx));
    bot.command('today', (ctx) => this.handleToday(ctx));
    bot.command('schedule', (ctx) => this.handleSchedule(ctx));
    bot.command('grades', (ctx) => this.handleGrades(ctx));
    bot.command('upcoming', (ctx) => this.handleUpcoming(ctx));
    bot.command('ask', (ctx) => this.handleAsk(ctx));
    bot.command('coach', (ctx) => this.handleCoach(ctx));
    bot.command('unlink', (ctx) => this.handleUnlink(ctx));
    bot.command('app', (ctx) => this.handleApp(ctx)); // Phase 4.1 Mini App
    bot.command('join', (ctx) => this.handleJoin(ctx)); // Phase 2.2 Kahoot
    bot.command('submit', (ctx) => this.handleSubmit(ctx)); // Phase 4.3
    bot.command('bind', (ctx) => this.handleBind(ctx)); // Phase 4.2 group binding
    bot.command('unbind', (ctx) => this.handleUnbind(ctx));
    bot.command('at_risk', (ctx) => this.handleAtRisk(ctx)); // Phase 2.3 teacher
    bot.command('today_attendance', (ctx) => this.handleTodayAttendance(ctx));

    // ── Callback queries (inline-button taps) ────────────────────────────
    bot.on('callback_query:data', (ctx) => this.handleCallback(ctx));

    // ── Poll answers (native quiz answers, Phase 2.1 + 2.2) ──────────────
    bot.on('poll_answer', (ctx) => this.handlePollAnswer(ctx));

    // ── Photo / document uploads (Phase 4.3) ──────────────────────────────
    bot.on('message:photo', (ctx) => this.handlePhoto(ctx));
    bot.on('message:document', (ctx) => this.handleDocument(ctx));

    // ── Free-text (AI ambient mode, Phase 3.3) ────────────────────────────
    // Lowest priority — runs only if no command above matched.
    bot.on('message:text', (ctx) => this.handleAmbientText(ctx));

    // Clear the global default command menu. We use per-chat scopes
    // (setChatCommands below) to drive the UX:
    //   - Brand-new chat → no commands → Telegram shows only the big "Start"
    //     button. Cleanest first-impression.
    //   - After /start + language pick → scoped to {help, link}.
    //   - After successful /link → scoped to the full feature set.
    // Without this delete, the global menu wins for fresh users and they see
    // every command available even before linking, which is what the user
    // wanted to avoid.
    await bot.api.deleteMyCommands().catch((e) => this.logger.warn(`deleteMyCommands failed: ${e}`));

    // Global error handler — without this, ANY handler throw crashes the
    // polling loop entirely (grammY default behaviour). Most likely cause
    // of a throw is a Telegram API rejection (bad URL, blocked by user,
    // chat not found, etc.). Log it and move on.
    bot.catch((err) => {
      const ctx = err.ctx;
      this.logger.error(`Telegram handler error in update ${ctx?.update?.update_id}: ${err.error}`);
    });

    this.logger.log('Telegram inbound handlers registered');
  }

  /**
   * Resolve a Telegram user → backend User by chat_id. Returns null if not
   * linked — callers should prompt the user to `/start` first.
   */
  private async findLinkedUser(ctx: Context) {
    if (!ctx.from) return null;
    return this.db.user.findFirst({
      where: { telegramChatId: String(ctx.from.id), deletedAt: null },
    });
  }

  /**
   * Pick the right language for replies:
   *  - Linked user → their `preferredLang` (set via web Profile + bot)
   *  - Unlinked user → choice they made via /start language picker
   *  - Otherwise → fall back to Telegram's `from.language_code` (the user's
   *    Telegram-account locale) so first-contact /start at least lands close
   *    to their language before they pick explicitly.
   */
  private getLang(ctx: Context, linkedUser?: { preferredLang: string | null } | null): BotLang {
    if (linkedUser?.preferredLang) return normaliseLang(linkedUser.preferredLang);
    if (ctx.from) {
      const memLang = this.tg.getUnlinkedLang(ctx.from.id);
      if (memLang) return normaliseLang(memLang);
    }
    return normaliseLang(ctx.from?.language_code ?? 'en');
  }

  /**
   * Empty the compose-menu for a specific chat. Used at state-0 boundaries
   * (`/start` before language pick, `/unlink` reset) so the user sees only
   * the inline buttons we send — no stale commands lingering from a prior
   * session.
   */
  private async clearChatCommands(chatId: number | string) {
    const bot = this.tg.bot;
    if (!bot) return;
    await bot.api
      .deleteMyCommands({ scope: { type: 'chat', chat_id: Number(chatId) } })
      .catch((e) => this.logger.warn(`deleteMyCommands (chat=${chatId}) failed: ${e?.message ?? e}`));
  }

  /**
   * Limit the Telegram chat's compose-menu commands to whichever set is
   * appropriate for this user. Before linking they should only see /link;
   * after linking the full command list (minus /link). We use Telegram's
   * `scope: { type: 'chat', chat_id }` which targets a single chat.
   *
   * Failures are logged but never thrown — a stale menu is cosmetic, not
   * an outage.
   */
  private async setChatCommands(chatId: number | string, mode: 'unlinked' | 'linked', lang: BotLang) {
    const bot = this.tg.bot;
    if (!bot) return;
    const cmds =
      mode === 'unlinked'
        ? [
            // Order matters — Telegram renders the compose menu top-down in
            // the order we hand it. User asked for [help, link] so /help is
            // visible above /link even when they don't have a code yet.
            { command: 'help', description: 'Help' },
            { command: 'link', description: 'Connect your UniLMS account — /link 123456' },
          ]
        : [
            { command: 'today', description: t('cmdToday', lang).slice(2, 64) },
            { command: 'schedule', description: t('cmdSchedule', lang).slice(2, 64) },
            { command: 'grades', description: t('cmdGrades', lang).slice(2, 64) },
            { command: 'upcoming', description: t('cmdUpcoming', lang).slice(2, 64) },
            { command: 'ask', description: t('cmdAsk', lang).slice(2, 64) },
            { command: 'coach', description: t('cmdCoach', lang).slice(2, 64) },
            { command: 'join', description: t('cmdJoin', lang).slice(2, 64) },
            { command: 'submit', description: t('cmdSubmit', lang).slice(2, 64) },
            { command: 'app', description: t('cmdApp', lang).slice(2, 64) },
            { command: 'help', description: 'Help' },
            { command: 'unlink', description: t('cmdUnlink', lang).slice(2, 64) },
          ];
    // Strip leading "/command — " prefixes if present (we sliced after "/")
    // to keep descriptions readable; the menu shows the command separately.
    const cleaned = cmds.map((c) => ({
      command: c.command,
      description: c.description.replace(/^[a-z_]+ — /, '').slice(0, 256),
    }));
    await bot.api
      .setMyCommands(cleaned, { scope: { type: 'chat', chat_id: Number(chatId) } })
      .catch((e) => this.logger.warn(`setMyCommands (chat=${chatId}) failed: ${e?.message ?? e}`));
  }

  // ─── /start [link_<token>] ──────────────────────────────────────────────

  private async handleStart(ctx: Context) {
    if (!ctx.from) return;
    const text = ctx.message?.text ?? '';
    const payload = text.split(' ').slice(1).join(' ').trim(); // /start <payload>

    // Numeric payload was historically used to auto-link via deep link, but
    // Telegram hides the payload in the chat UI — users saw "/start" and
    // got a "Linked!" reply without understanding why, then their manual
    // `/link <code>` attempt would fail because the code was already
    // consumed. Ignore numeric payloads here: the canonical linking path
    // is now the explicit `/link 123456` command after picking a language.

    // Legacy: JWT-based payload `link_<jwt>` from earlier versions. Keep
    // supported in case a stale frontend tab generates one.
    if (payload.startsWith('link_')) {
      const token = payload.slice('link_'.length);
      try {
        const decoded = await this.jwt.verifyAsync<{ sub: string }>(token, {
          secret: process.env.TELEGRAM_LINK_SECRET || process.env.JWT_SECRET || 'change-me',
        });
        await this.db.user.update({
          where: { id: decoded.sub },
          data: { telegramChatId: String(ctx.from.id) },
        });
        const u = await this.findLinkedUser(ctx);
        const lang = this.getLang(ctx, u);
        await this.setChatCommands(ctx.from.id, 'linked', lang);
        await ctx.reply(t('linkSuccess', lang));
        return;
      } catch (e) {
        const lang = this.getLang(ctx);
        await ctx.reply(t('linkBadCode', lang));
        return;
      }
    }

    // Already linked → friendly welcome back + ensure their full menu is set.
    const linked = await this.findLinkedUser(ctx);
    if (linked) {
      const lang = this.getLang(ctx, linked);
      await this.setChatCommands(ctx.from.id, 'linked', lang);
      await ctx.reply(t('welcomeBack', lang, { name: linked.fullName }));
      return;
    }

    // State 1 (language picker): strict empty compose-menu. If the user
    // had commands from a prior session (e.g. they /unlinked + /start'ed
    // again), Telegram would still serve the stale scoped commands. Wipe
    // them so the user sees only the inline language buttons.
    await this.clearChatCommands(ctx.from.id);

    // First contact with bot. Show the language picker so all subsequent
    // prompts (especially the "send /link 123456" instruction) come in
    // the user's language.
    const kb = new InlineKeyboard();
    BOT_LANGS.forEach((l, i) => {
      kb.text(l.label, `lang:${l.code}`);
      // Wrap to a new row every 2 buttons so the picker looks balanced.
      if (i % 2 === 1) kb.row();
    });
    const initialLang = this.getLang(ctx);
    await ctx.reply(t('pickLanguage', initialLang), { reply_markup: kb });
  }

  /** Inline callback: `lang:en` / `lang:ru` / `lang:kk` */
  private async handleLanguageCallback(ctx: Context, code: string) {
    if (!ctx.from) return;
    const lang = normaliseLang(code);
    // Persist choice. Linked users → User.preferredLang; otherwise →
    // unlinkedLangs in-memory until they actually link.
    const linked = await this.findLinkedUser(ctx);
    if (linked) {
      await this.db.user.update({ where: { id: linked.id }, data: { preferredLang: lang } });
    } else {
      this.tg.setUnlinkedLang(ctx.from.id, lang);
    }
    // Lock the compose menu to just /link + /help until they finish linking
    // (linked users get the full menu refreshed in their new language).
    await this.setChatCommands(ctx.from.id, linked ? 'linked' : 'unlinked', lang);
    await ctx.answerCallbackQuery({ text: t('languageSet', lang).slice(0, 200) }).catch(() => undefined);
    await ctx.reply(t('languageSet', lang));
    if (!linked) {
      await ctx.reply(t('promptCode', lang));
    } else {
      await ctx.reply(t('welcomeBack', lang, { name: linked.fullName }));
    }
  }

  // ─── /link <code> — the always-works fallback linking path ──────────────
  //
  // Why this exists: Telegram only forwards the `?start=<payload>` deep-link
  // payload when the user opens a chat with the bot for the *first* time.
  // Anyone who has tapped Start before (most users on second linking attempt,
  // or anyone who interacted with the bot at all) gets a payload-less /start.
  // The web app's "Connect" button gives the user a 6-digit code to paste
  // here so the linking succeeds regardless of chat history.

  private async handleLink(ctx: Context) {
    const lang = this.getLang(ctx);
    const code = ctx.message?.text?.split(/\s+/)[1];
    if (!code || !/^\d{6}$/.test(code)) {
      await ctx.reply(t('linkUsage', lang));
      return;
    }
    await this.linkByCode(ctx, code);
  }

  /** Shared linking helper for `/start <code>` and `/link <code>`. */
  private async linkByCode(ctx: Context, code: string) {
    if (!ctx.from) return;
    const lang = this.getLang(ctx);
    const userId = this.tg.consumeLinkCode(code);
    if (!userId) {
      await ctx.reply(t('linkBadCode', lang));
      return;
    }
    try {
      // Promote the user's previously-chosen language (from the /start
      // picker) into their persistent User.preferredLang. This way all
      // future replies — including ones from web-app-triggered notifications
      // — pick up their choice.
      const memLang = this.tg.getUnlinkedLang(ctx.from.id);
      await this.db.user.update({
        where: { id: userId },
        data: {
          telegramChatId: String(ctx.from.id),
          ...(memLang ? { preferredLang: memLang } : {}),
        },
      });
      this.tg.clearUnlinkedLang(ctx.from.id);
      // Refresh the compose menu to the full command list (minus /link)
      // so the user sees /today, /grades, etc. as soon as they're linked.
      const finalLang = normaliseLang(memLang ?? lang);
      await this.setChatCommands(ctx.from.id, 'linked', finalLang);
      await ctx.reply(t('linkSuccess', finalLang));
    } catch (e: any) {
      this.logger.warn(`linkByCode failed for user ${userId}: ${e?.message ?? e}`);
      await ctx.reply(t('linkBadCode', lang));
    }
  }

  // ─── /help ──────────────────────────────────────────────────────────────

  private async handleHelp(ctx: Context) {
    // Plain text (no MarkdownV2 escape gotchas with parentheses / dashes).
    const linked = await this.findLinkedUser(ctx);
    const lang = this.getLang(ctx, linked);
    const lines = [
      t('helpTitle', lang),
      '',
      t('helpStudentsHeader', lang),
      t('cmdToday', lang),
      t('cmdSchedule', lang),
      t('cmdGrades', lang),
      t('cmdUpcoming', lang),
      t('cmdAsk', lang),
      t('cmdCoach', lang),
      t('cmdJoin', lang),
      t('cmdSubmit', lang),
      t('cmdApp', lang),
      '',
      t('helpTeachersHeader', lang),
      t('cmdAtRisk', lang),
      t('cmdAttendance', lang),
      t('cmdBind', lang),
      t('cmdUnbind', lang),
      '',
      t('helpOtherHeader', lang),
    ];
    // Only show /link in help if the user is NOT linked. After linking the
    // command isn't useful to them and would just look like noise.
    if (!linked) {
      lines.push(t('linkUsage', lang).split('\n')[0]); // "Usage: /link 123456"
    }
    lines.push(t('cmdUnlink', lang));
    await ctx.reply(lines.join('\n'));
  }

  // ─── /today ─────────────────────────────────────────────────────────────

  private async handleToday(ctx: Context) {
    const user = await this.findLinkedUser(ctx);
    if (!user) return ctx.reply(t('notLinked', this.getLang(ctx)));
    if (!this.schedule) return ctx.reply('Schedule unavailable right now.');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    const items = await this.schedule.getMySchedule(
      { id: user.id, role: user.role, groupId: user.groupId },
      startOfDay.toISOString(),
      endOfDay.toISOString(),
    );

    if (items.length === 0) {
      await ctx.reply('🎉 No classes today.');
      return;
    }

    const lines = items.map((s: any) => {
      const start = new Date(s.startsAt);
      const end = new Date(s.endsAt);
      const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `🕐 *${hhmm(start)}–${hhmm(end)}* · ${s.course?.title ?? 'Course'} · ${s.room ?? ''}`;
    });
    await ctx.reply(`*Today's schedule*\n\n${lines.join('\n')}`);
  }

  // ─── /schedule (week ahead) ─────────────────────────────────────────────

  private async handleSchedule(ctx: Context) {
    const user = await this.findLinkedUser(ctx);
    if (!user) return ctx.reply(t('notLinked', this.getLang(ctx)));
    if (!this.schedule) return ctx.reply('Schedule unavailable.');

    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const items = await this.schedule.getMySchedule(
      { id: user.id, role: user.role, groupId: user.groupId },
      now.toISOString(),
      weekAhead.toISOString(),
    );
    if (items.length === 0) {
      await ctx.reply('📅 No classes in the next 7 days.');
      return;
    }

    const byDay = new Map<string, string[]>();
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    items.forEach((s: any) => {
      const d = new Date(s.startsAt);
      const key = `${weekday[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
      const hhmm = (dd: Date) =>
        `${String(dd.getHours()).padStart(2, '0')}:${String(dd.getMinutes()).padStart(2, '0')}`;
      const line = `  ${hhmm(d)} · ${s.course?.title ?? 'Course'} · ${s.room ?? ''}`;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(line);
    });
    const text = [
      '*Week ahead*',
      '',
      ...Array.from(byDay.entries()).flatMap(([day, lines]) => [`*${day}*`, ...lines]),
    ].join('\n');
    await ctx.reply(text.replace(/\\\*/g, '*'), {});
  }

  // ─── /grades ────────────────────────────────────────────────────────────

  private async handleGrades(ctx: Context) {
    const user = await this.findLinkedUser(ctx);
    if (!user) return ctx.reply(t('notLinked', this.getLang(ctx)));
    if (!this.grades) return ctx.reply('Grades unavailable.');

    const list = await this.grades.getMyGrades(user.id);
    if (list.length === 0) {
      await ctx.reply('No grades yet — once your work is graded it will show up here.');
      return;
    }
    const top = list.slice(0, 5);
    const lines = top.map((g: any) => {
      const a = g.submission?.assignment;
      const max = a?.maxScore ?? 100;
      const pct = Math.round((g.score / max) * 100);
      return `📊 *${pct}%* (${g.score}/${max}) — ${a?.title ?? '?'} · ${a?.course?.title ?? ''}`;
    });
    await ctx.reply(`*Latest grades*\n\n${lines.join('\n')}`);
  }

  // ─── /upcoming (assignments due this week) ──────────────────────────────

  private async handleUpcoming(ctx: Context) {
    const user = await this.findLinkedUser(ctx);
    if (!user) return ctx.reply(t('notLinked', this.getLang(ctx)));

    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    // Pull assignments from courses the user is enrolled in, due in the next 7 days.
    const courseIds = (
      await this.db.enrollment.findMany({
        where: { userId: user.id },
        select: { courseId: true },
      })
    ).map((e) => e.courseId);

    const list = await this.db.assignment.findMany({
      where: {
        courseId: { in: courseIds },
        dueAt: { gte: now, lte: weekAhead },
      },
      orderBy: { dueAt: 'asc' },
      include: { course: { select: { title: true, code: true } } },
    });

    if (list.length === 0) {
      await ctx.reply('🎉 No assignments due in the next 7 days.');
      return;
    }
    const lines = list.map((a: any) => {
      const due = new Date(a.dueAt);
      const hhmm = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
      const date = `${due.getDate()}/${due.getMonth() + 1} ${hhmm}`;
      return `📝 *${date}* — ${a.title} · ${a.course?.title ?? ''}`;
    });
    await ctx.reply(`*Upcoming assignments*\n\n${lines.join('\n')}`);
  }

  // ─── /ask <question> ────────────────────────────────────────────────────

  private async handleAsk(ctx: Context) {
    const user = await this.findLinkedUser(ctx);
    if (!user) return ctx.reply(t('notLinked', this.getLang(ctx)));
    if (!this.ai) return ctx.reply('AI unavailable.');

    const text = ctx.message?.text ?? '';
    const question = text.split(' ').slice(1).join(' ').trim();
    if (!question) {
      await ctx.reply('Usage: `/ask <your question>`');
      return;
    }
    await this.streamAiResponse(ctx, user.id, question);
  }

  /**
   * Stream an AI chat response into a single message that we keep editing as
   * chunks arrive. Telegram caps edit frequency around 1 per second per
   * message — we throttle to ~700ms and always send a final flush.
   */
  private async streamAiResponse(ctx: Context, userId: string, question: string) {
    if (!ctx.chat) return;
    const sent = await ctx.reply('🤖 _Thinking…_');
    if (!sent) return;
    let acc = '';
    let lastEdit = Date.now();

    try {
      for await (const chunk of this.ai!.chatStream(question, userId)) {
        acc += chunk;
        if (Date.now() - lastEdit > 700) {
          lastEdit = Date.now();
          await ctx.api.editMessageText(ctx.chat.id, sent.message_id, acc).catch(() => undefined);
        }
      }
    } catch (e) {
      this.logger.warn(`AI stream failed: ${e}`);
    }
    // Final flush — even if last chunk arrived inside the throttle window.
    await ctx.api.editMessageText(ctx.chat.id, sent.message_id, acc || '(no response)').catch(() => undefined);
  }

  // ─── /coach ─────────────────────────────────────────────────────────────

  private async handleCoach(ctx: Context) {
    const user = await this.findLinkedUser(ctx);
    if (!user) return ctx.reply(t('notLinked', this.getLang(ctx)));
    if (!this.ai) return ctx.reply('AI unavailable.');

    await ctx.reply('🎓 Generating your study coach report — this takes ~10s…');
    try {
      const coach = await this.ai.getStudyCoach({}, user.id, user.role);
      const t = coach.trajectory;
      const lines = [
        '*🎓 AI Study Coach*',
        '',
        `*Current grade:* ${t.currentGrade}`,
        `*Predicted final:* ${t.predictedFinalGrade}`,
        `*Trend:* ${t.trend}`,
        `*To get an A:* ${t.requirementForA}`,
        '',
        '*Weaknesses*',
        ...coach.weaknesses.slice(0, 3).map((w: any) => `• ${w.topic} — _${w.severity}_`),
        '',
        '*Next 3 days*',
        ...coach.studyPlan.slice(0, 3).map((p: any) => `Day ${p.day} — ${p.focus} (${p.estimatedMinutes} min)`),
      ];
      await ctx.reply(lines.join('\n'));
    } catch (e) {
      await ctx.reply('❌ Could not generate coach report right now.');
    }
  }

  // ─── /unlink ────────────────────────────────────────────────────────────

  private async handleUnlink(ctx: Context) {
    const user = await this.findLinkedUser(ctx);
    const lang = this.getLang(ctx, user);
    if (!user) return ctx.reply(t('unlinkAlready', lang));
    await this.db.user.update({ where: { id: user.id }, data: { telegramChatId: null } });
    // Per user request: /unlink should send the user all the way back to
    // state 0 (empty compose menu, must /start again). Clear the per-chat
    // commands AND the unlinked-lang memory so the next /start shows the
    // language picker exactly like first-time use.
    if (ctx.from) {
      this.tg.clearUnlinkedLang(ctx.from.id);
      await this.clearChatCommands(ctx.from.id);
    }
    await ctx.reply(t('unlinked', lang));
  }

  // ─── /app (Phase 4.1 Mini App) ──────────────────────────────────────────

  private async handleApp(ctx: Context) {
    // Prefer the user-facing frontend URL for the Mini App; the Mini App is
    // the LMS itself, not the API. Falls back to BACKEND_PUBLIC_URL only if
    // someone deployed everything behind one host.
    const baseUrl = getUserFacingBaseUrl();
    // Telegram's WebApp button requires https. Skip the Mini App entirely
    // in local dev where we only have http://localhost — instead point the
    // user at the regular browser app.
    if (!baseUrl || !baseUrl.startsWith('https://')) {
      await ctx.reply(
        'Mini App requires HTTPS and is only available on the production deployment. ' +
          'Open UniLMS in your browser instead.',
      );
      return;
    }
    const kb = new InlineKeyboard().webApp('🚀 Open UniLMS', `${baseUrl}/?tg=1`);
    await ctx.reply('Tap to open UniLMS inside Telegram:', { reply_markup: kb });
  }

  // ─── /join CODE (Phase 2.2 — handled in kahoot bridge service) ─────────

  private async handleJoin(ctx: Context) {
    const user = await this.findLinkedUser(ctx);
    if (!user) return ctx.reply(t('notLinked', this.getLang(ctx)));
    if (!this.kahoot) return ctx.reply('Kahoot unavailable.');

    const text = ctx.message?.text ?? '';
    const code = text.split(' ').slice(1).join(' ').trim().toUpperCase();
    if (!code) {
      await ctx.reply('Usage: `/join CODE`');
      return;
    }
    try {
      const session = await this.kahoot.joinByCode(code, { id: user.id, role: user.role });
      // Persist subscription so the gateway hook can fan-out polls to this chat.
      // The KahootTelegramSubscription table is created in Phase 2.2 migration.
      await (this.db as any).kahootTelegramSubscription
        .upsert({
          where: { sessionId_chatId: { sessionId: session.sessionId, chatId: String(ctx.from!.id) } },
          create: {
            sessionId: session.sessionId,
            userId: user.id,
            chatId: String(ctx.from!.id),
          },
          update: { userId: user.id },
        })
        .catch(() => undefined); // table may not exist yet during migration
      await ctx.reply(`✅ Joined "${session.quizTitle}" lobby\\. Wait for the host to start\\.`, {});
    } catch (e: any) {
      await ctx.reply(`❌ ${e?.message || 'Could not join'}`);
    }
  }

  // ─── /submit (Phase 4.3) ────────────────────────────────────────────────

  private async handleSubmit(ctx: Context) {
    const user = await this.findLinkedUser(ctx);
    if (!user) return ctx.reply(t('notLinked', this.getLang(ctx)));
    const text = ctx.message?.text ?? '';
    const assignmentId = text.split(' ').slice(1).join(' ').trim();
    if (!assignmentId) {
      await ctx.reply('Usage: `/submit <assignmentId>` then send a photo or PDF', {});
      return;
    }
    const assignment = await this.db.assignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, title: true, courseId: true },
    });
    if (!assignment) {
      await ctx.reply('❌ Assignment not found.');
      return;
    }
    // Confirm enrolment so a student can't submit to another course's
    // assignment. Teachers/admins can attach files via the web anyway.
    const enrolled = await this.db.enrollment.findFirst({
      where: { userId: user.id, courseId: assignment.courseId },
    });
    if (!enrolled) {
      await ctx.reply('❌ You are not enrolled in this course.');
      return;
    }

    this.submitWaiters.set(String(ctx.from!.id), {
      assignmentId: assignment.id,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    await ctx.reply(`📎 Ready to submit "${assignment.title}". Send a photo or PDF now (you have 10 min).`);
  }

  private async handlePhoto(ctx: Context) {
    if (!ctx.from || !ctx.message?.photo) return;
    const waiter = this.submitWaiters.get(String(ctx.from.id));
    if (!waiter || waiter.expiresAt < Date.now()) return; // not in /submit flow

    const user = await this.findLinkedUser(ctx);
    if (!user) return;

    // Telegram serves multiple photo sizes — pick the largest.
    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1];
    const downloaded = await this.tg.downloadFile(largest.file_id);
    if (!downloaded) {
      await ctx.reply('❌ Could not download the photo. Try again.');
      return;
    }
    await this.finalizeSubmission(ctx, user.id, waiter.assignmentId, downloaded);
  }

  private async handleDocument(ctx: Context) {
    if (!ctx.from || !ctx.message?.document) return;
    const waiter = this.submitWaiters.get(String(ctx.from.id));
    if (!waiter || waiter.expiresAt < Date.now()) return;

    const user = await this.findLinkedUser(ctx);
    if (!user) return;

    const doc = ctx.message.document;
    // Whitelist to common assignment types — block executables etc.
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'];
    if (doc.mime_type && !allowed.includes(doc.mime_type)) {
      await ctx.reply(`❌ Unsupported file type: ${doc.mime_type}`);
      return;
    }
    const downloaded = await this.tg.downloadFile(doc.file_id);
    if (!downloaded) {
      await ctx.reply('❌ Could not download the file.');
      return;
    }
    // Prefer the user-supplied filename + MIME when available — looks nicer in
    // teacher UI than `1234567890-abc.pdf`.
    if (doc.file_name) downloaded.fileName = doc.file_name;
    if (doc.mime_type) downloaded.mimeType = doc.mime_type;
    await this.finalizeSubmission(ctx, user.id, waiter.assignmentId, downloaded);
  }

  private async finalizeSubmission(
    ctx: Context,
    userId: string,
    assignmentId: string,
    file: { buffer: Buffer; mimeType: string; fileName: string },
  ) {
    if (!this.assignments) return;
    try {
      await this.assignments.submitFromBuffer(assignmentId, userId, file.buffer, file.fileName, file.mimeType);
      this.submitWaiters.delete(String(ctx.from!.id));
      await ctx.reply('✅ Submitted! Your teacher will see it shortly.');
    } catch (e: any) {
      await ctx.reply(`❌ Submission failed: ${e?.message || 'unknown error'}`);
    }
  }

  // ─── /bind (Phase 4.2 group binding) ───────────────────────────────────

  private async handleBind(ctx: Context) {
    if (!ctx.chat || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
      await ctx.reply('This command only works inside a group chat.');
      return;
    }
    const user = await this.findLinkedUser(ctx);
    if (!user) return ctx.reply('Please /start in a DM with me first to link your account.');
    if (user.role !== Role.TEACHER && user.role !== Role.ADMIN) {
      await ctx.reply('Only teachers/admins can bind a course to a group.');
      return;
    }
    const text = ctx.message?.text ?? '';
    const code = text.split(' ').slice(1).join(' ').trim();
    if (!code) {
      await ctx.reply('Usage: `/bind <courseCode>` (e.g. /bind CS101)');
      return;
    }
    const course = await this.db.course.findFirst({ where: { code: { equals: code, mode: 'insensitive' } } });
    if (!course) {
      await ctx.reply(`❌ No course with code "${code}"`);
      return;
    }
    await (this.db as any).courseTelegramGroup
      .upsert({
        where: { courseId: course.id },
        create: { courseId: course.id, chatId: String(ctx.chat.id), boundById: user.id },
        update: { chatId: String(ctx.chat.id), boundById: user.id, boundAt: new Date() },
      })
      .catch((e: any) => this.logger.warn(`bind failed: ${e}`));
    await ctx.reply(`✅ This group is now bound to ${course.code} — ${course.title}.`);
  }

  private async handleUnbind(ctx: Context) {
    if (!ctx.chat || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
      await ctx.reply('This command only works inside a group chat.');
      return;
    }
    await (this.db as any).courseTelegramGroup
      .deleteMany({ where: { chatId: String(ctx.chat.id) } })
      .catch(() => undefined);
    await ctx.reply('🔌 Group unbound from all courses.');
  }

  // ─── /at_risk / /today_attendance (Phase 2.3 teacher dashboard) ─────────

  private async handleAtRisk(ctx: Context) {
    const user = await this.findLinkedUser(ctx);
    if (!user) return ctx.reply(t('notLinked', this.getLang(ctx)));
    if (user.role !== Role.TEACHER && user.role !== Role.ADMIN) {
      await ctx.reply('Teachers/admins only.');
      return;
    }
    const text = ctx.message?.text ?? '';
    const code = text.split(' ').slice(1).join(' ').trim();
    if (!code) return ctx.reply('Usage: `/at_risk <courseCode>`');

    const course = await this.db.course.findFirst({ where: { code: { equals: code, mode: 'insensitive' } } });
    if (!course) return ctx.reply(`❌ Course "${code}" not found.`);
    if (!this.ai) return ctx.reply('AI unavailable.');

    await ctx.reply('🤖 Generating class insights — ~10s…');
    try {
      const insights = await this.ai.getClassInsights({ courseId: course.id }, user.id, user.role);
      const lines = [
        `*At-risk students in ${course.code}*`,
        '',
        ...insights.atRiskStudents.slice(0, 10).map((s: any) => `⚠️ ${s.fullName} — ${s.reason ?? ''}`),
      ];
      if (insights.atRiskStudents.length === 0) {
        lines.push('🎉 Nobody is currently at risk.');
      }
      await ctx.reply(lines.join('\n'));
    } catch (e) {
      await ctx.reply('❌ Could not load insights.');
    }
  }

  private async handleTodayAttendance(ctx: Context) {
    const user = await this.findLinkedUser(ctx);
    if (!user) return ctx.reply(t('notLinked', this.getLang(ctx)));
    if (user.role !== Role.TEACHER && user.role !== Role.ADMIN) {
      await ctx.reply('Teachers/admins only.');
      return;
    }
    const text = ctx.message?.text ?? '';
    const code = text.split(' ').slice(1).join(' ').trim();
    if (!code) return ctx.reply('Usage: `/today_attendance <courseCode>`');

    const course = await this.db.course.findFirst({ where: { code: { equals: code, mode: 'insensitive' } } });
    if (!course) return ctx.reply(`❌ Course "${code}" not found.`);

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const records = await this.db.attendance.findMany({
      where: { courseId: course.id, date: { gte: startOfDay, lt: endOfDay } },
    });
    const enrollCount = await this.db.enrollment.count({
      where: { courseId: course.id, roleInCourse: 'STUDENT' },
    });
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;
    const pct = enrollCount > 0 ? Math.round((present / enrollCount) * 100) : 0;
    await ctx.reply(
      `*Today's attendance — ${course.code}*\n\n` +
        `✅ Present: ${present}\n❌ Absent: ${absent}\n⏰ Late: ${late}\n_${pct}% of ${enrollCount} students_`,
      {},
    );
  }

  // ─── Callback queries (inline-button taps) ──────────────────────────────

  private async handleCallback(ctx: Context) {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    // lang:<en|ru|kk> — from the /start language picker.
    if (data.startsWith('lang:')) {
      await this.handleLanguageCallback(ctx, data.slice('lang:'.length));
      return;
    }

    // markread:<notificationId> — flips Notification.isRead to true.
    if (data.startsWith('markread:')) {
      const id = data.slice('markread:'.length);
      await this.db.notification.update({ where: { id }, data: { isRead: true } }).catch(() => undefined);
      await ctx.answerCallbackQuery({ text: '✓ Marked as read' });
      return;
    }

    // aifeedback:<submissionId> — fire AI assignment feedback and reply.
    if (data.startsWith('aifeedback:')) {
      const submissionId = data.slice('aifeedback:'.length);
      const user = await this.findLinkedUser(ctx);
      if (!user) {
        await ctx.answerCallbackQuery({ text: 'Please /start first', show_alert: true });
        return;
      }
      await ctx.answerCallbackQuery({ text: '🤖 Generating feedback…' });
      try {
        if (!this.ai) throw new Error('AI unavailable');
        // AssignmentFeedbackDto needs both ids — fetch the submission so we
        // can supply assignmentId without making the caller pass it twice.
        const submission = await this.db.submission.findUnique({
          where: { id: submissionId },
          select: { assignmentId: true },
        });
        if (!submission) throw new Error('Submission not found');
        const fb = await this.ai.getAssignmentFeedback(
          { submissionId, assignmentId: submission.assignmentId },
          user.id,
          user.role,
        );
        const lines = [
          '*🤖 AI feedback*',
          '',
          `*Assessment:* ${fb.assessment}`,
          '',
          '*Strengths*',
          ...fb.strengths.slice(0, 3).map((s: string) => `✅ ${s}`),
          '',
          '*Improvements*',
          ...fb.improvements.slice(0, 3).map((s: string) => `🔧 ${s}`),
        ];
        if (ctx.chat) await ctx.api.sendMessage(ctx.chat.id, lines.join('\n'));
      } catch (e) {
        if (ctx.chat) await ctx.api.sendMessage(ctx.chat.id, '❌ Could not generate feedback.');
      }
      return;
    }

    // kahplan:<sessionId> — generate AI personal plan for this user
    // based on their answers in the Kahoot session, send as a TG message.
    if (data.startsWith('kahplan:')) {
      const sessionId = data.slice('kahplan:'.length);
      const user = await this.findLinkedUser(ctx);
      if (!user) {
        await ctx.answerCallbackQuery({ text: 'Please /start first', show_alert: true });
        return;
      }
      await ctx.answerCallbackQuery({ text: '🧠 Thinking…' });
      try {
        if (!this.ai) throw new Error('AI unavailable');
        const plan = await this.ai.kahootInsights({ sessionId, scope: 'student', studentId: user.id } as any, {
          id: user.id,
          role: user.role,
        });
        const lines: string[] = ['*🧠 Your AI study plan*', '', plan.summary || '', ''];
        if (Array.isArray(plan.strengths) && plan.strengths.length) {
          lines.push('*Strengths*', ...plan.strengths.slice(0, 3).map((s: string) => `✅ ${s}`), '');
        }
        if (Array.isArray(plan.gaps) && plan.gaps.length) {
          lines.push('*Gaps to close*', ...plan.gaps.slice(0, 3).map((g: string) => `🔧 ${g}`), '');
        }
        if (plan.nextStep) lines.push('*Next step*', `➡️ ${plan.nextStep}`);
        if (ctx.chat) await ctx.api.sendMessage(ctx.chat.id, lines.join('\n'));
      } catch (e: any) {
        if (ctx.chat)
          await ctx.api.sendMessage(ctx.chat.id, `❌ Could not generate plan: ${e?.message ?? 'unknown error'}`);
      }
      return;
    }

    // kahmat:<sessionId> — stream the quiz's stored source-material file
    // (PDF/DOCX/etc) back to the student as a Telegram document. No-op
    // with a friendly message if the teacher never uploaded one.
    if (data.startsWith('kahmat:')) {
      const sessionId = data.slice('kahmat:'.length);
      const user = await this.findLinkedUser(ctx);
      if (!user) {
        await ctx.answerCallbackQuery({ text: 'Please /start first', show_alert: true });
        return;
      }
      await ctx.answerCallbackQuery({ text: '📚 Fetching material…' });
      try {
        const session = await this.db.quizSession.findUnique({
          where: { id: sessionId },
          select: {
            quiz: {
              select: {
                sourceMaterialKey: true,
                sourceMaterialFileName: true,
                sourceMaterialMime: true,
              },
            },
          },
        });
        const quiz = session?.quiz;
        if (!quiz?.sourceMaterialKey) {
          if (ctx.chat) {
            await ctx.api.sendMessage(ctx.chat.id, 'ℹ️ The teacher did not attach study material to this quiz.');
          }
          return;
        }
        const buffer = await this.storage.readKey(quiz.sourceMaterialKey);
        if (!buffer) {
          if (ctx.chat) await ctx.api.sendMessage(ctx.chat.id, '❌ Material file is missing on the server.');
          return;
        }
        if (ctx.chat) {
          await ctx.api.sendDocument(
            ctx.chat.id,
            new InputFile(buffer, quiz.sourceMaterialFileName ?? 'study-material'),
            { caption: '📚 Study this — same lecture the teacher used to build the quiz.' },
          );
        }
      } catch (e: any) {
        if (ctx.chat)
          await ctx.api.sendMessage(ctx.chat.id, `❌ Could not send material: ${e?.message ?? 'unknown error'}`);
      }
      return;
    }

    // Unknown callback — silently acknowledge so Telegram doesn't show "loading".
    await ctx.answerCallbackQuery();
  }

  // ─── Poll answers (Phase 2.1 / 2.2) ─────────────────────────────────────

  private async handlePollAnswer(ctx: Context) {
    const pa = ctx.pollAnswer;
    if (!pa || pa.option_ids.length === 0) return;
    const pickedIndex = pa.option_ids[0];
    const tgUserId = String(pa.user?.id);

    // Two record types may match this poll_id:
    //  (a) QuizTelegramPoll — broadcast quiz (Phase 2.1)
    //  (b) KahootTelegramPoll — live Kahoot session (Phase 2.2)
    // Both tables are created in their respective Prisma migrations.

    // (a) — async-lite scoring: create attempt + answer rows so the data
    // shows up in the same UI the web flow uses.
    const quizPoll = await (this.db as any).quizTelegramPoll
      ?.findUnique({ where: { pollId: pa.poll_id } })
      .catch(() => null);
    if (quizPoll) {
      const user = await this.db.user.findFirst({
        where: { telegramChatId: tgUserId, deletedAt: null },
      });
      if (user) {
        await (this.db as any).quizTelegramPoll
          .update({
            where: { pollId: pa.poll_id },
            data: { pickedIndex, answeredAt: new Date() },
          })
          .catch(() => undefined);
      }
      return;
    }

    // (b) — forward into the existing kahoot scoring path.
    const kahootPoll = await (this.db as any).kahootTelegramPoll
      ?.findUnique({ where: { pollId: pa.poll_id } })
      .catch(() => null);
    if (kahootPoll && this.kahoot) {
      const user = await this.db.user.findFirst({
        where: { telegramChatId: tgUserId, deletedAt: null },
      });
      if (user) {
        await this.kahoot
          .answer(
            kahootPoll.sessionId,
            {
              questionId: kahootPoll.questionId,
              pickedIndex,
              responseTimeMs: kahootPoll.openPeriodSeconds ? kahootPoll.openPeriodSeconds * 1000 : 5000,
            },
            { id: user.id, role: user.role },
          )
          .catch(() => undefined);
      }
    }
  }

  // ─── Free text → AI chat (Phase 3.3 — opt-in ambient mode) ──────────────

  private async handleAmbientText(ctx: Context) {
    const text = ctx.message?.text ?? '';
    // Skip slash commands — they're handled above.
    if (text.startsWith('/')) return;
    // Only in DMs — group chats stay quiet unless explicitly addressed.
    if (ctx.chat?.type !== 'private') return;

    const user = await this.findLinkedUser(ctx);
    if (!user) {
      await ctx.reply(t('notLinked', this.getLang(ctx)));
      return;
    }
    await this.streamAiResponse(ctx, user.id, text);
  }
}
