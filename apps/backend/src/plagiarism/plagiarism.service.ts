import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { Role, CourseRole } from '@prisma/client';

type AuthUser = { id: string; role: Role };

const METHOD_VERSION = 'jaccard-3gram-v1';
const NGRAM_SIZE = 3;
const REPORT_THRESHOLD = 0.2; // store reports for pairs above 20% similarity

/**
 * Normalize text for similarity comparison:
 *  - lowercase
 *  - strip URLs / code-fence markers
 *  - collapse whitespace
 *  - drop punctuation
 *  - drop too-short tokens (< 2 chars)
 */
function normalize(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[^a-zа-яёұқңөғүһiә0-9\s]/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.split(' ').filter((w) => w.length >= 2);
}

function ngrams(tokens: string[], n = NGRAM_SIZE): Set<string> {
  const out = new Set<string>();
  if (tokens.length < n) {
    if (tokens.length > 0) out.add(tokens.join(' '));
    return out;
  }
  for (let i = 0; i <= tokens.length - n; i++) {
    out.add(tokens.slice(i, i + n).join(' '));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): { similarity: number; matched: number } {
  if (a.size === 0 || b.size === 0) return { similarity: 0, matched: 0 };
  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (large.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return { similarity: union === 0 ? 0 : intersection / union, matched: intersection };
}

@Injectable()
export class PlagiarismService {
  constructor(
    private db: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  private async ensureTeacherOrAdmin(user: AuthUser, courseId: string) {
    if (user.role === Role.ADMIN) return;
    if (user.role !== Role.TEACHER) throw new ForbiddenException('errors.common.notTeacher');
    const enrollment = await this.db.enrollment.findFirst({
      where: { userId: user.id, courseId, roleInCourse: CourseRole.TEACHER },
    });
    if (!enrollment) throw new ForbiddenException('errors.common.notTeacher');
  }

  /**
   * Run pairwise plagiarism check across all SUBMITTED submissions of an
   * assignment. Caches results to plagiarism_reports for fast subsequent
   * reads. Only pairs above REPORT_THRESHOLD are stored.
   */
  async checkAssignment(assignmentId: string, user: AuthUser) {
    const assignment = await this.db.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: { select: { id: true } } },
    });
    if (!assignment) throw new NotFoundException();
    await this.ensureTeacherOrAdmin(user, assignment.courseId);

    const submissions = await this.db.submission.findMany({
      where: {
        assignmentId,
        status: 'SUBMITTED',
        contentText: { not: null },
      },
      select: {
        id: true,
        studentId: true,
        contentText: true,
        student: { select: { fullName: true } },
      },
    });

    const eligible = submissions
      .map((s) => ({
        id: s.id,
        studentId: s.studentId,
        studentName: s.student.fullName,
        tokens: normalize(s.contentText ?? ''),
      }))
      .filter((s) => s.tokens.length >= NGRAM_SIZE);

    // precompute n-gram sets
    const sets = eligible.map((s) => ({ ...s, set: ngrams(s.tokens) }));

    const pairs: {
      submissionAId: string;
      submissionBId: string;
      similarity: number;
      matched: number;
    }[] = [];

    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const { similarity, matched } = jaccard(sets[i].set, sets[j].set);
        if (similarity >= REPORT_THRESHOLD) {
          // canonicalize pair order so (A,B) and (B,A) collapse to one row
          const [aId, bId] = sets[i].id < sets[j].id ? [sets[i].id, sets[j].id] : [sets[j].id, sets[i].id];
          pairs.push({
            submissionAId: aId,
            submissionBId: bId,
            similarity,
            matched,
          });
        }
      }
    }

    // Replace previous reports for this assignment + method
    await this.db.$transaction([
      this.db.plagiarismReport.deleteMany({
        where: { assignmentId, methodVersion: METHOD_VERSION },
      }),
      this.db.plagiarismReport.createMany({
        data: pairs.map((p) => ({
          assignmentId,
          submissionAId: p.submissionAId,
          submissionBId: p.submissionBId,
          similarity: p.similarity,
          matchedNgrams: p.matched,
          methodVersion: METHOD_VERSION,
        })),
        skipDuplicates: true,
      }),
    ]);

    await this.activityLog.log(user.id, 'CHECK_PLAGIARISM', 'Assignment', assignmentId);

    return {
      assignmentId,
      methodVersion: METHOD_VERSION,
      submissionsAnalyzed: eligible.length,
      submissionsSkipped: submissions.length - eligible.length,
      pairsFound: pairs.length,
      threshold: REPORT_THRESHOLD,
    };
  }

  async listByAssignment(assignmentId: string, user: AuthUser) {
    const assignment = await this.db.assignment.findUnique({
      where: { id: assignmentId },
      select: { courseId: true },
    });
    if (!assignment) throw new NotFoundException();
    await this.ensureTeacherOrAdmin(user, assignment.courseId);

    return this.db.plagiarismReport.findMany({
      where: { assignmentId, methodVersion: METHOD_VERSION },
      orderBy: { similarity: 'desc' },
      include: {
        submissionA: {
          select: { id: true, studentId: true, student: { select: { fullName: true } } },
        },
        submissionB: {
          select: { id: true, studentId: true, student: { select: { fullName: true } } },
        },
      },
    });
  }

  /**
   * Return the highest-similarity report involving a specific submission
   * (so we can display a single "73% similar to X" badge in the UI).
   */
  async forSubmission(submissionId: string, user: AuthUser) {
    const sub = await this.db.submission.findUnique({
      where: { id: submissionId },
      include: { assignment: { select: { courseId: true } } },
    });
    if (!sub) throw new NotFoundException();
    await this.ensureTeacherOrAdmin(user, sub.assignment.courseId);

    const reports = await this.db.plagiarismReport.findMany({
      where: {
        methodVersion: METHOD_VERSION,
        OR: [{ submissionAId: submissionId }, { submissionBId: submissionId }],
      },
      orderBy: { similarity: 'desc' },
      include: {
        submissionA: {
          select: { id: true, studentId: true, student: { select: { fullName: true } } },
        },
        submissionB: {
          select: { id: true, studentId: true, student: { select: { fullName: true } } },
        },
      },
    });

    // Reshape so the "other" submission is always in `otherSubmission`
    return reports.map((r) => {
      const isA = r.submissionAId === submissionId;
      return {
        id: r.id,
        similarity: r.similarity,
        matchedNgrams: r.matchedNgrams,
        createdAt: r.createdAt,
        otherSubmission: isA ? r.submissionB : r.submissionA,
      };
    });
  }
}
