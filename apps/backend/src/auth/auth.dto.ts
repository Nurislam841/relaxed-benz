import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class LoginDto {
  @ApiProperty({ example: 'admin@uni.kz' }) @IsEmail() email: string;
  @ApiProperty({ example: 'Admin123!' }) @IsString() @IsNotEmpty() password: string;
  @ApiPropertyOptional({ example: '123456', description: '6-digit TOTP — required when 2FA is enabled on the account' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  totpCode?: string;
}

export class RegisterDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(6) password: string;
  @ApiProperty() @IsString() @IsNotEmpty() fullName: string;
  @ApiPropertyOptional({ enum: Role }) @IsEnum(Role) @IsOptional() role?: Role;
}
