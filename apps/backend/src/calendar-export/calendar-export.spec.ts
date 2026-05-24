import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { buildIcs } from './ics-builder';

describe('Calendar export (e2e + unit)', () => {
  // ── Unit tests for the iCalendar builder ──────────────────────────────
  describe('buildIcs', () => {
    it('emits a syntactically valid VCALENDAR envelope', () => {
      const ics = buildIcs([], 'Test calendar');
      expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
      expect(ics).toMatch(/END:VCALENDAR\r\n$/);
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//UniLMS//Schedule Export 1.0//EN');
      expect(ics).toContain('CALSCALE:GREGORIAN');
    });

    it('renders an event with required RFC 5545 properties', () => {
      const ics = buildIcs(
        [
          {
            uid: 'evt-1@unilms',
            start: new Date('2026-05-22T10:00:00Z'),
            end: new Date('2026-05-22T11:30:00Z'),
            summary: 'LECTURE: CS101 — Programming',
            location: 'Room 305',
            description: 'Week 5 lecture',
          },
        ],
        'My calendar',
      );
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('UID:evt-1@unilms');
      expect(ics).toContain('DTSTART:20260522T100000Z');
      expect(ics).toContain('DTEND:20260522T113000Z');
      expect(ics).toContain('SUMMARY:LECTURE: CS101 — Programming');
      expect(ics).toContain('LOCATION:Room 305');
      expect(ics).toContain('END:VEVENT');
    });

    it('escapes commas, semicolons, and newlines in TEXT fields', () => {
      const ics = buildIcs(
        [
          {
            uid: 'evt-2',
            start: new Date('2026-05-22T10:00:00Z'),
            end: new Date('2026-05-22T11:00:00Z'),
            summary: 'Lab; with, special\nchars',
          },
        ],
        'Tricky title; with, comma',
      );
      // Per RFC 5545: ; , \n must be backslash-escaped inside TEXT property values
      expect(ics).toContain('SUMMARY:Lab\\; with\\, special\\nchars');
      expect(ics).toContain('X-WR-CALNAME:Tricky title\\; with\\, comma');
    });
  });

  // ── HTTP endpoint test ────────────────────────────────────────────────
  describe('GET /api/me/schedule.ics', () => {
    let app: INestApplication;
    let token: string;

    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api');
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      await app.init();

      const email = `cal-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'pw123456', fullName: 'Cal User', role: 'STUDENT' });
      const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'pw123456' });
      token = login.body.accessToken;
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns text/calendar with VCALENDAR envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/me/schedule.ics')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/calendar/);
      expect(res.headers['content-disposition']).toMatch(/unilms-schedule\.ics/);
      const body = res.text;
      expect(body).toMatch(/^BEGIN:VCALENDAR\r\n/);
      expect(body).toMatch(/END:VCALENDAR\r\n$/);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app.getHttpServer()).get('/api/me/schedule.ics');
      expect(res.status).toBe(401);
    });
  });
});
