import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAssignmentDto,
  UpdateAssignmentDto,
  SubmitDto,
  GradeDto,
  CreateCommentDto,
  SaveDraftDto,
} from './assignments.dto';
import { Role, CourseRole, SubmissionStatus, NotificationType } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { getPagination, toPaginatedResult } from '../common/pagination';
import { getAssignmentNotificationContent, getGradeNotificationContent } from '../common/user-content';

@Injectable()
export class AssignmentsService {
  constructor(
    private db: PrismaService,
    private activityLog: ActivityLogService,
    private mail: MailService,
    private notifications: NotificationsService,
    private storage: StorageService,
  ) {}

  async findByCourse(cid: string, page?: number, limit?: number) {
    const pagination = getPagination(page, limit);
    const baseQuery = {
      where: { courseId: cid },
      orderBy: { dueAt: 'asc' },
      include: { _count: { select: { submissions: true } }, resources: true },
    } as const;

    if (!pagination.usePagination) {
      return this.db.assignment.findMany(baseQuery);
    }

    const [items, total] = await this.db.$transaction([
      this.db.assignment.findMany({
        ...baseQuery,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.db.assignment.count({ where: { courseId: cid } }),
    ]);

    return toPaginatedResult(items, pagination.page, pagination.limit, total);
  }

  async findOne(id: string) {
    const a = await this.db.assignment.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true, code: true } },
        _count: { select: { submissions: true } },
        resources: true,
      },
    });
    if (!a) throw new NotFoundException();
    return a;
  }

  async create(cid: string, dto: CreateAssignmentDto, user: { id: string; role: Role }) {
    if (
      user.role === Role.TEACHER &&
      !(await this.db.enrollment.findFirst({
        where: { userId: user.id, courseId: cid, roleInCourse: CourseRole.TEACHER },
      }))
    )
      throw new ForbiddenException('errors.common.notTeacher');

    const assignment = await this.db.assignment.create({
      data: {
        courseId: cid,
        title: dto.title,
        description: dto.description ?? '',
        dueAt: new Date(dto.dueAt),
        maxScore: dto.maxScore ?? 100,
      },
      include: { course: { select: { title: true } } },
    });

    await this.activityLog.log(user.id, 'CREATE', 'Assignment', assignment.id);

    // Notify enrolled students
    const enrollments = await this.db.enrollment.findMany({
      where: { courseId: cid, roleInCourse: CourseRole.STUDENT },
      include: { user: { select: { id: true, email: true, preferredLang: true } } },
    });

    await Promise.all(
      enrollments.map(async (e) => {
        const notification = getAssignmentNotificationContent(
          dto.title,
          assignment.course?.title || '',
          new Date(dto.dueAt),
          e.user.preferredLang,
        );
        await this.notifications.create({
          userId: e.userId,
          type: NotificationType.ASSIGNMENT_DUE,
          title: notification.title,
          body: notification.body,
          link: '/courses/' + cid + '/assignments',
        });
        await this.mail.sendAssignmentCreated(
          e.user.email,
          dto.title,
          assignment.course?.title || '',
          new Date(dto.dueAt),
          e.user.preferredLang,
        );
      }),
    );

    return assignment;
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    await this.findOne(id);
    const d: any = { ...dto };
    if (dto.dueAt) d.dueAt = new Date(dto.dueAt);
    return this.db.assignment.update({ where: { id }, data: d });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.assignment.delete({ where: { id } });
    return { deleted: true };
  }

  async submit(aid: string, dto: SubmitDto, sid: string) {
    await this.findOne(aid);
    const ex = await this.db.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId: aid, studentId: sid } },
    });
    const sub = ex
      ? await this.db.submission.update({
          where: { id: ex.id },
          data: {
            contentText: dto.contentText,
            contentUrl: dto.contentUrl,
            fileUrl: dto.fileUrl,
            status: SubmissionStatus.SUBMITTED,
            submittedAt: new Date(),
          },
        })
      : await this.db.submission.create({
          data: {
            assignmentId: aid,
            studentId: sid,
            contentText: dto.contentText,
            contentUrl: dto.contentUrl,
            fileUrl: dto.fileUrl,
            status: SubmissionStatus.SUBMITTED,
            submittedAt: new Date(),
          },
        });

    await this.activityLog.log(sid, 'SUBMIT', 'Submission', sub.id);
    return sub;
  }

  getMySub(aid: string, sid: string) {
    return this.db.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId: aid, studentId: sid } },
      include: { grade: true, attachments: true },
    });
  }

  allSubs(aid: string) {
    return this.db.submission.findMany({
      where: { assignmentId: aid },
      include: { student: { select: { id: true, fullName: true, email: true } }, grade: true, attachments: true },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getSubById(id: string) {
    const sub = await this.db.submission.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        grade: { include: { gradedBy: { select: { id: true, fullName: true } } } },
        attachments: true,
        assignment: {
          select: {
            id: true,
            title: true,
            maxScore: true,
            dueAt: true,
            courseId: true,
            course: { select: { id: true, title: true, code: true } },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException();
    return sub;
  }

  async getMySubmissionsForCourse(courseId: string, studentId: string) {
    const assignments = await this.db.assignment.findMany({ where: { courseId }, select: { id: true } });
    const ids = assignments.map((a) => a.id);
    return this.db.submission.findMany({
      where: { assignmentId: { in: ids }, studentId },
      include: { grade: true, attachments: true },
    });
  }

  async saveDraft(aid: string, dto: SaveDraftDto, sid: string) {
    await this.findOne(aid);
    const ex = await this.db.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId: aid, studentId: sid } },
    });
    return ex
      ? this.db.submission.update({
          where: { id: ex.id },
          data: { contentText: dto.contentText, contentUrl: dto.contentUrl, status: SubmissionStatus.DRAFT },
        })
      : this.db.submission.create({
          data: {
            assignmentId: aid,
            studentId: sid,
            contentText: dto.contentText,
            contentUrl: dto.contentUrl,
            status: SubmissionStatus.DRAFT,
          },
        });
  }

  async submitWithFiles(
    aid: string,
    files: Express.Multer.File[],
    body: { contentText?: string; contentUrl?: string },
    sid: string,
  ) {
    await this.findOne(aid);
    const ex = await this.db.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId: aid, studentId: sid } },
    });
    const sub = ex
      ? await this.db.submission.update({
          where: { id: ex.id },
          data: {
            contentText: body.contentText ?? null,
            contentUrl: body.contentUrl ?? null,
            status: SubmissionStatus.SUBMITTED,
            submittedAt: new Date(),
          },
        })
      : await this.db.submission.create({
          data: {
            assignmentId: aid,
            studentId: sid,
            contentText: body.contentText ?? null,
            contentUrl: body.contentUrl ?? null,
            status: SubmissionStatus.SUBMITTED,
            submittedAt: new Date(),
          },
        });

    if (files?.length) {
      // Multer is on memoryStorage now → file.buffer + file.originalname are
      // the source of truth; file.filename is undefined. Push each through
      // StorageService.upload so the bytes land in the active backend
      // (disk in dev, S3 in prod).
      await this.db.submissionAttachment.deleteMany({ where: { submissionId: sub.id } });
      const uploaded = await Promise.all(
        files.map(async (f) => {
          const { url } = await this.storage.upload(f.buffer, f.originalname, f.mimetype);
          return {
            submissionId: sub.id,
            fileUrl: url,
            fileName: f.originalname,
            fileSize: f.size,
            mimeType: f.mimetype,
          };
        }),
      );
      await this.db.submissionAttachment.createMany({ data: uploaded });
    }

    await this.activityLog.log(sid, 'SUBMIT', 'Submission', sub.id);
    return this.db.submission.findUnique({ where: { id: sub.id }, include: { grade: true, attachments: true } });
  }

  /**
   * Single-file convenience: legacy endpoint stores the URL directly on the
   * Submission row (`fileUrl`) rather than via SubmissionAttachment. Same
   * StorageService upload either way — only the persistence target differs.
   */
  async submitSingleFile(aid: string, file: Express.Multer.File | undefined, sid: string) {
    let fileUrl: string | undefined;
    if (file) {
      const { url } = await this.storage.upload(file.buffer, file.originalname, file.mimetype);
      fileUrl = url;
    }
    return this.submit(aid, { fileUrl }, sid);
  }

  /**
   * Same as submitWithFiles but accepts already-fetched buffers — used by the
   * Telegram photo-submission flow (Phase 4.3) where we pull bytes from
   * Telegram's CDN, not multipart upload.
   */
  async submitFromBuffer(aid: string, sid: string, buffer: Buffer, originalName: string, mimeType: string) {
    await this.findOne(aid);
    const ex = await this.db.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId: aid, studentId: sid } },
    });
    const sub = ex
      ? await this.db.submission.update({
          where: { id: ex.id },
          data: { status: SubmissionStatus.SUBMITTED, submittedAt: new Date() },
        })
      : await this.db.submission.create({
          data: {
            assignmentId: aid,
            studentId: sid,
            status: SubmissionStatus.SUBMITTED,
            submittedAt: new Date(),
          },
        });

    const { url } = await this.storage.upload(buffer, originalName, mimeType);
    await this.db.submissionAttachment.create({
      data: {
        submissionId: sub.id,
        fileUrl: url,
        fileName: originalName,
        fileSize: buffer.length,
        mimeType,
      },
    });

    await this.activityLog.log(sid, 'SUBMIT', 'Submission', sub.id);
    return this.db.submission.findUnique({
      where: { id: sub.id },
      include: { grade: true, attachments: true, assignment: true },
    });
  }

  async grade(subId: string, dto: GradeDto, byId: string) {
    const sub = await this.db.submission.findUnique({
      where: { id: subId },
      include: { assignment: { include: { course: true } }, student: { select: { email: true, preferredLang: true } } },
    });
    if (!sub) throw new NotFoundException();

    const ex = await this.db.grade.findUnique({ where: { submissionId: subId } });
    const grade = ex
      ? await this.db.grade.update({
          where: { id: ex.id },
          data: { score: dto.score, feedback: dto.feedback, gradedById: byId, gradedAt: new Date() },
        })
      : await this.db.grade.create({
          data: { submissionId: subId, score: dto.score, feedback: dto.feedback, gradedById: byId },
        });

    await this.activityLog.log(byId, 'GRADE', 'Grade', grade.id);

    const notification = getGradeNotificationContent(
      sub.assignment.title,
      dto.score,
      sub.assignment.maxScore,
      sub.student.preferredLang,
    );
    await this.notifications.create({
      userId: sub.studentId,
      type: NotificationType.GRADE_PUBLISHED,
      title: notification.title,
      body: notification.body,
      link: '/courses/' + sub.assignment.courseId + '/grades',
    });

    await this.mail.sendGradePublished(
      sub.student.email,
      sub.assignment.title,
      dto.score,
      sub.assignment.maxScore,
      dto.feedback,
      sub.student.preferredLang,
    );

    return grade;
  }

  async uploadResources(aid: string, files: Express.Multer.File[], user: { id: string; role: Role }) {
    const assignment = await this.findOne(aid);
    if (user.role === Role.TEACHER) {
      const enrolled = await this.db.enrollment.findFirst({
        where: { userId: user.id, courseId: (assignment as any).courseId, roleInCourse: CourseRole.TEACHER },
      });
      if (!enrolled) throw new ForbiddenException('errors.common.notTeacher');
    }
    const uploaded = await Promise.all(
      files.map(async (f) => {
        const { url } = await this.storage.upload(f.buffer, f.originalname, f.mimetype);
        return {
          assignmentId: aid,
          fileUrl: url,
          fileName: f.originalname,
          fileSize: f.size,
          mimeType: f.mimetype,
        };
      }),
    );
    await this.db.assignmentResource.createMany({
      data: uploaded,
    });
    return this.db.assignment.findUnique({ where: { id: aid }, include: { resources: true } });
  }

  async deleteResource(resourceId: string, user: { id: string; role: Role }) {
    const resource = await this.db.assignmentResource.findUnique({
      where: { id: resourceId },
      include: { assignment: { select: { courseId: true } } },
    });
    if (!resource) throw new NotFoundException();
    if (user.role === Role.TEACHER) {
      const enrolled = await this.db.enrollment.findFirst({
        where: { userId: user.id, courseId: resource.assignment.courseId, roleInCourse: CourseRole.TEACHER },
      });
      if (!enrolled) throw new ForbiddenException('errors.common.notTeacher');
    }
    await this.db.assignmentResource.delete({ where: { id: resourceId } });
    return { deleted: true };
  }

  async getComments(assignmentId: string) {
    return this.db.assignmentComment.findMany({
      where: { assignmentId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    });
  }

  async addComment(assignmentId: string, dto: CreateCommentDto, userId: string) {
    const assignment = await this.db.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException();
    return this.db.assignmentComment.create({
      data: { assignmentId, authorId: userId, body: dto.body },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    });
  }
}
