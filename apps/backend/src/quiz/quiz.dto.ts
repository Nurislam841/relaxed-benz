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
}

export class CreateQuizDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional({ enum: QuizSource }) @IsEnum(QuizSource) @IsOptional() source?: QuizSource;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isPublished?: boolean;
  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(5) @Type(() => Number) secondsPerQuestion?: number;
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
}
