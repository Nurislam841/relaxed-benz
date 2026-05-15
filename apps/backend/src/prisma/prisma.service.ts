import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Models that participate in soft delete (have a `deletedAt` column).
 * Anything not in this list keeps the default Prisma behavior (physical delete).
 *
 * IMPORTANT: keep this in sync with the Prisma schema. Adding a model here
 * without adding the column first will cause runtime errors.
 */
const SOFT_DELETE_MODELS = new Set<Prisma.ModelName>([
  'User',
  'Group',
  'Course',
  'CourseMaterial',
  'Enrollment',
  'Announcement',
  'Assignment',
  'AssignmentResource',
  'AssignmentComment',
  'ScheduleItem',
  'Quiz',
  'QuizQuestion',
]);

/**
 * Internal flag to opt out of the middleware for a single query — used when
 * we genuinely need to read soft-deleted rows (e.g. admin restore screen).
 *
 * Usage: `prisma.user.findMany({ where: { ...({ __includeDeleted: true } as any) } })`
 */
const ESCAPE_HATCH = '__includeDeleted';

/**
 * Add `deletedAt: null` to a where clause without overwriting user filters.
 * Handles `AND`, `OR`, `NOT` and bare keys safely.
 */
function withAlive(where: any): any {
  if (!where || typeof where !== 'object') return { deletedAt: null };
  // Honor escape hatch
  if (where[ESCAPE_HATCH]) {
    const { [ESCAPE_HATCH]: _, ...rest } = where;
    return rest;
  }
  // User already filters by deletedAt explicitly — respect it
  if ('deletedAt' in where) return where;
  return { ...where, deletedAt: null };
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    this.installSoftDeleteMiddleware();
  }

  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }

  private installSoftDeleteMiddleware() {
    this.$use(async (params, next) => {
      const model = params.model as Prisma.ModelName | undefined;
      if (!model || !SOFT_DELETE_MODELS.has(model)) {
        return next(params);
      }

      // 1) Rewrite delete → update({ deletedAt: now })
      if (params.action === 'delete') {
        params.action = 'update';
        params.args = {
          ...params.args,
          data: { deletedAt: new Date() },
        };
      } else if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        params.args = {
          ...params.args,
          data: { ...(params.args?.data ?? {}), deletedAt: new Date() },
        };
      }

      // 2) Add `deletedAt: null` to read filters so soft-deleted rows disappear.
      //    `update` is intentionally NOT filtered here because Prisma's `update`
      //    requires a unique WHERE clause and `deletedAt` is not unique.
      //    `updateMany` is filtered.
      const readActions: Prisma.PrismaAction[] = [
        'findFirst', 'findFirstOrThrow',
        'findMany',
        'count', 'aggregate', 'groupBy',
      ];

      if (readActions.includes(params.action)) {
        params.args = { ...params.args, where: withAlive(params.args?.where) };
      } else if (params.action === 'updateMany') {
        const settingDeletedAt = params.args?.data?.deletedAt !== undefined;
        if (!settingDeletedAt) {
          params.args = { ...params.args, where: withAlive(params.args?.where) };
        }
      } else if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
        // findUnique uses a unique constraint as WHERE — we can't merge
        // `deletedAt: null` into a unique clause cleanly. Promote to findFirst
        // and flatten composite keys (e.g. `userId_courseId: {...}`) into
        // their component fields, which findFirst accepts.
        params.action = (params.action === 'findUnique' ? 'findFirst' : 'findFirstOrThrow') as Prisma.PrismaAction;
        const where = params.args?.where ?? {};
        const flattened: any = {};
        for (const [key, value] of Object.entries(where)) {
          if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            // Composite unique key like `userId_courseId: { userId, courseId }` — spread fields up
            Object.assign(flattened, value);
          } else {
            flattened[key] = value;
          }
        }
        params.args = { ...params.args, where: withAlive(flattened) };
      }

      return next(params);
    });
  }
}
