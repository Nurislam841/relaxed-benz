import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsArray,
  IsBoolean,
  IsEnum,
  ValidateNested,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { QuizSource, QuestionDifficulty } from '@prisma/client';

export class QuizQuestionInputDto {
  @ApiProperty() @IsString() @IsNotEmpty() question: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  options: string[];
  @ApiProperty() @IsInt() @Min(0) @Type(() => Number) correctIndex: number;
  @ApiPropertyOptional() @IsString() @IsOptional() explanation?: string;
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(1) @Type(() => Number) points?: number;
  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsEnum(QuestionDifficulty)
  @IsOptional()
  difficulty?: QuestionDifficulty;
  /** Per-question time-limit override (seconds). Inherits Quiz.secondsPerQuestion when omitted. */
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(5) @Max(300) @Type(() => Number) secondsPerQuestion?: number;
}

export class CreateQuizDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional({ enum: QuizSource }) @IsEnum(QuizSource) @IsOptional() source?: QuizSource;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isPublished?: boolean;
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(5) @Type(() => Number) secondsPerQuestion?: number;
  /**
   * Optional source-material attachment. Frontend gets these three from
   * the /ai/extract-text response when the teacher uploads a lecture
   * file; persisting them on the quiz lets the Telegram bot stream the
   * material back to students post-game.
   */
  @ApiPropertyOptional() @IsString() @IsOptional() sourceMaterialKey?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() sourceMaterialFileName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() sourceMaterialMime?: string;
  /** Extracted plaintext from the material — fed to AI for the personalized study guide. */
  @ApiPropertyOptional() @IsString() @IsOptional() sourceMaterialText?: string;
  @ApiProperty({ type: [QuizQuestionInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionInputDto)
  questions: QuizQuestionInputDto[];
}

export class UpdateQuizDto {
  @ApiPropertyOptional() @IsString() @IsOptional() title?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isPublished?: boolean;
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(5) @Type(() => Number) secondsPerQuestion?: number;
}

export class SubmitAttemptAnswerDto {
  @ApiProperty() @IsString() @IsNotEmpty() questionId: string;
  @ApiProperty() @IsInt() @Min(0) @Type(() => Number) pickedIndex: number;
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(0) @Type(() => Number) responseTimeMs?: number;
}

export class SubmitAttemptDto {
  @ApiProperty({ type: [SubmitAttemptAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAttemptAnswerDto)
  answers: SubmitAttemptAnswerDto[];
}

export class AdaptiveAnswerDto {
  @ApiProperty() @IsString() @IsNotEmpty() attemptId: string;
  @ApiProperty() @IsString() @IsNotEmpty() questionId: string;
  @ApiProperty() @IsInt() @Min(0) @Type(() => Number) pickedIndex: number;
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(0) @Type(() => Number) responseTimeMs?: number;
}

/**
 * Create a single question inside an existing quiz. Position is auto-assigned
 * to (current max + 1) by the service — caller doesn't supply it.
 */
export class CreateQuizQuestionDto {
  @ApiProperty() @IsString() @IsNotEmpty() question: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  options: string[];
  @ApiProperty() @IsInt() @Min(0) @Type(() => Number) correctIndex: number;
  @ApiPropertyOptional() @IsString() @IsOptional() explanation?: string;
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(1) @Type(() => Number) points?: number;
  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsEnum(QuestionDifficulty)
  @IsOptional()
  difficulty?: QuestionDifficulty;
  /**
   * Per-question time limit override (seconds). When unset, the question
   * inherits the Quiz.secondsPerQuestion which itself defaults to 30s.
   * Capped at 300s to prevent stuck sessions; minimum 5s to keep the
   * gameplay from feeling impossible.
   */
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(5) @Max(300) @Type(() => Number) secondsPerQuestion?: number;
}

/**
 * Patch a single question. All fields optional — only provided keys are touched.
 * Supplying `position` reorders within the quiz (other questions slide accordingly).
 */
export class UpdateQuizQuestionDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @IsNotEmpty() question?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  options?: string[];
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(0) @Type(() => Number) correctIndex?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() explanation?: string;
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(1) @Type(() => Number) points?: number;
  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsEnum(QuestionDifficulty)
  @IsOptional()
  difficulty?: QuestionDifficulty;
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(0) @Type(() => Number) position?: number;
  // Same per-question time-limit override as on the create DTO. Allows
  // editing a question's allotted time without re-creating it.
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(5) @Max(300) @Type(() => Number) secondsPerQuestion?: number;
}
