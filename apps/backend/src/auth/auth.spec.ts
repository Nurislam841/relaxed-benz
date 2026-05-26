import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/auth/register - creates a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `test-${Date.now()}@example.com`,
        password: 'password123',
        fullName: 'Test User',
        role: 'STUDENT',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
  });

  it('POST /api/auth/login - authenticates and returns tokens', async () => {
    const email = `login-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'password123', fullName: 'Login User', role: 'STUDENT' });

    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('POST /api/auth/login - rejects invalid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me - returns 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  /**
   * Socket-token endpoint regression. The Kahoot WS connects directly to
   * the backend domain (different from the Vercel frontend domain),
   * so domain-bound cookies can't reach it. We give the JS layer an
   * explicit way to grab the JWT and hand it to socket.io as
   * `auth.token`. The endpoint must require auth and must echo the
   * exact same JWT the request used.
   */
  describe('GET /api/auth/socket-token', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/socket-token');
      expect(res.status).toBe(401);
    });

    it('returns the JWT for an authenticated caller (Bearer header path)', async () => {
      const email = `socket-token-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'password123', fullName: 'Sock User', role: 'STUDENT' });
      const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'password123' });
      const accessToken = login.body.accessToken as string;
      expect(accessToken).toBeTruthy();

      const res = await request(app.getHttpServer())
        .get('/api/auth/socket-token')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      // The endpoint echoes the same JWT — the WS gateway will then run
      // its own jwt.verify on it.
      expect(res.body.token).toBe(accessToken);
    });
  });

  /**
   * Cross-origin cookie regression: when COOKIE_SAMESITE=none is set (prod
   * with Vercel frontend + Render backend on different eTLD+1), login must
   * emit SameSite=None + Secure on both auth cookies — otherwise the Kahoot
   * WebSocket handshake (which connects cross-origin directly to the
   * backend) won't carry the access_token cookie and disconnects with
   * "Authentication required". Root cause of the "Host live didn't work"
   * report from production.
   */
  describe('cookie SameSite (cross-origin Kahoot WS)', () => {
    const original = process.env.COOKIE_SAMESITE;
    afterEach(() => {
      if (original === undefined) delete process.env.COOKIE_SAMESITE;
      else process.env.COOKIE_SAMESITE = original;
    });

    it('defaults to SameSite=Lax when COOKIE_SAMESITE is unset (dev/local)', async () => {
      delete process.env.COOKIE_SAMESITE;
      const email = `samesite-default-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'password123', fullName: 'X', role: 'STUDENT' });
      const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'password123' });
      const cookies = (res.headers['set-cookie'] as unknown as string[]) || [];
      const access = cookies.find((c) => c.startsWith('access_token='));
      expect(access).toBeDefined();
      expect(access!.toLowerCase()).toContain('samesite=lax');
      // Secure should NOT be present in Lax mode (dev/http localhost would refuse).
      expect(access!.toLowerCase()).not.toContain('secure');
    });

    it('emits SameSite=None + Secure when COOKIE_SAMESITE=none (prod cross-origin)', async () => {
      process.env.COOKIE_SAMESITE = 'none';
      const email = `samesite-none-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'password123', fullName: 'Y', role: 'STUDENT' });
      const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'password123' });
      const cookies = (res.headers['set-cookie'] as unknown as string[]) || [];
      const access = cookies.find((c) => c.startsWith('access_token='));
      const refresh = cookies.find((c) => c.startsWith('refresh_token='));
      expect(access).toBeDefined();
      expect(refresh).toBeDefined();
      // Browsers REQUIRE Secure when SameSite=None — without it the cookie is dropped.
      expect(access!.toLowerCase()).toContain('samesite=none');
      expect(access!.toLowerCase()).toContain('secure');
      expect(refresh!.toLowerCase()).toContain('samesite=none');
      expect(refresh!.toLowerCase()).toContain('secure');
    });
  });
});
