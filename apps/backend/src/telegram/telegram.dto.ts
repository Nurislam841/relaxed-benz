import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkTelegramDto {
  @ApiProperty({
    example: '123456789',
    description: 'Telegram chat_id (digits). Get yours from @userinfobot.',
  })
  @IsString()
  @Matches(/^-?\d{4,20}$/, { message: 'chat_id must be a numeric Telegram identifier' })
  chatId: string;
}
