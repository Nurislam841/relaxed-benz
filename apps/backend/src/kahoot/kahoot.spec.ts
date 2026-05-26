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

  /**
   * Scoring math regression — see kahoot.service.answer() and
   * getSessionReport(). Old behaviour gave a Kahoot-style speed bonus
   * (100 × speedFactor) and computed per-player accuracy as
   * correctCount/totalAnswered. Teachers reported the visible numbers
   * felt arbitrary: "1 correct out of 5" showed 25% accuracy + 98 score
   * (because the unanswered Q5 was excluded from the denominator and
   * the answer for Q4 came in fast). The new contract:
   *
   *   pointsEarned = isCorrect ? round(100 / totalQuestions) : 0
   *   accuracy     = round((correctCount / totalQuestions) × 100)
   *
   * → 1 correct out of 5 questions ⇒ score=20, accuracy=20%, full stop.
   */
  describe('scoring math (flat 100/N, accuracy /totalQuestions)', () => {
    let mathCourseId: string;
    let mathQuizId: string;
    let mathSessionId: string;
    let mathStudentToken: string;

    beforeAll(async () => {
      // Fresh course + 5-question quiz so we exercise the divisor.
      const cres = await request(app.getHttpServer())
        .post('/api/admin/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: `MATH-${Date.now()}`, title: 'Scoring math course', semester: '2025-Spring' });
      mathCourseId = cres.body.id;

      const sEmail = `math-student-${Date.now()}@example.com`;
      const sReg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: sEmail, password: 'pw123456', fullName: 'Math Student', role: 'STUDENT' });
      const sId = sReg.body.user.id;
      const sLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: sEmail, password: 'pw123456' });
      mathStudentToken = sLogin.body.accessToken;

      await request(app.getHttpServer())
        .post('/api/admin/enrollments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: sId, courseId: mathCourseId, roleInCourse: 'STUDENT' });

      const qres = await request(app.getHttpServer())
        .post(`/api/courses/${mathCourseId}/quizzes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Scoring',
          isPublished: true,
          secondsPerQuestion: 30,
          // points=100 on each question is the LEGACY field; we now derive
          // per-question points from 100/totalQuestions at answer time.
          questions: Array.from({ length: 5 }).map((_, i) => ({
            question: `Q${i + 1}`,
            options: ['A', 'B', 'C', 'D'],
            correctIndex: 0,
            points: 100,
          })),
        });
      mathQuizId = qres.body.id;

      const sess = await request(app.getHttpServer())
        .post('/api/kahoot/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quizId: mathQuizId });
      mathSessionId = sess.body.sessionId;

      await request(app.getHttpServer())
        .post(`/api/kahoot/sessions/${mathSessionId}/start`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('correct answer stores 1 raw point, speed bonus removed', async () => {
      // The on-the-wire `pointsEarned` is now the raw 0/1 increment to
      // attempt.score — the human-facing percent is derived in the
      // leaderboard/report responses.
      const cur = await request(app.getHttpServer())
        .get(`/api/kahoot/sessions/${mathSessionId}/current-question`)
        .set('Authorization', `Bearer ${mathStudentToken}`);
      expect(cur.status).toBe(200);

      const ans = await request(app.getHttpServer())
        .post(`/api/kahoot/sessions/${mathSessionId}/answer`)
        .set('Authorization', `Bearer ${mathStudentToken}`)
        .send({ questionId: cur.body.id, pickedIndex: 0, responseTimeMs: 25000 });
      expect(ans.status).toBe(201);
      expect(ans.body.isCorrect).toBe(true);
      expect(ans.body.pointsEarned).toBe(1);
    });

    it('report: 1/5 answered correctly ⇒ score=20, accuracy=20% (not 25%, not 100%)', async () => {
      // Advance past the remaining 4 questions without answering — they
      // stay unanswered to mimic the user's smoke scenario.
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post(`/api/kahoot/sessions/${mathSessionId}/next`)
          .set('Authorization', `Bearer ${adminToken}`);
      }

      const rep = await request(app.getHttpServer())
        .get(`/api/kahoot/sessions/${mathSessionId}/report`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(rep.status).toBe(200);
      const player = rep.body.perPlayer[0];
      expect(player).toBeDefined();
      expect(player.score).toBe(20);
      expect(player.accuracy).toBe(20);
      expect(player.correctCount).toBe(1);
      expect(player.totalAnswered).toBe(1);
    });

    /**
     * Decimal precision case the user called out explicitly:
     *   "если вопросов 8 то 100/8 значить 1 правильный ответ 12,5
     *    он автоматический должен считать понял?"
     * 100/8 = 12.5 exactly. We keep one decimal so the displayed
     * number matches the user's mental model. The old Int-rounded
     * approach (round(100/8)=13, ×8=104) is what this guards against.
     */
    it('8-question quiz: 1 correct ⇒ score=12.5, 8 correct ⇒ score=100 (no rounding drift)', async () => {
      // Fresh 8-question quiz under the same course/student.
      const qres = await request(app.getHttpServer())
        .post(`/api/courses/${mathCourseId}/quizzes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Eight',
          isPublished: true,
          secondsPerQuestion: 30,
          questions: Array.from({ length: 8 }).map((_, i) => ({
            question: `Q${i + 1}`,
            options: ['A', 'B', 'C', 'D'],
            correctIndex: 0,
            points: 100,
          })),
        });
      const eightQuizId = qres.body.id;
      const sess = await request(app.getHttpServer())
        .post('/api/kahoot/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quizId: eightQuizId });
      const eightSessionId = sess.body.sessionId;
      await request(app.getHttpServer())
        .post(`/api/kahoot/sessions/${eightSessionId}/start`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Student answers Q1 correctly, then host runs through the rest.
      const q1 = await request(app.getHttpServer())
        .get(`/api/kahoot/sessions/${eightSessionId}/current-question`)
        .set('Authorization', `Bearer ${mathStudentToken}`);
      await request(app.getHttpServer())
        .post(`/api/kahoot/sessions/${eightSessionId}/answer`)
        .set('Authorization', `Bearer ${mathStudentToken}`)
        .send({ questionId: q1.body.id, pickedIndex: 0, responseTimeMs: 1500 });
      for (let i = 0; i < 8; i++) {
        await request(app.getHttpServer())
          .post(`/api/kahoot/sessions/${eightSessionId}/next`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
      const repOne = await request(app.getHttpServer())
        .get(`/api/kahoot/sessions/${eightSessionId}/report`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(repOne.status).toBe(200);
      expect(repOne.body.perPlayer[0].score).toBe(12.5);
      expect(repOne.body.perPlayer[0].accuracy).toBe(12.5);

      // Second run: same student, 8 correct = exact 100 (not 104).
      const sess2 = await request(app.getHttpServer())
        .post('/api/kahoot/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quizId: eightQuizId });
      const sId2 = sess2.body.sessionId;
      await request(app.getHttpServer())
        .post(`/api/kahoot/sessions/${sId2}/start`)
        .set('Authorization', `Bearer ${adminToken}`);

      for (let i = 0; i < 8; i++) {
        const cur = await request(app.getHttpServer())
          .get(`/api/kahoot/sessions/${sId2}/current-question`)
          .set('Authorization', `Bearer ${mathStudentToken}`);
        await request(app.getHttpServer())
          .post(`/api/kahoot/sessions/${sId2}/answer`)
          .set('Authorization', `Bearer ${mathStudentToken}`)
          .send({ questionId: cur.body.id, pickedIndex: 0, responseTimeMs: 1500 });
        await request(app.getHttpServer())
          .post(`/api/kahoot/sessions/${sId2}/next`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
      const repAll = await request(app.getHttpServer())
        .get(`/api/kahoot/sessions/${sId2}/report`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(repAll.body.perPlayer[0].score).toBe(100);
      expect(repAll.body.perPlayer[0].accuracy).toBe(100);
      expect(repAll.body.perPlayer[0].correctCount).toBe(8);
    });

    /**
     * Generality witness — proves the calculator handles arbitrary N, not
     * just the 5/8 examples earlier in this block. Same formula, every
     * row: percent = round((correctCount / N) × 1000) / 10. The user
     * specifically asked for a "good calculator that works automatically
     * for any number of questions", so this guards against future
     * regressions where someone might hard-code a 100-point ceiling.
     */
    it.each([
      { n: 3, correct: 1, expected: 33.3 },
      { n: 3, correct: 2, expected: 66.7 },
      { n: 3, correct: 3, expected: 100 },
      { n: 4, correct: 1, expected: 25 },
      { n: 7, correct: 5, expected: 71.4 },
      { n: 10, correct: 7, expected: 70 },
      { n: 12, correct: 1, expected: 8.3 },
    ])(
      '$n-question quiz, $correct correct ⇒ score = $expected (universal formula)',
      async ({ n, correct, expected }) => {
        const qres = await request(app.getHttpServer())
          .post(`/api/courses/${mathCourseId}/quizzes`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: `N${n}`,
            isPublished: true,
            secondsPerQuestion: 30,
            questions: Array.from({ length: n }).map((_, i) => ({
              question: `Q${i + 1}`,
              options: ['A', 'B', 'C', 'D'],
              correctIndex: 0,
              points: 100,
            })),
          });
        const sess = await request(app.getHttpServer())
          .post('/api/kahoot/sessions')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ quizId: qres.body.id });
        const sid = sess.body.sessionId;
        await request(app.getHttpServer())
          .post(`/api/kahoot/sessions/${sid}/start`)
          .set('Authorization', `Bearer ${adminToken}`);

        for (let i = 0; i < n; i++) {
          const cur = await request(app.getHttpServer())
            .get(`/api/kahoot/sessions/${sid}/current-question`)
            .set('Authorization', `Bearer ${mathStudentToken}`);
          // Answer the first `correct` questions right, the rest with a
          // deliberately wrong pick.
          const pick = i < correct ? 0 : 1;
          await request(app.getHttpServer())
            .post(`/api/kahoot/sessions/${sid}/answer`)
            .set('Authorization', `Bearer ${mathStudentToken}`)
            .send({ questionId: cur.body.id, pickedIndex: pick, responseTimeMs: 1500 });
          await request(app.getHttpServer())
            .post(`/api/kahoot/sessions/${sid}/next`)
            .set('Authorization', `Bearer ${adminToken}`);
        }
        const rep = await request(app.getHttpServer())
          .get(`/api/kahoot/sessions/${sid}/report`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(rep.status).toBe(200);
        expect(rep.body.perPlayer[0].score).toBe(expected);
        expect(rep.body.perPlayer[0].accuracy).toBe(expected);
        expect(rep.body.perPlayer[0].correctCount).toBe(correct);
      },
    );
  });
});
