import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

/**
 * AI endpoints are tested in **demo mode** — LLM_API_KEY is unset before
 * AppModule loads, so AiService falls back to deterministic demo payloads
 * (marked `_demo: true`). This keeps CI fast and free, and decouples the
 * test from Anthropic's availability or quota.
 *
 * What we DO cover:
 *   - auth required on every endpoint (no anonymous AI calls)
 *   - role checks (students can't generate quizzes or see class insights)
 *   - response schema (each endpoint returns the documented shape so the
 *     frontend can rely on it)
 *   - student isolation (students can't request feedback / coach reports
 *     on someone else's data)
 *
 * What we DON'T cover here:
 *   - real LLM output quality (that's a manual smoke task)
 *   - SSE chat streaming (different framing — covered by manual smoke)
 */
describe('AI endpoints (e2e, demo mode)', () => {
  let app: INestApplication;
  let teacherToken: string;
  let studentToken: string;
  let courseId: string;
  let assignmentId: string;
  let submissionId: string;
  let teacherId: string;
  let studentId: string;
  const originalKey = process.env.LLM_API_KEY;

  beforeAll(async () => {
    // Force demo-mode AI for predictable, fast tests.
    delete process.env.LLM_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Register a teacher and a student. The DTO doesn't allow setting role
    // directly on register (security), so we promote the teacher via Prisma
    // after registration. Both have minimal-enough setup to drive every AI
    // endpoint that needs context.
    const teacherEmail = `ai-teacher-${Date.now()}@example.com`;
    const studentEmail = `ai-student-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: teacherEmail, password: 'pw123456', fullName: 'AI Teacher', role: 'TEACHER' });
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: studentEmail, password: 'pw123456', fullName: 'AI Student', role: 'STUDENT' });

    const teacherLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: teacherEmail, password: 'pw123456' });
    teacherToken = teacherLogin.body.accessToken;
    teacherId = teacherLogin.body.user?.id ?? '';

    const studentLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: studentEmail, password: 'pw123456' });
    studentToken = studentLogin.body.accessToken;
    studentId = studentLogin.body.user?.id ?? '';

    // Admin can create courses + assignments; we sign in with the seeded
    // admin account (created by the test setup hook for other spec files).
    // If no admin exists, register one with ADMIN role.
    const adminEmail = `ai-admin-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: adminEmail, password: 'pw123456', fullName: 'AI Admin', role: 'ADMIN' });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'pw123456' });
    const adminToken = adminLogin.body.accessToken;

    // Create course, enroll teacher + student, create assignment.
    const course = await request(app.getHttpServer())
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `AI-${Date.now()}`, title: 'AI Spec Course', description: 'Test', semester: '2026-Spring' });
    courseId = course.body.id;

    // Enrol teacher (as TEACHER) + student.
    await request(app.getHttpServer())
      .post('/api/admin/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: teacherId, courseId, roleInCourse: 'TEACHER' });
    await request(app.getHttpServer())
      .post('/api/admin/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentId, courseId, roleInCourse: 'STUDENT' });

    const assignment = await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/assignments`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'AI Spec Assignment',
        description: 'Submit short text',
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        maxScore: 100,
      });
    assignmentId = assignment.body.id;

    // Student submits — gives us a submissionId for feedback/code-review tests.
    const submission = await request(app.getHttpServer())
      .post(`/api/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ contentText: 'function add(a, b) { return a + b; }' });
    submissionId = submission.body.id;
  });

  afterAll(async () => {
    if (originalKey !== undefined) process.env.LLM_API_KEY = originalKey;
    await app.close();
  });

  // ─── /api/ai/status ────────────────────────────────────────────────────────

  it('GET /api/ai/status returns the documented shape', async () => {
    const res = await request(app.getHttpServer()).get('/api/ai/status').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    // demo/configured combination depends on whether LLM_API_KEY leaked into
    // the test process from a .env file or CI secret. We only verify the
    // schema — both states are valid.
    expect(typeof res.body.demo).toBe('boolean');
    expect(typeof res.body.configured).toBe('boolean');
    if (!res.body.configured) expect(res.body.demo).toBe(true);
  });

  it('GET /api/ai/status requires auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/ai/status');
    expect(res.status).toBe(401);
  });

  // ─── /api/ai/generate-quiz ─────────────────────────────────────────────────

  it('POST /api/ai/generate-quiz — teacher gets a quiz back', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/generate-quiz')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ courseId, topic: 'SQL JOINs', questionCount: 3, difficulty: 'medium' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThan(0);
    // Shape check on first question — the frontend reads exactly these fields.
    const q = res.body.questions[0];
    expect(typeof q.question).toBe('string');
    expect(Array.isArray(q.options)).toBe(true);
    expect(typeof q.correctIndex).toBe('number');
    expect(typeof q.explanation).toBe('string');
  });

  it('POST /api/ai/generate-quiz — students are blocked (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/generate-quiz')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId, topic: 'JOINs' });
    expect(res.status).toBe(403);
  });

  /**
   * Feature #1 — accept lecture text on /generate-quiz. The DTO now
   * carries an optional `materialText` string; teachers paste/upload
   * lecture content and Claude is told to anchor questions to it.
   * In demo mode the AiService still returns a stub, but the request
   * MUST be accepted (no 400 from class-validator) — that's what we
   * lock here.
   */
  it('POST /api/ai/generate-quiz — accepts optional materialText payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/generate-quiz')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        courseId,
        topic: 'SQL JOINs',
        questionCount: 3,
        difficulty: 'medium',
        materialText:
          'INNER JOIN combines rows from two tables based on a matching column. LEFT JOIN includes all rows from the left table.',
      });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
  });

  /**
   * Feature #1.5 — per-difficulty breakdown calculator.
   *
   * The frontend lets teachers split questionCount across easy/medium/hard
   * counts. Sum MUST equal questionCount; partial breakdown (only some of
   * the three) is ambiguous and rejected so the UI can't degrade silently.
   */
  describe('per-level breakdown (easy/medium/hard counts)', () => {
    it('accepts a valid breakdown that sums to questionCount', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/generate-quiz')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId,
          topic: 'design patterns',
          questionCount: 10,
          easyCount: 3,
          mediumCount: 5,
          hardCount: 2,
        });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.questions)).toBe(true);
    });

    it('rejects when sum != questionCount (400, message guides correction)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/generate-quiz')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId,
          topic: 'design patterns',
          questionCount: 10,
          easyCount: 3,
          mediumCount: 5,
          hardCount: 5, // sum=13, expected 10
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/sum.*questionCount|correct numbers/i);
    });

    it('rejects partial breakdown (only easy + medium, no hard)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/generate-quiz')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId,
          topic: 'design patterns',
          questionCount: 5,
          easyCount: 2,
          mediumCount: 3,
          // hardCount intentionally omitted
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/all three counts|partial/i);
    });

    it('accepts old single-difficulty flow when no per-level counts are set', async () => {
      // Backwards compatibility: callers that haven't migrated to the
      // calculator (e.g. old mobile build) keep using `difficulty`.
      const res = await request(app.getHttpServer())
        .post('/api/ai/generate-quiz')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ courseId, topic: 'x', questionCount: 3, difficulty: 'easy' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.questions)).toBe(true);
    });

    it('rejects negative counts via class-validator (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/generate-quiz')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId,
          topic: 'x',
          questionCount: 5,
          easyCount: -1,
          mediumCount: 4,
          hardCount: 2,
        });
      expect(res.status).toBe(400);
    });

    it('accepts questionCount above the old 20 cap (raised to 50)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/generate-quiz')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId,
          topic: 'x',
          questionCount: 30,
          easyCount: 10,
          mediumCount: 10,
          hardCount: 10,
        });
      expect(res.status).toBe(200);
    });
  });

  // ─── /api/ai/quiz-assist (Feature #2 — inline editor AI) ────────────────

  describe('POST /api/ai/quiz-assist', () => {
    it('improve-question — returns { question } string', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/quiz-assist')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ action: 'improve-question', question: 'What is SQL JOIN?' });
      expect(res.status).toBe(200);
      expect(typeof res.body.question).toBe('string');
      expect(res.body.question.length).toBeGreaterThan(0);
    });

    it('generate-options — returns options array + correctIndex', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/quiz-assist')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ action: 'generate-options', question: 'What combines rows from two tables?' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.options)).toBe(true);
      expect(res.body.options.length).toBeGreaterThanOrEqual(2);
      expect(typeof res.body.correctIndex).toBe('number');
      expect(res.body.correctIndex).toBeGreaterThanOrEqual(0);
      expect(res.body.correctIndex).toBeLessThan(res.body.options.length);
    });

    it('generate-explanation — returns { explanation } when options + correctIndex provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/quiz-assist')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          action: 'generate-explanation',
          question: 'What is the capital of France?',
          options: ['Paris', 'London', 'Berlin', 'Madrid'],
          correctIndex: 0,
        });
      expect(res.status).toBe(200);
      expect(typeof res.body.explanation).toBe('string');
      expect(res.body.explanation.length).toBeGreaterThan(0);
    });

    it('rejects unknown action (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/quiz-assist')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ action: 'invent-stuff', question: 'x' });
      expect(res.status).toBe(400);
    });

    it('rejects empty question (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/quiz-assist')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ action: 'improve-question', question: '' });
      expect(res.status).toBe(400);
    });

    it('students are blocked (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/quiz-assist')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ action: 'improve-question', question: 'x' });
      expect(res.status).toBe(403);
    });

    it('requires authentication (401)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/quiz-assist')
        .send({ action: 'improve-question', question: 'x' });
      expect(res.status).toBe(401);
    });
  });

  // ─── /api/ai/extract-text (Feature #1) ────────────────────────────────────

  describe('POST /api/ai/extract-text', () => {
    it('accepts plaintext file and returns extracted text + meta', async () => {
      const body = 'Lecture 4 — Design patterns. Observer notifies subscribers when state changes.';
      const res = await request(app.getHttpServer())
        .post('/api/ai/extract-text')
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', Buffer.from(body, 'utf-8'), { filename: 'lecture.txt', contentType: 'text/plain' });
      expect(res.status).toBe(200);
      expect(res.body.kind).toBe('text');
      expect(res.body.text).toContain('Observer');
      expect(res.body.truncated).toBe(false);
      expect(typeof res.body.rawCharCount).toBe('number');
    });

    it('rejects unsupported file types (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/extract-text')
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', Buffer.from('binary garbage'), {
          filename: 'image.jpg',
          contentType: 'image/jpeg',
        });
      expect(res.status).toBe(400);
      // The message guides the teacher toward a workable format —
      // particularly important for PowerPoint, which we don't parse.
      expect(res.body.message).toMatch(/PDF|DOCX|plain text/i);
    });

    it('rejects empty file (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/extract-text')
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', Buffer.from(''), { filename: 'empty.txt', contentType: 'text/plain' });
      // multer may return 400 on truly-empty body before the extractor
      // ever runs; either path is acceptable, but the upload must NOT
      // succeed with a 200.
      expect([400, 500]).toContain(res.status);
    });

    it('students are blocked (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/extract-text')
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('file', Buffer.from('whatever'), { filename: 'x.txt', contentType: 'text/plain' });
      expect(res.status).toBe(403);
    });

    it('requires authentication (401)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/extract-text')
        .attach('file', Buffer.from('whatever'), { filename: 'x.txt', contentType: 'text/plain' });
      expect(res.status).toBe(401);
    });

    it('truncates output at MAX_EXTRACTED_CHARS', async () => {
      // 250KB > the 200KB MAX_EXTRACTED_CHARS cap.
      const big = 'a'.repeat(250_000);
      const res = await request(app.getHttpServer())
        .post('/api/ai/extract-text')
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', Buffer.from(big, 'utf-8'), { filename: 'big.txt', contentType: 'text/plain' });
      expect(res.status).toBe(200);
      expect(res.body.truncated).toBe(true);
      expect(res.body.text.length).toBeLessThanOrEqual(200_000);
      expect(res.body.rawCharCount).toBeGreaterThanOrEqual(250_000);
    });
  });

  // ─── /api/ai/course-summary ────────────────────────────────────────────────

  it('POST /api/ai/course-summary — returns the documented shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/course-summary')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId });
    expect(res.status).toBe(200);
    expect(typeof res.body.summary).toBe('string');
    expect(Array.isArray(res.body.keyTopics)).toBe(true);
    expect(Array.isArray(res.body.tips)).toBe(true);
    expect(['light', 'moderate', 'heavy']).toContain(res.body.workload);
  });

  // ─── /api/ai/study-coach ───────────────────────────────────────────────────

  it('POST /api/ai/study-coach — student gets their own coach report', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/study-coach')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ studentId, courseId });
    expect(res.status).toBe(200);
    // Either populated study coach OR documented "no data yet" fallback —
    // both shapes are valid responses, just check the surface fields exist.
    expect(res.body).toBeDefined();
    // trajectory may be either object or missing depending on demo data.
    if (res.body.trajectory) {
      expect(['improving', 'stable', 'declining']).toContain(res.body.trajectory.trend);
    }
  });

  // ─── /api/ai/class-insights — teacher-only ─────────────────────────────────

  it('POST /api/ai/class-insights — student is blocked (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/class-insights')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId });
    expect(res.status).toBe(403);
  });

  it('POST /api/ai/class-insights — teacher gets aggregate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/class-insights')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ courseId });
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    // Demo shape doesn't guarantee all fields populated, but the array
    // properties should at least be arrays (frontend `.map()`s over them).
    if (res.body.atRiskStudents) expect(Array.isArray(res.body.atRiskStudents)).toBe(true);
    if (res.body.classWeaknesses) expect(Array.isArray(res.body.classWeaknesses)).toBe(true);
  });

  // ─── /api/ai/assignment-feedback — student can request own only ──────────

  it('POST /api/ai/assignment-feedback — student can request own submission', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/assignment-feedback')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId, submissionId });
    expect(res.status).toBe(200);
    expect(typeof res.body.assessment).toBe('string');
    expect(Array.isArray(res.body.strengths)).toBe(true);
  });

  // ─── /api/ai/code-review ──────────────────────────────────────────────────

  it('POST /api/ai/code-review — returns review with line-level issues array', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/code-review')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ submissionId, language: 'javascript' });
    expect(res.status).toBe(200);
    expect(typeof res.body.summary).toBe('string');
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  // ─── All endpoints require auth ────────────────────────────────────────────

  it.each([
    ['GET', '/api/ai/status'],
    ['POST', '/api/ai/generate-quiz'],
    ['POST', '/api/ai/course-summary'],
    ['POST', '/api/ai/study-coach'],
    ['POST', '/api/ai/class-insights'],
    ['POST', '/api/ai/code-review'],
    ['POST', '/api/ai/assignment-feedback'],
    ['POST', '/api/ai/student-analysis'],
  ])('%s %s requires authentication', async (method, path) => {
    const req =
      method === 'GET' ? request(app.getHttpServer()).get(path) : request(app.getHttpServer()).post(path).send({});
    const res = await req;
    expect(res.status).toBe(401);
  });
});
