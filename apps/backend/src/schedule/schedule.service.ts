import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleItemDto, UpdateScheduleItemDto } from './schedule.dto';
import { Role, CourseRole } from '@prisma/client';

@Injectable()
export class ScheduleService {
  constructor(private db: PrismaService) {}

  async getMySchedule(user: { id: string; role: Role; groupId?: string | null }, from: string, to: string) {
    const f = new Date(from), t = new Date(to);
    if (user.role === Role.ADMIN)
      return this.db.scheduleItem.findMany({ where: { startsAt: { gte: f, lte: t } }, include: { course: { select: { id: true, code: true, title: true } }, group: { select: { name: true } } }, orderBy: { startsAt: 'asc' } });
    const cids = (await this.db.enrollment.findMany({ where: { userId: user.id }, select: { courseId: true } })).map(e => e.courseId);
    const gf = user.groupId ? [{ groupId: null }, { groupId: user.groupId }] : [{ groupId: null }];
    return this.db.scheduleItem.findMany({ where: { courseId: { in: cids }, startsAt: { gte: f, lte: t }, OR: gf }, include: { course: { select: { id: true, code: true, title: true } }, group: { select: { name: true } } }, orderBy: { startsAt: 'asc' } });
  }

  getCourseSchedule(cid: string, from?: string, to?: string) {
    const w: any = { courseId: cid }; if (from && to) w.startsAt = { gte: new Date(from), lte: new Date(to) };
    return this.db.scheduleItem.findMany({ where: w, include: { group: { select: { name: true } } }, orderBy: { startsAt: 'asc' } });
  }

  async create(cid: string, dto: CreateScheduleItemDto, user: { id: string; role: Role }) {
    if (user.role === Role.TEACHER && !(await this.db.enrollment.findFirst({ where: { userId: user.id, courseId: cid, roleInCourse: CourseRole.TEACHER } })))
      throw new ForbiddenException('Not teacher');
    return this.db.scheduleItem.create({ data: { courseId: cid, startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt), room: dto.room, type: dto.type, groupId: dto.groupId || null }, include: { course: { select: { id: true, code: true, title: true } } } });
  }

  async getCalendar(user: { id: string; role: Role }, month: string) {
    const [y, m] = month.split('-').map(Number);
    const from = new Date(y, m - 1, 1), to = new Date(y, m, 0, 23, 59, 59);
    const cids = user.role === Role.ADMIN ? undefined : (await this.db.enrollment.findMany({ where: { userId: user.id }, select: { courseId: true } })).map(e => e.courseId);
    const cw = cids ? { courseId: { in: cids } } : {};
    const [si, as] = await Promise.all([
      this.db.scheduleItem.findMany({ where: { ...cw, startsAt: { gte: from, lte: to } }, include: { course: { select: { id: true, code: true, title: true } } }, orderBy: { startsAt: 'asc' } }),
      this.db.assignment.findMany({ where: { ...cw, dueAt: { gte: from, lte: to } }, include: { course: { select: { id: true, code: true, title: true } } }, orderBy: { dueAt: 'asc' } }),
    ]);
    return { scheduleItems: si, assignments: as };
  }

  /**
   * Admin/teacher full list view used by the new `/admin/schedule` editor.
   * Supports optional filtering by course or group, returns everything
   * ordered chronologically with both course and group joined in.
   */
  async listAll(filter: { courseId?: string; groupId?: string } = {}) {
    const where: any = {};
    if (filter.courseId) where.courseId = filter.courseId;
    if (filter.groupId) where.groupId = filter.groupId;
    return this.db.scheduleItem.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, title: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async update(id: string, dto: UpdateScheduleItemDto, user: { id: string; role: Role }) {
    const item = await this.db.scheduleItem.findUnique({
      where: { id },
      include: { course: { select: { teacherId: true } } },
    });
    if (!item) throw new NotFoundException('Schedule item not found');

    if (user.role === Role.TEACHER) {
      // Teachers may only modify schedule items for courses they teach.
      const isCourseTeacher = item.course?.teacherId === user.id;
      const isEnrolledTeacher = await this.db.enrollment.findFirst({
        where: { userId: user.id, courseId: item.courseId, roleInCourse: CourseRole.TEACHER },
      });
      if (!isCourseTeacher && !isEnrolledTeacher) throw new ForbiddenException('Not teacher of this course');
    }

    const data: any = {};
    if (dto.startsAt !== undefined) data.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = new Date(dto.endsAt);
    if (dto.room !== undefined) data.room = dto.room;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.groupId !== undefined) data.groupId = dto.groupId || null;

    return this.db.scheduleItem.update({
      where: { id },
      data,
      include: {
        course: { select: { id: true, code: true, title: true } },
        group: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string, user: { id: string; role: Role }) {
    const item = await this.db.scheduleItem.findUnique({
      where: { id },
      include: { course: { select: { teacherId: true } } },
    });
    if (!item) throw new NotFoundException('Schedule item not found');

    if (user.role === Role.TEACHER) {
      const isCourseTeacher = item.course?.teacherId === user.id;
      const isEnrolledTeacher = await this.db.enrollment.findFirst({
        where: { userId: user.id, courseId: item.courseId, roleInCourse: CourseRole.TEACHER },
      });
      if (!isCourseTeacher && !isEnrolledTeacher) throw new ForbiddenException('Not teacher of this course');
    }

    // Soft delete via PrismaService middleware — record stays in DB with deletedAt set.
    await this.db.scheduleItem.delete({ where: { id } });
    return { deleted: true };
  }
}
