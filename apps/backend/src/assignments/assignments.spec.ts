import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('Assignments (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let courseId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const email = `assign-admin-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'admin123', fullName: 'Assign Admin', role: 'ADMIN' });
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'admin123' });
    adminToken = loginRes.body.accessToken;

    // Create a course
    const courseRes = await request(app.getHttpServer())
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `ASGN-${Date.now()}`, title: 'Assignment Test Course', semester: '2025-Spring' });
    courseId = courseRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/courses/:id/assignments - returns assignments list', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/courses/${courseId}/assignments`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/courses/:id/assignments - creates assignment as admin', async () => {
    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test Assignment', description: 'Submit your work', dueAt, maxScore: 100 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Test Assignment');
  });

  it('GET /api/search?q= - returns search results', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/search?q=Test')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('courses');
    expect(res.body).toHaveProperty('materials');
    expect(res.body).toHaveProperty('assignments');
  });

  it('GET /api/admin/stats - returns platform statistics', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(res.body).toHaveProperty('courses');
    expect(res.body).toHaveProperty('submissions');
  });
});
