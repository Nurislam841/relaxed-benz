import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { authenticator } from 'otplib';
import { AppModule } from '../app.module';

/**
 * Two-factor flow:
 *   1. status → enabled:false
 *   2. setup  → returns secret + QR data URI
 *   3. enable → requires a code generated from that secret
 *   4. login  → first attempt without code returns 401 + requires2fa:true
 *               second attempt with valid code succeeds
 *   5. disable → requires current code
 */
describe('Two-factor (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let email: string;
  const password = 'pw123456';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    email = `2fa-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, fullName: '2FA User', role: 'STUDENT' });
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
    token = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  let totpSecret: string;

  it('GET /api/auth/2fa/status — starts as disabled', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/2fa/status').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('POST /api/auth/2fa/setup — returns secret + QR data URI', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('secret');
    expect(res.body).toHaveProperty('otpauthUrl');
    expect(res.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    totpSecret = res.body.secret;
  });

  it('POST /api/auth/2fa/enable — rejects invalid code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/2fa/enable — accepts a valid TOTP code', async () => {
    const code = authenticator.generate(totpSecret);
    const res = await request(app.getHttpServer())
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it('POST /api/auth/login — returns requires2fa:true when 2FA is on and no code is provided', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(401);
    expect(res.body.requires2fa).toBe(true);
  });

  it('POST /api/auth/login — accepts a valid TOTP code as second factor', async () => {
    const totpCode = authenticator.generate(totpSecret);
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password, totpCode });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('POST /api/auth/2fa/disable — requires a valid code', async () => {
    const code = authenticator.generate(totpSecret);
    const res = await request(app.getHttpServer())
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);

    // After disable, login no longer requires 2FA
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
  });
});
