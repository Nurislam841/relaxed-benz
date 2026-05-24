import { Controller, Get, Post, Body, UseGuards, HttpCode, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { LinkTelegramDto } from './telegram.dto';

@ApiTags('Telegram')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('me/telegram')
export class TelegramController {
  constructor(
    private db: PrismaService,
    private tg: TelegramService,
    private jwt: JwtService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether the user has Telegram linked + whether bot is configured globally' })
  async status(@CurrentUser() u: any) {
    const user = await this.db.user.findUnique({
      where: { id: u.id },
      select: { telegramChatId: true },
    });
    return {
      linked: !!user?.telegramChatId,
      // Masked chat_id for display: keeps last 4 digits, hides the rest.
      chatIdHint: user?.telegramChatId
        ? user.telegramChatId.length > 4
          ? `${'•'.repeat(user.telegramChatId.length - 4)}${user.telegramChatId.slice(-4)}`
          : user.telegramChatId
        : null,
      botConfigured: this.tg.isEnabled,
    };
  }

  @Post('link')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Link a Telegram chat to this account. Sends a verification message and saves on success.',
  })
  async link(@Body() dto: LinkTelegramDto, @CurrentUser() u: any) {
    const user = await this.db.user.findUnique({
      where: { id: u.id },
      select: { fullName: true },
    });
    if (!user) throw new NotFoundException();

    // Send verification BEFORE persisting — if the chat_id is wrong or the
    // user hasn't messaged the bot first, this throws and we don't save.
    await this.tg.sendVerification(dto.chatId, user.fullName);

    await this.db.user.update({
      where: { id: u.id },
      data: { telegramChatId: dto.chatId },
    });
    return { linked: true };
  }

  @Post('unlink')
  @HttpCode(200)
  @ApiOperation({ summary: 'Disconnect Telegram from this account' })
  async unlink(@CurrentUser() u: any) {
    await this.db.user.update({
      where: { id: u.id },
      data: { telegramChatId: null },
    });
    return { linked: false };
  }

  @Post('link-token')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Generate a one-tap deep link for connecting Telegram (5 min TTL)',
  })
  async linkToken(@CurrentUser() u: any) {
    // We sign a short-lived JWT and pass it as the deep-link payload. When
    // the user lands in @uni_lms_bot via the t.me link, the bot's /start
    // handler verifies the JWT and writes telegramChatId. No copy-paste of
    // chat_id required — this is the *one-tap* UX.
    const token = await this.jwt.signAsync(
      { sub: u.id },
      {
        expiresIn: '5m',
        secret: process.env.TELEGRAM_LINK_SECRET || process.env.JWT_SECRET || 'change-me',
      },
    );
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'uni_lms_bot';
    return {
      deepLink: `https://t.me/${botUsername}?start=link_${token}`,
      expiresIn: 300,
      botUsername,
    };
  }

  @Post('test')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a test message to the linked chat' })
  async test(@CurrentUser() u: any) {
    const user = await this.db.user.findUnique({
      where: { id: u.id },
      select: { fullName: true, telegramChatId: true },
    });
    if (!user?.telegramChatId) {
      return { sent: false, reason: 'not_linked' };
    }
    const ok = await this.tg.sendMessage(
      user.telegramChatId,
      `🔔 *Test notification*\n\nHi ${user.fullName}, this is a delivery test from UniLMS. If you see this, everything's wired up.`,
    );
    return { sent: ok };
  }
}
