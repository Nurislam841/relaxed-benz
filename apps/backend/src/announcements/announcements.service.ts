import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './announcements.dto';
import { Role, CourseRole, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

const INC = { author: { select: { fullName: true } }, course: { select: { id: true, code: true, title: true } } };

@Injectable()
export class AnnouncementsService {
  constructor(
    private db: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findForUser(user: { id: string; role: Role }) {
    if (user.role === Role.ADMIN)
      return this.db.announcement.findMany({ include: INC, orderBy: { createdAt: 'desc' }, take: 50 });
    const cids = (await this.db.enrollment.findMany({ where: { userId: user.id }, select: { courseId: true } })).map(
      (e) => e.courseId,
    );
    return this.db.announcement.findMany({
      where: { OR: [{ courseId: null }, { courseId: { in: cids } }] },
      include: INC,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  findByCourse(courseId: string) {
    return this.db.announcement.findMany({
      where: { courseId },
      include: { author: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateAnnouncementDto, user: { id: string; role: Role }) {
    if (!dto.courseId && user.role !== Role.ADMIN) throw new ForbiddenException('Only admins can post global');
    if (dto.courseId && user.role === Role.TEACHER) {
      if (
        !(await this.db.enrollment.findFirst({
          where: { userId: user.id, courseId: dto.courseId, roleInCourse: CourseRole.TEACHER },
        }))
      )
        throw new ForbiddenException('Not teacher of this course');
    }
    const ann = await this.db.announcement.create({
      data: { title: dto.title, body: dto.body, courseId: dto.courseId || null, authorId: user.id },
      include: INC,
    });
    if (dto.courseId) {
      const enrs = await this.db.enrollment.findMany({
        where: { courseId: dto.courseId, roleInCourse: CourseRole.STUDENT },
        select: { userId: true },
      });
      if (enrs.length) {
        await this.notifications.createMany(
          enrs.map((e) => ({
            userId: e.userId,
            type: NotificationType.ANNOUNCEMENT,
            title: 'New: ' + (ann.course?.title ?? ''),
            body: dto.title,
            link: '/courses/' + dto.courseId + '/overview',
          })),
        );
      }
      // Also broadcast to a bound Telegram group chat (Phase 4.2). Per-user
      // DMs above stay enabled — students who linked individually still get
      // pinged, the group post just adds a class-wide visibility layer.
      await this.notifications.broadcastToCourseGroup(
        dto.courseId,
        'New: ' + (ann.course?.title ?? ''),
        dto.title,
        '/courses/' + dto.courseId + '/overview',
      );
    }
    return ann;
  }
}
