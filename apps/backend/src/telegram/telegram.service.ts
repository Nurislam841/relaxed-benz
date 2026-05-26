import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Bot, GrammyError, HttpError, InlineKeyboard } from 'grammy';
import type { InputFile } from 'grammy';

/**
 * Minimal token-bucket-ish concurrency limiter — keeps Telegram fan-outs
 * below ~25 calls/sec and ≤25 in flight. We rolled our own instead of using
 * `p-queue` (ESM-only since v9 → breaks Jest's CJS pipeline) and
 * `bottleneck` (~30KB of features we don't need). 30 lines is enough.
 */
class RateLimitedQueue {
  private inFlight = 0;
  private windowStart = Date.now();
  private windowCount = 0;
  private waiters: Array<() => void> = [];

  constructor(
    private readonly concurrency: number,
    private readonly intervalCap: number,
    private readonly intervalMs: number,
  ) {}

  async add<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      if (now - this.windowStart >= this.intervalMs) {
        this.windowStart = now;
        this.windowCount = 0;
      }
      if (this.inFlight < this.concurrency && this.windowCount < this.intervalCap) {
        this.inFlight++;
        this.windowCount++;
        return;
      }
      const waitMs =
        this.windowCount >= this.intervalCap ? Math.max(1, this.intervalMs - (now - this.windowStart)) : 25;
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, waitMs);
        this.waiters.push(() => {
          clearTimeout(t);
          resolve();
        });
      });
    }
  }

  private release() {
    this.inFlight--;
    const next = this.waiters.shift();
    if (next) next();
  }
}

/**
 * Telegram bot wrapper — now powered by **grammY** (the lightweight bot
 * framework). The old wrapper hand-rolled `fetch` calls; that worked for plain
 * `sendMessage` but became boilerplate-heavy once we added inline keyboards,
 * callback queries, polls, and multipart photo uploads (Phase 4.3). grammY
 * gives us a single `Bot` instance + a middleware router for inbound updates
 * (see [TelegramUpdatesService](./telegram-updates.service.ts)).
 *
 * Graceful no-op stays the same: when `TELEGRAM_BOT_TOKEN` is unset, every
 * outbound method returns false/no-op so the rest of the system keeps
 * working. This mirrors the LLM module's demo-mode behaviour.
 *
 * Rate limiting: Telegram caps bot sends at ~30 msg/sec globally. When we
 * fan-out a quiz to 50 students (Phase 2.1), naive parallel calls would
 * trip 429s. The internal `outboundQueue` (p-queue) caps concurrent sends so
 * broadcasts stay below the threshold.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string | undefined;
  private readonly _bot: Bot | null;
  /**
   * Outbound rate-limiter — every send goes through here. 25 concurrent / 25
   * per second gives us a 5/sec safety margin under Telegram's 30/sec global
   * cap, and works even when several broadcasts overlap.
   */
  private readonly outboundQueue = new RateLimitedQueue(25, 25, 1000);

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    if (!this.token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN not set — Telegram bot disabled. ' +
          'Set the env var with a bot token from @BotFather to enable.',
      );
      this._bot = null;
    } else {
      this._bot = new Bot(this.token);
    }
  }

  get isEnabled(): boolean {
    return !!this._bot;
  }

  // ─── Code-based linking (the bullet-proof linking path) ─────────────────
  //
  // Telegram only forwards a `?start=<payload>` deep-link payload on the
  // **first** /start of a fresh chat. Returning users (anyone who already
  // tapped Start once) lose the payload — Telegram just opens the chat.
  // To make linking reliable for those users, the frontend asks for a
  // short numeric code and the user pastes it into the bot as `/link 123456`.
  // The code is single-use, in-memory, expires in 5 minutes — no DB row
  // and no schema migration needed.
  private linkCodes = new Map<string, { userId: string; expiresAt: number }>();

  generateLinkCode(userId: string): string {
    // 6 random digits — plenty for ~5-min window. Collision odds in a
    // single-tenant deploy are negligible; if a collision happens we just
    // overwrite (the earlier code becomes invalid, which is fine — the
    // user who generated it can press Connect again).
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.linkCodes.set(code, { userId, expiresAt: Date.now() + 5 * 60 * 1000 });
    // Opportunistic cleanup of expired entries to keep the Map small.
    const now = Date.now();
    for (const [k, v] of this.linkCodes) if (v.expiresAt < now) this.linkCodes.delete(k);
    return code;
  }

  /**
   * Look up the userId tied to a code and remove the entry (one-shot).
   * Returns null if code is unknown or expired — callers should show a
   * friendly "code expired" message rather than leak existence.
   */
  consumeLinkCode(code: string): string | null {
    const entry = this.linkCodes.get(code);
    if (!entry) return null;
    this.linkCodes.delete(code);
    if (entry.expiresAt < Date.now()) return null;
    return entry.userId;
  }

  /**
   * Direct bot access for handler registration ([TelegramUpdatesService])
   * and for unusual flows that need raw `bot.api.*` calls. Returns null when
   * the bot isn't configured — callers MUST guard.
   */
  get bot(): Bot | null {
    return this._bot;
  }

  /**
   * Send a markdown-formatted message to a chat. Returns true on success.
   * Never throws — failure is logged and silently ignored so a Telegram
   * outage cannot break grading or quiz flow.
   *
   * MarkdownV2 reserved chars are escaped automatically. If you want raw
   * (already-escaped) markdown, pass `options.skipEscape = true`.
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options?: { skipEscape?: boolean; replyMarkup?: any; disableWebPagePreview?: boolean },
  ): Promise<boolean> {
    if (!this._bot) return false;
    if (!this.isValidChatId(chatId)) {
      this.logger.warn(`Refusing to send to invalid chatId "${chatId}"`);
      return false;
    }

    const body = options?.skipEscape ? text : this.escapeMarkdownV2(text);

    try {
      await this.outboundQueue.add(() =>
        this._bot!.api.sendMessage(chatId, body, {
          parse_mode: 'MarkdownV2',
          link_preview_options: { is_disabled: options?.disableWebPagePreview ?? true },
          reply_markup: options?.replyMarkup,
        }),
      );
      return true;
    } catch (e) {
      this.logTelegramError('sendMessage', e);
      return false;
    }
  }

  /**
   * Convenience over `sendMessage` for the common "notification with action
   * buttons" pattern used by NotificationsService (Phase 1.6).
   *
   *   await tg.sendMessageWithButtons(chat, 'New grade!', [
   *     [{ text: '📊 View', url: 'https://lms/.../grades' }],
   *     [{ text: '🤖 Ask AI', callback_data: 'aifeedback:abc123' }],
   *   ]);
   */
  async sendMessageWithButtons(
    chatId: string | number,
    text: string,
    buttons: Array<Array<{ text: string; url?: string; callback_data?: string }>>,
  ): Promise<boolean> {
    const keyboard = new InlineKeyboard();
    buttons.forEach((row, i) => {
      if (i > 0) keyboard.row();
      row.forEach((btn) => {
        if (btn.url) keyboard.url(btn.text, btn.url);
        else if (btn.callback_data) keyboard.text(btn.text, btn.callback_data);
      });
    });
    return this.sendMessage(chatId, text, { replyMarkup: keyboard });
  }

  /**
   * Send a native Telegram quiz poll (with confetti on the correct answer!).
   * Used by:
   *   - Phase 2.1 quiz broadcast — teacher publishes → bot fans out polls.
   *   - Phase 2.2 Live Kahoot — each question becomes a poll with `open_period`.
   *
   * Returns the `poll_id` on success (caller stores it to match `poll_answer`
   * events back to the originating question), or null on failure.
   */
  async sendQuizPoll(
    chatId: string | number,
    question: string,
    options: string[],
    correctIndex: number,
    extras?: { explanation?: string; openPeriodSeconds?: number; isAnonymous?: boolean },
  ): Promise<string | null> {
    if (!this._bot) return null;
    if (!this.isValidChatId(chatId)) return null;

    try {
      const msg = await this.outboundQueue.add(() =>
        // grammY's typed Bot API uses `correct_option_ids` (array) — Telegram
        // recently extended quiz polls to support multi-correct answers.
        // For a classic single-answer quiz we just wrap one index.
        this._bot!.api.sendPoll(
          chatId,
          question,
          options.map((t) => ({ text: t })),
          {
            type: 'quiz',
            correct_option_ids: [correctIndex],
            explanation: extras?.explanation?.slice(0, 200), // TG hard limit
            is_anonymous: extras?.isAnonymous ?? false,
            open_period: extras?.openPeriodSeconds,
          } as any,
        ),
      );
      return msg?.poll?.id ?? null;
    } catch (e) {
      this.logTelegramError('sendPoll', e);
      return null;
    }
  }

  /**
   * Send a photo (used by some teacher commands / weekly digest in future).
   * Accepts a grammY `InputFile` (Buffer-backed) or a URL string.
   */
  async sendPhoto(chatId: string | number, photo: InputFile | string, caption?: string): Promise<boolean> {
    if (!this._bot || !this.isValidChatId(chatId)) return false;
    try {
      await this.outboundQueue.add(() =>
        this._bot!.api.sendPhoto(chatId, photo as any, caption ? { caption } : undefined),
      );
      return true;
    } catch (e) {
      this.logTelegramError('sendPhoto', e);
      return false;
    }
  }

  /**
   * Verification flow — kept around for the legacy "manual chat_id paste"
   * linking path that still works as a fallback for users who can't open
   * the deep link from the profile page (Phase 1.5). Throws on failure so
   * the controller can surface the issue.
   */
  async sendVerification(chatId: string, fullName: string): Promise<void> {
    if (!this._bot) {
      throw new BadRequestException(
        'Telegram bot is not configured on this server. Ask your administrator to set TELEGRAM_BOT_TOKEN.',
      );
    }
    const ok = await this.sendMessage(
      chatId,
      `✅ *UniLMS linked!*\n\nHi ${fullName}, your account is now connected to this chat. You'll receive assignment, grade, and announcement notifications here.\n\nIf you didn't request this, just unlink from your UniLMS profile.`,
    );
    if (!ok) {
      throw new BadRequestException(
        'Could not deliver the test message. Double-check your chat_id, and make sure you have sent at least one message to the bot first (Telegram requires this to allow outbound DMs).',
      );
    }
  }

  /**
   * Download a file the user uploaded to the bot. Used by the photo-submission
   * handler (Phase 4.3) — given a Telegram `file_id` we resolve its CDN path
   * and fetch the bytes into a Buffer for StorageService.
   */
  async downloadFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
    if (!this._bot || !this.token) return null;
    try {
      const file = await this._bot.api.getFile(fileId);
      if (!file.file_path) return null;
      const url = `https://api.telegram.org/file/bot${this.token}/${file.file_path}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      // Best-effort MIME inference from file_path extension; bot context
      // also has `mime_type` on document uploads which the caller can pass in.
      const ext = file.file_path.split('.').pop()?.toLowerCase() ?? '';
      const mimeType =
        ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'png'
            ? 'image/png'
            : ext === 'webp'
              ? 'image/webp'
              : ext === 'pdf'
                ? 'application/pdf'
                : 'application/octet-stream';
      const fileName = file.file_path.split('/').pop() ?? `${fileId}.${ext || 'bin'}`;
      return { buffer, mimeType, fileName };
    } catch (e) {
      this.logTelegramError('downloadFile', e);
      return null;
    }
  }

  /** MarkdownV2 escape per https://core.telegram.org/bots/api#markdownv2-style */
  escapeMarkdownV2(text: string): string {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
  }

  /**
   * Build a MarkdownV2 string from already-formatted pieces (e.g. you want
   * `*bold*` but want to escape the surrounding user-supplied text). Pieces
   * marked `safe: true` are passed through verbatim; everything else is
   * escaped. Saves the caller from manually escaping every interpolation.
   */
  mdv2(parts: Array<string | { safe: string }>): string {
    return parts.map((p) => (typeof p === 'string' ? this.escapeMarkdownV2(p) : p.safe)).join('');
  }

  private isValidChatId(chatId: string | number): boolean {
    return /^-?\d{4,20}$/.test(String(chatId));
  }

  private logTelegramError(op: string, e: unknown) {
    if (e instanceof GrammyError) {
      // Real Telegram API error — log code + description; don't crash.
      this.logger.warn(`Telegram ${op} failed: ${e.error_code} ${e.description}`);
    } else if (e instanceof HttpError) {
      this.logger.warn(`Telegram ${op} network error: ${e.message}`);
    } else if (e instanceof Error) {
      this.logger.warn(`Telegram ${op} threw: ${e.message}`);
    } else {
      this.logger.warn(`Telegram ${op} threw: ${String(e)}`);
    }
  }
}
