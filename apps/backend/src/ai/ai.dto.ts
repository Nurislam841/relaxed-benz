import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
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
  @ApiPropertyOptional({ default: 5 }) @IsOptional() @IsInt() @Min(1) @Max(20) questionCount?: number;
  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'], default: 'medium' })
  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: string;
  @ApiPropertyOptional({ enum: AI_LANGS }) @IsOptional() @IsIn(AI_LANGS) lang?: string;
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
