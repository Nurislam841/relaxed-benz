import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSessionDto {
  @ApiProperty() @IsString() @IsNotEmpty() quizId: string;
}

export class SubmitAnswerDto {
  @ApiProperty() @IsString() @IsNotEmpty() questionId: string;
  @ApiProperty() @IsInt() @Min(0) @Type(() => Number) pickedIndex: number;
  @ApiProperty() @IsInt() @Min(0) @Type(() => Number) responseTimeMs: number;
}
