import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsIn, IsArray, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const AI_LANGS = ['en', 'ru', 'kz'] as const;

export class AssignmentFeedbackDto {
  @ApiProperty() @IsString() @IsNotEmpty() assignmentId: string;
  @ApiProperty() @IsString() @IsNotEmpty() submissionId: string;
  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
}

export class GenerateQuizDto {
  @ApiProperty() @IsString() @IsNotEmpty() courseId: string;
  @ApiProperty() @IsString() @IsNotEmpty() topic: string;
  @ApiPropertyOptional({ default: 5 }) @IsOptional() @IsInt() @Min(1) @Max(50) questionCount?: number;
  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'], default: 'medium' })
  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: string;
  /**
   * Per-difficulty breakdown (Feature #1.5). When the teacher supplies all
   * three counts, the AI is told to generate exactly that many per tier and
   * the `difficulty` field is ignored. Sum MUST equal questionCount —
   * enforced server-side too, so a bad frontend can't slip a mismatch past.
   */
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(50) easyCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(50) mediumCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(50) hardCount?: number;
  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
  /**
   * Optional lecture text extracted from a teacher-uploaded file (PDF/DOCX/TXT
   * via POST /ai/extract-text). When set, Claude is told to generate the quiz
   * *strictly from this material* rather than from generic knowledge of the
   * topic — produces course-specific questions instead of generic ones.
   * The frontend caps the string at MAX_EXTRACTED_CHARS (200KB) before sending.
   */
  @ApiPropertyOptional() @IsOptional() @IsString() materialText?: string;
}

export class CourseSummaryDto {
  @ApiProperty() @IsString() @IsNotEmpty() courseId: string;
  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
}

export class StudentAnalysisDto {
  @ApiProperty() @IsString() @IsNotEmpty() studentId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() courseId?: string;
  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
}

export class ChatMessageDto {
  @ApiProperty() @IsString() @IsNotEmpty() message: string;
  @ApiPropertyOptional() @IsOptional() @IsString() context?: string;
  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
}

/**
 * Personal Study Coach for a single student. Combines grade trajectory,
 * a day-by-day study plan, and systematic mistake patterns into one
 * actionable report. Replaces the descriptive-only `StudentAnalysisDto`.
 */
export class StudyCoachDto {
  /** Defaults to the caller's own id. Teachers/admins may pass any studentId. */
  @ApiPropertyOptional() @IsOptional() @IsString() studentId?: string;
  /** Scope analysis to a single course (otherwise: all enrolled courses). */
  @ApiPropertyOptional() @IsOptional() @IsString() courseId?: string;
  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
}

/**
 * Teacher-only analytics across an entire course: which students are at
 * risk of failing, what topics the whole class is struggling with, and
 * who's excelling.
 */
export class ClassInsightsDto {
  @ApiProperty() @IsString() @IsNotEmpty() courseId: string;
  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
}

/**
 * Feature #2 — inline AI assist inside the Quiz Editor.
 *
 * One endpoint covers three actions (kept together because they share the
 * Claude client, lang handling, and demo-mode fallback). Response shape
 * varies by action — frontend uses TypeScript's discriminated unions to
 * pick the right field:
 *   improve-question   → { question }
 *   generate-options   → { options, correctIndex }
 *   generate-explanation → { explanation }
 */
const QUIZ_ASSIST_ACTIONS = ['improve-question', 'generate-options', 'generate-explanation'] as const;
export type QuizAssistAction = (typeof QUIZ_ASSIST_ACTIONS)[number];

export class QuizAssistDto {
  @ApiProperty({ enum: QUIZ_ASSIST_ACTIONS })
  @IsIn(QUIZ_ASSIST_ACTIONS as unknown as string[])
  action: QuizAssistAction;

  @ApiProperty({ description: 'Current question text (required for all actions)' })
  @IsString()
  @IsNotEmpty()
  question: string;

  /**
   * Existing options array. Required for `generate-explanation` so Claude
   * knows which answer it's explaining. Ignored for the other two actions.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  options?: string[];

  /** Index of the correct option — required for `generate-explanation`. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  correctIndex?: number;

  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
}

/**
 * Self-study quiz from a student's weak topics (Feature #5 / C3).
 *
 * After a Kahoot session, the student clicks "Create self-study quiz"
 * on their results page. AI reads the questions they got wrong,
 * extracts the underlying topics, and generates a fresh small quiz
 * (5 questions by default, max 10) anchored to those weak spots.
 * If the original quiz had source material, AI uses it as the
 * primary grounding; otherwise AI generates from its own knowledge.
 *
 * The generated quiz is returned ephemerally — NOT persisted in the
 * Quiz table. Students play through it on a single page that lives
 * separately from the host-driven Kahoot flow.
 *
 * Auth identical to /ai/kahoot-study-guide — self-lookup or host.
 */
export class SelfStudyQuizDto {
  @ApiProperty() @IsString() @IsNotEmpty() sessionId: string;
  @ApiProperty() @IsString() @IsNotEmpty() studentId: string;
  @ApiPropertyOptional({ default: 5 }) @IsOptional() @IsInt() @Min(3) @Max(10) questionCount?: number;
  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
}

/**
 * Personalized study guide for a student after a Kahoot session.
 *
 * Two modes the service picks between automatically:
 *   1. Quiz has uploaded material → AI extracts focused excerpts from
 *      the lecture text that map to the student's wrong answers, plus
 *      "why X is right / why Y is wrong" explanations and follow-up
 *      example exercises.
 *   2. Quiz has NO material → AI generates a mini-lesson from
 *      scratch on the weak topics, same shape as mode 1 minus the
 *      sourceQuote field.
 *
 * Auth identical to /ai/kahoot-insights — self-lookup (caller's own
 * studentId) goes through the student-facing path; teacher/admin can
 * look up any student via the host-only path.
 */
export class KahootStudyGuideDto {
  @ApiProperty() @IsString() @IsNotEmpty() sessionId: string;
  /** Required. Either the caller's own id (self-lookup) or any player's id (host/admin only). */
  @ApiProperty() @IsString() @IsNotEmpty() studentId: string;
  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
}

/**
 * Feature #3 — AI insights on a finished Kahoot session report.
 *
 * Two scopes:
 *   - `class` (default): narrative + per-question misconceptions for
 *     the whole room. Teacher uses this to plan the next lecture.
 *   - `student`: specific student's strengths, gaps, and a 2-sentence
 *     recommendation. Triggered when the teacher clicks a row in the
 *     leaderboard.
 *
 * The endpoint pulls the same report data the host already sees
 * (per-player + per-question answer trail) so we don't have to ship
 * the raw data from the frontend — keeps the request body tiny and
 * the auth surface single (host-or-admin check matches the report
 * endpoint itself).
 */
const KAHOOT_INSIGHT_SCOPES = ['class', 'student'] as const;
export type KahootInsightScope = (typeof KAHOOT_INSIGHT_SCOPES)[number];

export class KahootInsightsDto {
  @ApiProperty() @IsString() @IsNotEmpty() sessionId: string;

  @ApiPropertyOptional({ enum: KAHOOT_INSIGHT_SCOPES, default: 'class' })
  @IsOptional()
  @IsIn(KAHOOT_INSIGHT_SCOPES as unknown as string[])
  scope?: KahootInsightScope;

  /** Required when scope='student' — which player to analyse. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
}

/**
 * AI code review on a submission.
 *
 * The service pulls `submission.contentText` (and recognises a `language` hint
 * if provided) and asks Claude to flag bugs / style / optimization issues
 * with line numbers, so the UI can render them inline with the code.
 */
export class CodeReviewDto {
  @ApiProperty() @IsString() @IsNotEmpty() submissionId: string;
  /** Optional language hint: 'python', 'typescript', 'java', 'cpp', etc. */
  @ApiPropertyOptional() @IsOptional() @IsString() language?: string;
  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
}
