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
});
