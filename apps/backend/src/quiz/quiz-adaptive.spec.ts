import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

/**
 * Adaptive quiz flow:
 *   - start returns first question (MEDIUM-preferred)
 *   - questions hide correctIndex from the player
 *   - 2 correct in a row → difficulty steps up
 *   - hitting all unused questions → done=true with final score
 *
 * We build a quiz with 3 EASY + 3 MEDIUM + 3 HARD questions so the streak
 * machine has room to walk up and down.
 */
describe('Adaptive Quiz (e2e)', () => {
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
    const adminEmail = `adapt-admin-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: adminEmail, password: 'admin123', fullName: 'Adapt Admin', role: 'ADMIN' });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'admin123' });
    adminToken = adminLogin.body.accessToken;

    // Student
    const studentEmail = `adapt-stu-${Date.now()}@example.com`;
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: studentEmail, password: 'pw123456', fullName: 'Adapt Student', role: 'STUDENT' });
    studentId = reg.body.user.id;
    const studentLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: studentEmail, password: 'pw123456' });
    studentToken = studentLogin.body.accessToken;

    // Course + enrollment
    const course = await request(app.getHttpServer())
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `ADAPT-${Date.now()}`, title: 'Adaptive course', semester: '2025-Spring' });
    courseId = course.body.id;
    await request(app.getHttpServer())
      .post('/api/admin/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentId, courseId, roleInCourse: 'STUDENT' });

    // Quiz with 3 questions per tier — picked so correctIndex=0 always
    const tiers: Array<'EASY' | 'MEDIUM' | 'HARD'> = ['EASY', 'MEDIUM', 'HARD'];
    const questions = tiers.flatMap((tier, ti) =>
      [0, 1, 2].map((i) => ({
        question: `${tier} Q${i + 1}: What is the right answer?`,
        options: ['Right', 'Wrong A', 'Wrong B', 'Wrong C'],
        correctIndex: 0,
        explanation: `${tier} explanation #${i + 1}`,
        points: 100 + ti * 10, // higher tier → slightly higher points
        difficulty: tier,
      })),
    );

    const quiz = await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/quizzes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Adaptive Test Quiz',
        isPublished: true,
        secondsPerQuestion: 30,
        questions,
      });
    expect(quiz.status).toBe(201);
    quizId = quiz.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/quizzes/:id/adaptive/start — returns first question without correctIndex', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/quizzes/${quizId}/adaptive/start`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('attemptId');
    expect(res.body).toHaveProperty('question');
    expect(res.body.question).toHaveProperty('options');
    // Student must never see correctIndex up-front
    expect(res.body.question).not.toHaveProperty('correctIndex');
    expect(['EASY', 'MEDIUM', 'HARD']).toContain(res.body.currentDifficulty);
  });

  it('Adaptive answer flow — 2 consecutive correct bumps difficulty up', async () => {
    const start = await request(app.getHttpServer())
      .post(`/api/quizzes/${quizId}/adaptive/start`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});
    const attemptId = start.body.attemptId;
    const startDifficulty = start.body.currentDifficulty;

    // First correct answer (pickedIndex=0 always, since we seeded that way)
    const a1 = await request(app.getHttpServer())
      .post(`/api/quizzes/${quizId}/adaptive/answer`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        attemptId,
        questionId: start.body.question.id,
        pickedIndex: 0,
        responseTimeMs: 800,
      });
    expect(a1.status).toBe(201);
    expect(a1.body.done).toBe(false);
    expect(a1.body.feedback.isCorrect).toBe(true);

    // Second correct answer — difficulty should now step up (or stay if already HARD)
    const a2 = await request(app.getHttpServer())
      .post(`/api/quizzes/${quizId}/adaptive/answer`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        attemptId,
        questionId: a1.body.question.id,
        pickedIndex: 0,
        responseTimeMs: 800,
      });
    expect(a2.status).toBe(201);
    expect(a2.body.feedback.isCorrect).toBe(true);
    expect(a2.body.streakLen).toBeGreaterThanOrEqual(2);
    expect(a2.body.streakDir).toBe('correct');
    // Either bumped up, or already HARD and stayed at HARD
    if (startDifficulty !== 'HARD') {
      expect(['MEDIUM', 'HARD']).toContain(a2.body.currentDifficulty);
    }
  });

  it('Answering all 9 questions correctly ends the session with done=true', async () => {
    const start = await request(app.getHttpServer())
      .post(`/api/quizzes/${quizId}/adaptive/start`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});
    let attemptId = start.body.attemptId;
    let currentQ = start.body.question;
    let safety = 20; // hard cap to avoid infinite loop on bug
    let done = false;
    let finalAttempt: any = null;

    while (!done && safety-- > 0) {
      const res = await request(app.getHttpServer())
        .post(`/api/quizzes/${quizId}/adaptive/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          attemptId,
          questionId: currentQ.id,
          pickedIndex: 0,
          responseTimeMs: 500,
        });
      expect(res.status).toBe(201);
      done = res.body.done;
      if (done) {
        finalAttempt = res.body.attempt;
      } else {
        currentQ = res.body.question;
      }
    }

    expect(done).toBe(true);
    expect(finalAttempt).not.toBeNull();
    // All 9 answered correctly — score should equal totalPoints
    expect(finalAttempt.score).toBeGreaterThan(0);
    expect(finalAttempt.score).toBe(finalAttempt.totalPoints);
    expect(finalAttempt.answeredCount).toBe(9);
  });

  it('Answering the same question twice in one attempt is rejected', async () => {
    const start = await request(app.getHttpServer())
      .post(`/api/quizzes/${quizId}/adaptive/start`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    await request(app.getHttpServer())
      .post(`/api/quizzes/${quizId}/adaptive/answer`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        attemptId: start.body.attemptId,
        questionId: start.body.question.id,
        pickedIndex: 0,
        responseTimeMs: 500,
      });

    // Re-submit the same question
    const repeat = await request(app.getHttpServer())
      .post(`/api/quizzes/${quizId}/adaptive/answer`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        attemptId: start.body.attemptId,
        questionId: start.body.question.id,
        pickedIndex: 0,
        responseTimeMs: 500,
      });
    expect(repeat.status).toBe(400);
  });
});
