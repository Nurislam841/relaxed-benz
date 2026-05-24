import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Role, CourseRole } from '@prisma/client';
import { PdfBuilder } from './pdf-builder';

type AuthUser = { id: string; role: Role; fullName: string; email: string };

@Injectable()
export class PdfReportsService {
  constructor(private db: PrismaService) {}

  private async ensureTeacherOrAdmin(user: AuthUser, courseId: string) {
    if (user.role === Role.ADMIN) return;
    if (user.role !== Role.TEACHER) throw new ForbiddenException('errors.common.notTeacher');
    const en = await this.db.enrollment.findFirst({
      where: { userId: user.id, courseId, roleInCourse: CourseRole.TEACHER },
    });
    if (!en) throw new ForbiddenException('errors.common.notTeacher');
  }

  private genMeta(user: AuthUser): string {
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    return `Generated ${now} UTC · ${user.email}`;
  }

  private streamPdf(filename: string, res: Response, build: (pdf: PdfBuilder) => void) {
    const pdf = new PdfBuilder();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-cache');
    pdf.pipe(res);
    build(pdf);
    pdf.drawFooter();
    pdf.end();
  }

  // ── Course gradebook (teacher/admin) ──────────────────────────────────

  async streamGradebook(courseId: string, user: AuthUser, res: Response) {
    await this.ensureTeacherOrAdmin(user, courseId);
    const course = await this.db.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, title: true },
    });
    if (!course) throw new NotFoundException();

    // All graded submissions for this course, grouped by student
    const assignments = await this.db.assignment.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { dueAt: 'asc' },
      select: {
        id: true,
        title: true,
        maxScore: true,
        submissions: {
          where: { grade: { isNot: null } },
          select: {
            studentId: true,
            student: { select: { fullName: true, email: true } },
            grade: { select: { score: true } },
          },
        },
      },
    });

    // Build student → assignment → score map
    type StudentRow = {
      studentId: string;
      fullName: string;
      email: string;
      scores: Map<string, { score: number; max: number }>;
    };
    const byStudent = new Map<string, StudentRow>();
    for (const a of assignments) {
      for (const sub of a.submissions) {
        let row = byStudent.get(sub.studentId);
        if (!row) {
          row = {
            studentId: sub.studentId,
            fullName: sub.student.fullName,
            email: sub.student.email,
            scores: new Map(),
          };
          byStudent.set(sub.studentId, row);
        }
        row.scores.set(a.id, { score: sub.grade!.score, max: a.maxScore });
      }
    }

    const studentRows = Array.from(byStudent.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));

    const filename = `gradebook_${course.code}_${new Date().toISOString().slice(0, 10)}.pdf`;
    this.streamPdf(filename, res, (pdf) => {
      pdf.drawHeader({
        title: 'Gradebook',
        subtitle: `${course.code} — ${course.title}`,
        generatedFor: this.genMeta(user),
      });

      pdf.drawSectionTitle('Summary');
      pdf.drawMutedLine(
        `${studentRows.length} student${studentRows.length === 1 ? '' : 's'} graded · ${assignments.length} assignment${assignments.length === 1 ? '' : 's'} listed`,
      );
      pdf.doc.moveDown(0.5);

      pdf.drawSectionTitle('Final grade averages');
      pdf.drawTable(
        studentRows.map((s) => {
          const all = Array.from(s.scores.values());
          const pct = all.length
            ? Math.round((all.reduce((sum, g) => sum + g.score, 0) / all.reduce((sum, g) => sum + g.max, 0)) * 100)
            : null;
          return {
            name: s.fullName,
            email: s.email,
            count: all.length,
            avg: pct == null ? '—' : `${pct}%`,
          };
        }),
        [
          { header: 'Student', width: 180, get: (r) => r.name },
          { header: 'Email', width: 200, get: (r) => r.email },
          { header: 'Graded', width: 55, get: (r) => String(r.count), align: 'right' },
          { header: 'Average', width: 60, get: (r) => r.avg, align: 'right' },
        ],
      );

      // Per-assignment breakdown
      for (const a of assignments) {
        if (pdf.doc.y > pdf.doc.page.height - 200) pdf.doc.addPage();
        pdf.drawSectionTitle(`${a.title} · /${a.maxScore}`);
        const rows = studentRows
          .map((s) => {
            const sc = s.scores.get(a.id);
            return {
              name: s.fullName,
              score: sc ? `${sc.score} / ${a.maxScore}` : '—',
              pct: sc ? `${Math.round((sc.score / a.maxScore) * 100)}%` : '—',
            };
          })
          .filter((r) => r.score !== '—');
        if (rows.length === 0) {
          pdf.drawMutedLine('No graded submissions yet.');
          pdf.doc.moveDown(0.5);
          continue;
        }
        pdf.drawTable(rows, [
          { header: 'Student', width: 280, get: (r) => r.name },
          { header: 'Score', width: 110, get: (r) => r.score, align: 'right' },
          { header: 'Percent', width: 105, get: (r) => r.pct, align: 'right' },
        ]);
      }
    });
  }

  // ── Course attendance summary (teacher/admin) ─────────────────────────

  async streamAttendance(courseId: string, user: AuthUser, res: Response) {
    await this.ensureTeacherOrAdmin(user, courseId);
    const course = await this.db.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, title: true },
    });
    if (!course) throw new NotFoundException();

    const records = await this.db.attendance.findMany({
      where: { courseId },
      include: { student: { select: { id: true, fullName: true, email: true } } },
      orderBy: [{ student: { fullName: 'asc' } }, { date: 'asc' }],
    });

    // Aggregate per student
    type StudentStats = {
      studentId: string;
      fullName: string;
      email: string;
      total: number;
      present: number;
      late: number;
      absent: number;
    };
    const stats = new Map<string, StudentStats>();
    for (const r of records) {
      let s = stats.get(r.studentId);
      if (!s) {
        s = {
          studentId: r.studentId,
          fullName: r.student.fullName,
          email: r.student.email,
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
        };
        stats.set(r.studentId, s);
      }
      s.total++;
      if (r.status === 'PRESENT') s.present++;
      else if (r.status === 'LATE') s.late++;
      else if (r.status === 'ABSENT') s.absent++;
    }
    const rows = Array.from(stats.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));

    const filename = `attendance_${course.code}_${new Date().toISOString().slice(0, 10)}.pdf`;
    this.streamPdf(filename, res, (pdf) => {
      pdf.drawHeader({
        title: 'Attendance summary',
        subtitle: `${course.code} — ${course.title}`,
        generatedFor: this.genMeta(user),
      });

      pdf.drawSectionTitle('Per-student totals');
      pdf.drawMutedLine(
        `${rows.length} student${rows.length === 1 ? '' : 's'} · ${records.length} attendance record${records.length === 1 ? '' : 's'}`,
      );
      pdf.doc.moveDown(0.5);

      pdf.drawTable(
        rows.map((r) => ({
          name: r.fullName,
          email: r.email,
          present: r.present,
          late: r.late,
          absent: r.absent,
          pct: r.total === 0 ? '—' : `${Math.round((r.present / r.total) * 100)}%`,
        })),
        [
          { header: 'Student', width: 170, get: (r) => r.name },
          { header: 'Email', width: 170, get: (r) => r.email },
          { header: 'Present', width: 55, get: (r) => String(r.present), align: 'right' },
          { header: 'Late', width: 45, get: (r) => String(r.late), align: 'right' },
          { header: 'Absent', width: 50, get: (r) => String(r.absent), align: 'right' },
          { header: '% Present', width: 65, get: (r) => r.pct, align: 'right' },
        ],
      );
    });
  }

  // ── Student transcript (any authenticated user — their own data) ──────

  async streamTranscript(user: AuthUser, res: Response) {
    const enrollments = await this.db.enrollment.findMany({
      where: { userId: user.id, deletedAt: null },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            semester: true,
            assignments: {
              where: { deletedAt: null },
              select: {
                id: true,
                title: true,
                maxScore: true,
                dueAt: true,
                submissions: {
                  where: { studentId: user.id },
                  select: {
                    grade: { select: { score: true, feedback: true, gradedAt: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const filename = `transcript_${user.fullName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    this.streamPdf(filename, res, (pdf) => {
      pdf.drawHeader({
        title: 'Academic transcript',
        subtitle: `${user.fullName} · ${user.email}`,
        generatedFor: this.genMeta(user),
      });

      if (enrollments.length === 0) {
        pdf.drawMutedLine('Not enrolled in any courses yet.');
        return;
      }

      // Overall GPA-style average across all graded work
      let totalScore = 0;
      let totalMax = 0;
      for (const en of enrollments) {
        for (const a of en.course.assignments) {
          for (const sub of a.submissions) {
            if (sub.grade) {
              totalScore += sub.grade.score;
              totalMax += a.maxScore;
            }
          }
        }
      }
      const overallPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;

      pdf.drawSectionTitle('Overall performance');
      pdf.drawMutedLine(
        `${enrollments.length} course${enrollments.length === 1 ? '' : 's'} · ` +
          `Overall average: ${overallPct == null ? '—' : `${overallPct}%`}`,
      );
      pdf.doc.moveDown(0.5);

      // Per-course breakdown
      for (const en of enrollments) {
        if (pdf.doc.y > pdf.doc.page.height - 200) pdf.doc.addPage();
        pdf.drawSectionTitle(`${en.course.code} — ${en.course.title}`);
        if (en.course.semester) pdf.drawMutedLine(`Semester: ${en.course.semester}`);
        const rows = en.course.assignments.map((a) => {
          const grade = a.submissions[0]?.grade;
          return {
            title: a.title,
            due: new Date(a.dueAt).toISOString().slice(0, 10),
            score: grade ? `${grade.score} / ${a.maxScore}` : 'not graded',
            pct: grade ? `${Math.round((grade.score / a.maxScore) * 100)}%` : '—',
          };
        });
        if (rows.length === 0) {
          pdf.drawMutedLine('No assignments yet.');
          pdf.doc.moveDown(0.5);
          continue;
        }
        pdf.drawTable(rows, [
          { header: 'Assignment', width: 240, get: (r) => r.title },
          { header: 'Due', width: 90, get: (r) => r.due },
          { header: 'Score', width: 100, get: (r) => r.score, align: 'right' },
          { header: 'Percent', width: 65, get: (r) => r.pct, align: 'right' },
        ]);
      }
    });
  }
}
