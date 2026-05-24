import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('Achievements (e2e)', () => {
  let app: INestApplication;
  let studentToken: string;
  let adminToken: string;
  let studentId: string;
  let courseId: string;
  let assignmentId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Admin
    const adminEmail = `ach-admin-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: adminEmail, password: 'admin123', fullName: 'Ach Admin', role: 'ADMIN' });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'admin123' });
    adminToken = adminLogin.body.accessToken;

    // Student
    const studentEmail = `ach-stu-${Date.now()}@example.com`;
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: studentEmail, password: 'pw123456', fullName: 'Ach Student', role: 'STUDENT' });
    studentId = reg.body.user.id;
    const studentLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: studentEmail, password: 'pw123456' });
    studentToken = studentLogin.body.accessToken;

    // Course + enrollment + assignment for submission flow
    const course = await request(app.getHttpServer())
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `ACH-${Date.now()}`, title: 'Achievements course', semester: '2025-Spring' });
    courseId = course.body.id;

    await request(app.getHttpServer())
      .post('/api/admin/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentId, courseId, roleInCourse: 'STUDENT' });

    const asg = await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test essay',
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        maxScore: 100,
      });
    assignmentId = asg.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/me/achievements — returns catalog with earned/locked status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/me/achievements')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // Every catalog item carries the metadata + earned flag
    for (const a of res.body) {
      expect(a).toHaveProperty('key');
      expect(a).toHaveProperty('title');
      expect(a).toHaveProperty('tier');
      expect(a).toHaveProperty('earned');
    }
  });

  it('POST /api/me/achievements/recompute — grants "first_steps" on first call for any user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/me/achievements/recompute')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.newlyEarned)).toBe(true);
    // first_steps is universal — student must have it after recompute
    const after = await request(app.getHttpServer())
      .get('/api/me/achievements')
      .set('Authorization', `Bearer ${studentToken}`);
    const firstSteps = after.body.find((a: any) => a.key === 'first_steps');
    expect(firstSteps).toBeDefined();
    expect(firstSteps.earned).toBe(true);
  });

  it('POST /api/me/achievements/recompute — idempotent (no re-grant on second call)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/me/achievements/recompute')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});
    expect(res.status).toBe(201);
    // first_steps should NOT be in newlyEarned (already granted in prior test)
    expect(res.body.newlyEarned).not.toContain('first_steps');
  });

  it('Submission auto-grants "first_submission" achievement', async () => {
    // Submit assignment
    await request(app.getHttpServer())
      .post(`/api/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ contentText: 'My answer to the essay assignment.' });

    // Auto-grant runs fire-and-forget — small wait to let it complete
    await new Promise((r) => setTimeout(r, 200));

    const res = await request(app.getHttpServer())
      .get('/api/me/achievements')
      .set('Authorization', `Bearer ${studentToken}`);
    const first = res.body.find((a: any) => a.key === 'first_submission');
    expect(first).toBeDefined();
    expect(first.earned).toBe(true);
    expect(first.earnedAt).not.toBeNull();
  });

  it('Teacher-only achievements are not in the student catalog', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/me/achievements')
      .set('Authorization', `Bearer ${studentToken}`);
    const keys = res.body.map((a: any) => a.key);
    expect(keys).not.toContain('teacher_first_quiz_created');
    expect(keys).not.toContain('teacher_active_grader');
  });
});
