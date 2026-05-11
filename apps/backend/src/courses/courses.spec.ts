import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('Courses (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Register and login as admin
    const email = `admin-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'admin123', fullName: 'Test Admin', role: 'ADMIN' });

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'admin123' });
    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/courses - returns courses list (authenticated)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/courses')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    // Paginated response shape: { items: Course[], total, page, limit, hasNext }
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/courses - returns 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/api/courses');
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/courses - creates a course as admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `TEST-${Date.now()}`, title: 'Test Course', description: 'A test course', semester: '2025-Spring' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.code).toMatch(/^TEST-/);
  });
});
