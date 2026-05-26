import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('Kahoot (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let courseId: string;
  let quizId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Admin
    const adminEmail = `kah-admin-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: adminEmail, password: 'admin123', fullName: 'Kahoot Admin', role: 'ADMIN' });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'admin123' });
    adminToken = adminLogin.body.accessToken;

    // Student
    const studentEmail = `kah-student-${Date.now()}@example.com`;
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: studentEmail, password: 'pw123456', fullName: 'Kahoot Student', role: 'STUDENT' });
    studentId = reg.body.user.id;
    const studentLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: studentEmail, password: 'pw123456' });
    studentToken = studentLogin.body.accessToken;

    // Course
    const courseRes = await request(app.getHttpServer())
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `KAH-${Date.now()}`, title: 'Kahoot Course', semester: '2025-Spring' });
    courseId = courseRes.body.id;

    await request(app.getHttpServer())
      .post('/api/admin/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentId, courseId, roleInCourse: 'STUDENT' });

    // Quiz with 1 question
    const quizRes = await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/quizzes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Live Quiz',
        isPublished: true,
        secondsPerQuestion: 30,
        questions: [
          { question: 'Sky color?', options: ['Red', 'Blue', 'Green', 'Yellow'], correctIndex: 1, points: 100 },
        ],
      });
    quizId = quizRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  let sessionId: string;
  let joinCode: string;

  it('POST /api/kahoot/sessions — admin creates session with join code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/kahoot/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quizId });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body.joinCode).toMatch(/^[A-Z2-9]{6}$/);
    sessionId = res.body.sessionId;
    joinCode = res.body.joinCode;
  });

  it('POST /api/kahoot/sessions — student gets 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/kahoot/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ quizId });
    expect(res.status).toBe(403);
  });

  it('GET /api/kahoot/sessions/by-code/:joinCode — student joins by code', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/kahoot/sessions/by-code/${joinCode}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(sessionId);
    expect(res.body.quizTitle).toBe('Live Quiz');
  });

  it('POST /api/kahoot/sessions/:id/start → current-question → answer → finish flow', async () => {
    const start = await request(app.getHttpServer())
      .post(`/api/kahoot/sessions/${sessionId}/start`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(start.status).toBe(201);
    expect(start.body.status).toBe('IN_PROGRESS');

    const cur = await request(app.getHttpServer())
      .get(`/api/kahoot/sessions/${sessionId}/current-question`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(cur.status).toBe(200);
    expect(cur.body).toHaveProperty('id');
    // Student must NOT see correctIndex
    expect(cur.body).not.toHaveProperty('correctIndex');

    const ans = await request(app.getHttpServer())
      .post(`/api/kahoot/sessions/${sessionId}/answer`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ questionId: cur.body.id, pickedIndex: 1, responseTimeMs: 1000 });
    expect(ans.status).toBe(201);
    expect(ans.body.isCorrect).toBe(true);
    expect(ans.body.pointsEarned).toBeGreaterThan(0);

    const board = await request(app.getHttpServer())
      .get(`/api/kahoot/sessions/${sessionId}/leaderboard`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(board.status).toBe(200);
    expect(Array.isArray(board.body)).toBe(true);
    expect(board.body[0].score).toBeGreaterThan(0);

    const fin = await request(app.getHttpServer())
      .post(`/api/kahoot/sessions/${sessionId}/finish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(fin.status).toBe(201);
    expect(fin.body.status).toBe('FINISHED');
  });

  // ─── Post-session report (added with Kahoot-style flow) ─────────────────
  describe('GET /api/kahoot/sessions/:id/report', () => {
    it('returns aggregated session data for the host', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/kahoot/sessions/${sessionId}/report`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      // The frontend report page reads exactly these top-level keys.
      expect(res.body.session).toBeDefined();
      expect(res.body.session.joinCode).toBeDefined();
      expect(res.body.summary).toBeDefined();
      expect(typeof res.body.summary.totalPlayers).toBe('number');
      expect(typeof res.body.summary.averageAccuracy).toBe('number');
      expect(Array.isArray(res.body.perPlayer)).toBe(true);
      expect(Array.isArray(res.body.perQuestion)).toBe(true);
    });

    it('perPlayer entries carry rank + accuracy + answers trail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/kahoot/sessions/${sessionId}/report`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      if (res.body.perPlayer.length > 0) {
        const p = res.body.perPlayer[0];
        expect(typeof p.rank).toBe('number');
        expect(typeof p.score).toBe('number');
        expect(typeof p.accuracy).toBe('number');
        expect(Array.isArray(p.answers)).toBe(true);
      }
    });

    it('perQuestion entries include answer distribution + correctIndex', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/kahoot/sessions/${sessionId}/report`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      if (res.body.perQuestion.length > 0) {
        const q = res.body.perQuestion[0];
        expect(typeof q.questionText).toBe('string');
        expect(typeof q.correctIndex).toBe('number');
        expect(Array.isArray(q.answerDistribution)).toBe(true);
        // distribution length should match options length on the question
        expect(q.answerDistribution.length).toBe(q.options.length);
      }
    });

    it('non-host (student) is blocked (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/kahoot/sessions/${sessionId}/report`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    it('requires authentication (401)', async () => {
      const res = await request(app.getHttpServer()).get(`/api/kahoot/sessions/${sessionId}/report`);
      expect(res.status).toBe(401);
    });
  });
});
