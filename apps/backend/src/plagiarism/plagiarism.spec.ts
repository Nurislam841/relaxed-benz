import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('Plagiarism (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let studentATok: string;
  let studentBTok: string;
  let studentCTok: string;
  let studentAId: string;
  let studentBId: string;
  let studentCId: string;
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

    const reg = async (prefix: string, role: 'ADMIN' | 'STUDENT') => {
      const email = `${prefix}-${Date.now()}-${Math.random()}@example.com`;
      const r = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'pw123456', fullName: `${prefix} User`, role });
      const l = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'pw123456' });
      return { id: r.body.user.id, token: l.body.accessToken };
    };

    const admin = await reg('plag-admin', 'ADMIN');
    adminToken = admin.token;
    const sA = await reg('plag-s-a', 'STUDENT');
    studentAId = sA.id;
    studentATok = sA.token;
    const sB = await reg('plag-s-b', 'STUDENT');
    studentBId = sB.id;
    studentBTok = sB.token;
    const sC = await reg('plag-s-c', 'STUDENT');
    studentCId = sC.id;
    studentCTok = sC.token;

    const course = await request(app.getHttpServer())
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `PLG-${Date.now()}`, title: 'Plagiarism Course', semester: '2025-Spring' });
    courseId = course.body.id;

    for (const sid of [studentAId, studentBId, studentCId]) {
      await request(app.getHttpServer())
        .post('/api/admin/enrollments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: sid, courseId, roleInCourse: 'STUDENT' });
    }

    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const asg = await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Essay', dueAt, maxScore: 100 });
    assignmentId = asg.body.id;

    // Two near-identical submissions, one completely different
    const sharedText =
      'The mitochondria is the powerhouse of the cell. It generates most of the chemical energy needed to power cellular biochemical reactions. ' +
      'Chemical energy produced by the mitochondria is stored in a small molecule called adenosine triphosphate ATP. ' +
      'Mitochondria are found in nearly all eukaryotic cells and vary in number depending on cell type.';

    const slightVariation =
      'The mitochondria is the powerhouse of a cell. It generates most of the chemical energy needed to power cellular biochemical reactions. ' +
      'Chemical energy produced inside the mitochondria is stored in a small molecule called adenosine triphosphate ATP. ' +
      'Mitochondria are found in nearly all eukaryotic cells and they vary in number depending on cell type.';

    const totallyDifferent =
      'Photosynthesis is the process by which green plants and certain other organisms use sunlight to synthesize foods from carbon dioxide and water. ' +
      'It occurs primarily in plant leaves and uses chlorophyll inside chloroplasts to convert light energy. ' +
      'This is fundamentally different from cellular respiration which happens in animal mitochondria.';

    await request(app.getHttpServer())
      .post(`/api/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${studentATok}`)
      .send({ contentText: sharedText });

    await request(app.getHttpServer())
      .post(`/api/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${studentBTok}`)
      .send({ contentText: slightVariation });

    await request(app.getHttpServer())
      .post(`/api/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${studentCTok}`)
      .send({ contentText: totallyDifferent });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/assignments/:id/check-plagiarism — admin runs the check', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/assignments/${assignmentId}/check-plagiarism`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(201);
    expect(res.body.submissionsAnalyzed).toBe(3);
    expect(res.body.pairsFound).toBeGreaterThanOrEqual(1); // A↔B should be > threshold
    expect(res.body.methodVersion).toBe('jaccard-3gram-v1');
  });

  it('POST /api/assignments/:id/check-plagiarism — student gets 403', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/assignments/${assignmentId}/check-plagiarism`)
      .set('Authorization', `Bearer ${studentATok}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/assignments/:id/plagiarism-reports — admin sees suspicious pair', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/assignments/${assignmentId}/plagiarism-reports`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].similarity).toBeGreaterThan(0.5); // near-duplicate must be > 50%
  });
});
