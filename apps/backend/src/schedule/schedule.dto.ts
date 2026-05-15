import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleType } from '@prisma/client';

export class CreateScheduleItemDto {
  @ApiProperty() @IsDateString() startsAt: string;
  @ApiProperty() @IsDateString() endsAt: string;
  @ApiProperty() @IsString() @IsNotEmpty() room: string;
  @ApiProperty({ enum: ScheduleType }) @IsEnum(ScheduleType) type: ScheduleType;
  @ApiPropertyOptional() @IsString() @IsOptional() groupId?: string;
}

/**
 * Partial update — every field optional. Admins/teachers may correct any
 * subset of fields (e.g. just the room) without re-sending the whole item.
 */
export class UpdateScheduleItemDto {
  @ApiPropertyOptional() @IsDateString() @IsOptional() startsAt?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endsAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() room?: string;
  @ApiPropertyOptional({ enum: ScheduleType }) @IsEnum(ScheduleType) @IsOptional() type?: ScheduleType;
  @ApiPropertyOptional({ nullable: true }) @IsString() @IsOptional() groupId?: string | null;
}
