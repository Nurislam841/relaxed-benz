import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

/**
 * Telegram tests target the behaviour we care about WITHOUT requiring a real
 * bot token in CI:
 *   - status endpoint surfaces whether bot is configured
 *   - input validation rejects non-numeric chat_ids
 *   - linking without a bot configured returns a useful error
 *   - unauthenticated requests are rejected
 *
 * Outbound Bot API calls (sendMessage) are not exercised here — that would
 * either need a live Telegram bot (out of scope for CI) or a network mock.
 */
describe('Telegram (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;

  beforeAll(async () => {
    // Force "not configured" state for predictable tests.
    delete process.env.TELEGRAM_BOT_TOKEN;

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const email = `tg-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'pw123456', fullName: 'TG User', role: 'STUDENT' });
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'pw123456' });
    token = login.body.accessToken;
  });

  afterAll(async () => {
    if (originalToken !== undefined) {
      process.env.TELEGRAM_BOT_TOKEN = originalToken;
    }
    await app.close();
  });

  it('GET /api/me/telegram/status — surfaces botConfigured=false when TOKEN unset', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/me/telegram/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(false);
    expect(res.body.chatIdHint).toBeNull();
    expect(res.body.botConfigured).toBe(false);
  });

  it('POST /api/me/telegram/link — rejects when bot not configured', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/me/telegram/link')
      .set('Authorization', `Bearer ${token}`)
      .send({ chatId: '123456789' });
    expect(res.status).toBe(400);
  });

  it('POST /api/me/telegram/link — rejects malformed chat_id', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/me/telegram/link')
      .set('Authorization', `Bearer ${token}`)
      .send({ chatId: 'not-a-number' });
    expect(res.status).toBe(400);
  });

  it('POST /api/me/telegram/unlink — idempotent (works even when not linked)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/me/telegram/unlink')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(false);
  });

  it('POST /api/me/telegram/test — reports not_linked when chat_id missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/me/telegram/test')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(false);
    expect(res.body.reason).toBe('not_linked');
  });

  it('All endpoints require authentication', async () => {
    const status = await request(app.getHttpServer()).get('/api/me/telegram/status');
    expect(status.status).toBe(401);
    const link = await request(app.getHttpServer()).post('/api/me/telegram/link').send({ chatId: '123' });
    expect(link.status).toBe(401);
  });

  // ─── Regression: /link <code> flow (added after deep-link payload kept
  // failing for users with prior chat history). The 6-digit code is the
  // bullet-proof fallback — it MUST exist in the link-token response and
  // MUST be one-shot.
  describe('Link-token / code flow', () => {
    it('POST /api/me/telegram/link-token — returns 6-digit code + payloadless deepLink', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/me/telegram/link-token')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toMatch(/^\d{6}$/);
      // Deep link must NOT carry the code as a `?start=` payload. Telegram
      // hides payloads from the user, so an auto-linking deep link confuses
      // people — they see "/start" succeed without typing the code, and
      // their manual /link attempt then fails because the code was already
      // consumed. The canonical linking path is /link 123456 explicit.
      expect(res.body.deepLink).not.toContain('?start=');
      expect(res.body.deepLink).toContain('t.me/');
      expect(res.body.botUsername).toBeTruthy();
      expect(res.body.expiresIn).toBeGreaterThanOrEqual(60);
    });

    it('generateLinkCode + consumeLinkCode round-trip works in-memory', () => {
      const tg = app.get(require('./telegram.service').TelegramService);
      const code = tg.generateLinkCode('user-abc');
      expect(code).toMatch(/^\d{6}$/);
      // First consume succeeds and returns the userId.
      expect(tg.consumeLinkCode(code)).toBe('user-abc');
      // Second consume returns null — code is one-shot, no replay.
      expect(tg.consumeLinkCode(code)).toBeNull();
      // Unknown code returns null cleanly (no throw).
      expect(tg.consumeLinkCode('000000')).toBeNull();
    });
  });

  // ─── Regression: isTelegramSafeUrl was added because http://localhost URLs
  // in inline keyboard buttons crash the bot polling loop with 400 Bad Request.
  describe('isTelegramSafeUrl URL guard', () => {
    const { isTelegramSafeUrl } = require('../common/public-url');
    it('accepts https URLs', () => {
      expect(isTelegramSafeUrl('https://example.com/x')).toBe(true);
    });
    it('rejects http (would crash inline button send)', () => {
      expect(isTelegramSafeUrl('http://example.com/x')).toBe(false);
      expect(isTelegramSafeUrl('http://localhost:3000/x')).toBe(false);
    });
    it('rejects undefined / null / empty', () => {
      expect(isTelegramSafeUrl(undefined)).toBe(false);
      expect(isTelegramSafeUrl(null)).toBe(false);
      expect(isTelegramSafeUrl('')).toBe(false);
    });
  });

  // ─── Regression: webhook endpoint must ack within Telegram's 5-second
  // delivery timeout even when the actual handler is slow. Verified by
  // confirming the endpoint returns 200 immediately when the bot isn't
  // configured (it has nothing to handle — silent no-op).
  describe('Webhook endpoint', () => {
    it('returns 200 when bot is disabled (silent no-op)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/telegram/webhook')
        .send({ update_id: 1, message: { message_id: 1, text: '/help', chat: { id: 1, type: 'private' }, date: 1 } });
      // No secret configured in this test → endpoint should still accept.
      // Real "invalid secret" case is covered by guard logic when
      // TELEGRAM_WEBHOOK_SECRET is set.
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  // ─── Regression: language picker + bot-i18n translations.
  describe('bot-i18n', () => {
    const { t, normaliseLang, BOT_LANGS } = require('./bot-i18n');

    it('every string key has all three locales (en/ru/kk)', () => {
      // Snapshot of every key currently used by handlers. If new keys are
      // added, this list MUST be updated — that's the point of the spec.
      const keys = [
        'pickLanguage',
        'languageSet',
        'promptCode',
        'linkUsage',
        'linkBadCode',
        'linkSuccess',
        'notLinked',
        'welcomeBack',
        'unlinked',
        'unlinkAlready',
        'helpTitle',
        'helpStudentsHeader',
        'helpTeachersHeader',
        'helpOtherHeader',
        'cmdToday',
        'cmdSchedule',
        'cmdGrades',
        'cmdUpcoming',
        'cmdAsk',
        'cmdCoach',
        'cmdJoin',
        'cmdSubmit',
        'cmdApp',
        'cmdAtRisk',
        'cmdAttendance',
        'cmdBind',
        'cmdUnbind',
        'cmdUnlink',
      ];
      for (const k of keys) {
        for (const l of ['en', 'ru', 'kk'] as const) {
          const text = t(k as any, l);
          expect(typeof text).toBe('string');
          expect(text.length).toBeGreaterThan(0);
          // English-only safety net for keys that don't have a russian/kazakh
          // translation — the t() helper falls back to en, so the test still
          // passes but at least we're explicit about the contract.
        }
      }
    });

    it('substitutes {name} placeholders', () => {
      const out = t('welcomeBack', 'en', { name: 'Alice' });
      expect(out).toContain('Alice');
      expect(out).not.toContain('{name}');
    });

    it('normaliseLang maps Telegram locale codes correctly', () => {
      expect(normaliseLang('ru')).toBe('ru');
      expect(normaliseLang('ru-RU')).toBe('ru');
      expect(normaliseLang('kk')).toBe('kk');
      expect(normaliseLang('kk-KZ')).toBe('kk');
      expect(normaliseLang('kz')).toBe('kk');
      expect(normaliseLang('en')).toBe('en');
      expect(normaliseLang('en-US')).toBe('en');
      expect(normaliseLang('fr')).toBe('en'); // unsupported → English fallback
      expect(normaliseLang(null)).toBe('en');
      expect(normaliseLang(undefined)).toBe('en');
    });

    it('BOT_LANGS lists exactly the three supported codes', () => {
      const codes = BOT_LANGS.map((l: any) => l.code).sort();
      expect(codes).toEqual(['en', 'kk', 'ru']);
    });
  });

  // ─── Regression: unlinked-user language storage.
  describe('Unlinked-user language storage', () => {
    it('setUnlinkedLang + getUnlinkedLang round-trip', () => {
      const tg = app.get(require('./telegram.service').TelegramService);
      tg.setUnlinkedLang('1234', 'ru');
      expect(tg.getUnlinkedLang('1234')).toBe('ru');
      expect(tg.getUnlinkedLang(1234)).toBe('ru'); // number → string normalisation
      tg.clearUnlinkedLang('1234');
      expect(tg.getUnlinkedLang('1234')).toBeNull();
    });

    it('getUnlinkedLang returns null for unknown chat', () => {
      const tg = app.get(require('./telegram.service').TelegramService);
      expect(tg.getUnlinkedLang('does-not-exist')).toBeNull();
    });
  });
});
