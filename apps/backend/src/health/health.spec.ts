import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health → 200 with status ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptimeSeconds');
  });

  it('GET /api/health/ready → 200 when DB is reachable', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.db).toBe('up');
  });

  it('GET /api/health/version → 200 with build info', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/version');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('node');
    expect(res.body).toHaveProperty('env');
  });

  it('GET /api/health is not rate-limited', async () => {
    // Fire 30 quick requests; throttler global limit is 100/60s, but
    // health is decorated @SkipThrottle so even at scale it must remain 200.
    const results = await Promise.all(
      Array.from({ length: 30 }, () => request(app.getHttpServer()).get('/api/health')),
    );
    for (const r of results) expect(r.status).toBe(200);
  });
});
