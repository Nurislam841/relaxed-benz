import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Two search strategies:
 *
 *  1. Full-text via Postgres tsvector + GIN — used when the query has ≥ 3
 *     characters. Returns results ranked by `ts_rank` so title/code matches
 *     surface first. Stop-words and case are handled by the dictionary.
 *
 *  2. Legacy ILIKE fallback — used for short queries (1-2 chars), where
 *     tsvector would return junk because the prefix matcher needs whole
 *     tokens. ILIKE on small data is still cheap; we cap at 10 per kind.
 *
 * The return shape is identical for both paths so callers (frontend) don't
 * need to know which strategy ran.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private db: PrismaService) {}

  async search(q: string, userId: string, userRole: string) {
    const empty = { courses: [], materials: [], assignments: [], announcements: [], users: [] };
    if (!q || q.trim().length < 2) return empty;

    const term = q.trim();
    const isAdmin = userRole === 'ADMIN';

    // Short queries (< 3 chars) — keep the ILIKE path so users typing
    // "AI" or "JS" still see relevant results immediately.
    if (term.length < 3) {
      return this.searchIlike(term, userId, isAdmin);
    }

    try {
      return await this.searchTsvector(term, userId, isAdmin);
    } catch (e: any) {
      // If the migration hasn't run yet (e.g. fresh test DB), fall back to
      // ILIKE so the endpoint still responds correctly.
      this.logger.warn(`tsvector search failed (${e.message}) — falling back to ILIKE`);
      return this.searchIlike(term, userId, isAdmin);
    }
  }

  /** plainto_tsquery handles whitespace + AND-joins terms naturally. */
  private async searchTsvector(term: string, userId: string, isAdmin: boolean) {
    const queryParam = Prisma.sql`plainto_tsquery('simple', ${term})`;

    const [courses, materials, assignments, announcements, users] = await Promise.all([
      this.db.$queryRaw<
        Array<{ id: string; code: string; title: string; description: string; rank: number }>
      >(Prisma.sql`
        SELECT c.id, c.code, c.title, c.description,
               ts_rank(c."search_vector", ${queryParam}) AS rank
        FROM "courses" c
        WHERE c."search_vector" @@ ${queryParam}
          ${
            isAdmin
              ? Prisma.empty
              : Prisma.sql`
            AND EXISTS (
              SELECT 1 FROM "enrollments" e
              WHERE e."course_id" = c.id AND e."user_id" = ${userId} AND e."deleted_at" IS NULL
            )`
          }
        ORDER BY rank DESC, c."created_at" DESC
        LIMIT 10
      `),

      this.db.$queryRaw<
        Array<{
          id: string;
          courseId: string;
          title: string;
          type: string;
          url: string | null;
          courseCode: string;
          courseTitle: string;
          rank: number;
        }>
      >(Prisma.sql`
        SELECT m.id, m."course_id" AS "courseId", m.title, m.type, m.url,
               c.code AS "courseCode", c.title AS "courseTitle",
               ts_rank(m."search_vector", ${queryParam}) AS rank
        FROM "course_materials" m
        JOIN "courses" c ON c.id = m."course_id"
        WHERE m."search_vector" @@ ${queryParam}
          ${
            isAdmin
              ? Prisma.empty
              : Prisma.sql`
            AND EXISTS (
              SELECT 1 FROM "enrollments" e
              WHERE e."course_id" = m."course_id" AND e."user_id" = ${userId} AND e."deleted_at" IS NULL
            )`
          }
        ORDER BY rank DESC, m."created_at" DESC
        LIMIT 10
      `),

      this.db.$queryRaw<
        Array<{
          id: string;
          courseId: string;
          title: string;
          description: string;
          dueAt: Date;
          courseCode: string;
          courseTitle: string;
          rank: number;
        }>
      >(Prisma.sql`
        SELECT a.id, a."course_id" AS "courseId", a.title, a.description, a."due_at" AS "dueAt",
               c.code AS "courseCode", c.title AS "courseTitle",
               ts_rank(a."search_vector", ${queryParam}) AS rank
        FROM "assignments" a
        JOIN "courses" c ON c.id = a."course_id"
        WHERE a."search_vector" @@ ${queryParam}
          AND a."deleted_at" IS NULL
          ${
            isAdmin
              ? Prisma.empty
              : Prisma.sql`
            AND EXISTS (
              SELECT 1 FROM "enrollments" e
              WHERE e."course_id" = a."course_id" AND e."user_id" = ${userId} AND e."deleted_at" IS NULL
            )`
          }
        ORDER BY rank DESC, a."due_at" ASC
        LIMIT 10
      `),

      this.db.$queryRaw<
        Array<{
          id: string;
          title: string;
          body: string;
          courseId: string | null;
          createdAt: Date;
          courseCode: string | null;
          courseTitle: string | null;
          rank: number;
        }>
      >(Prisma.sql`
        SELECT an.id, an.title, an.body, an."course_id" AS "courseId", an."created_at" AS "createdAt",
               c.code AS "courseCode", c.title AS "courseTitle",
               ts_rank(an."search_vector", ${queryParam}) AS rank
        FROM "announcements" an
        LEFT JOIN "courses" c ON c.id = an."course_id"
        WHERE an."search_vector" @@ ${queryParam}
          AND an."deleted_at" IS NULL
          ${
            isAdmin
              ? Prisma.empty
              : Prisma.sql`
            AND (
              an."course_id" IS NULL OR EXISTS (
                SELECT 1 FROM "enrollments" e
                WHERE e."course_id" = an."course_id" AND e."user_id" = ${userId} AND e."deleted_at" IS NULL
              )
            )`
          }
        ORDER BY rank DESC, an."created_at" DESC
        LIMIT 8
      `),

      isAdmin
        ? this.db.$queryRaw<
            Array<{ id: string; fullName: string; email: string; role: string; rank: number }>
          >(Prisma.sql`
            SELECT u.id, u."full_name" AS "fullName", u.email, u.role,
                   ts_rank(u."search_vector", ${queryParam}) AS rank
            FROM "users" u
            WHERE u."search_vector" @@ ${queryParam}
              AND u."deleted_at" IS NULL
            ORDER BY rank DESC, u."created_at" DESC
            LIMIT 8
          `)
        : Promise.resolve([] as any[]),
    ]);

    return {
      courses: courses.map(({ rank, ...r }) => r),
      materials: materials.map(({ rank, courseCode, courseTitle, ...r }) => ({
        ...r,
        course: { code: courseCode, title: courseTitle },
      })),
      assignments: assignments.map(({ rank, courseCode, courseTitle, ...r }) => ({
        ...r,
        course: { code: courseCode, title: courseTitle },
      })),
      announcements: announcements.map(({ rank, courseCode, courseTitle, ...r }) => ({
        ...r,
        course: r.courseId ? { code: courseCode, title: courseTitle } : null,
      })),
      users: users.map(({ rank, ...r }: any) => r),
    };
  }

  /** Legacy ILIKE search — used for short queries and as fallback. */
  private async searchIlike(term: string, userId: string, isAdmin: boolean) {
    const courseFilter = isAdmin ? {} : { enrollments: { some: { userId } } };
    const annFilter = isAdmin ? {} : { OR: [{ courseId: null }, { course: { enrollments: { some: { userId } } } }] };

    const [courses, materials, assignments, announcements, users] = await Promise.all([
      this.db.course.findMany({
        where: {
          ...courseFilter,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { code: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: { id: true, code: true, title: true, description: true },
        take: 10,
      }),
      this.db.courseMaterial.findMany({
        where: {
          course: courseFilter,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { content: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          courseId: true,
          title: true,
          type: true,
          url: true,
          course: { select: { code: true, title: true } },
        },
        take: 10,
      }),
      this.db.assignment.findMany({
        where: {
          course: courseFilter,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          courseId: true,
          title: true,
          description: true,
          dueAt: true,
          course: { select: { code: true, title: true } },
        },
        take: 10,
      }),
      this.db.announcement.findMany({
        where: {
          AND: [
            annFilter as any,
            {
              OR: [
                { title: { contains: term, mode: 'insensitive' } },
                { body: { contains: term, mode: 'insensitive' } },
              ],
            },
          ],
        },
        select: {
          id: true,
          title: true,
          body: true,
          courseId: true,
          createdAt: true,
          course: { select: { code: true, title: true } },
        },
        take: 8,
      }),
      isAdmin
        ? this.db.user.findMany({
            where: {
              OR: [
                { fullName: { contains: term, mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
              ],
            },
            select: { id: true, fullName: true, email: true, role: true },
            take: 8,
          })
        : Promise.resolve([]),
    ]);

    return { courses, materials, assignments, announcements, users };
  }
}
