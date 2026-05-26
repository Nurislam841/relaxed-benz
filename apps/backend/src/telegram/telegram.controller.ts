import { Controller, Get, Post, Body, UseGuards, HttpCode, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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
    summary:
      'Generate linking artifacts: deep link (one-tap) AND a 6-digit code for the fallback /link command (5 min TTL)',
  })
  async linkToken(@CurrentUser() u: any) {
    // Two parallel linking paths are returned:
    //
    //  1. `deepLink` — Telegram opens the bot with the code as ?start= payload.
    //     This is one-tap UX *only when the chat is fresh* — Telegram drops
    //     the payload silently if the user has already tapped Start before.
    //
    //  2. `code` — the same 6-digit code, displayed prominently in the UI.
    //     User can paste it into the bot as `/link 123456`. Works for every
    //     user regardless of their chat history with the bot. This is the
    //     reliable fallback that we want users to see when one-tap fails.
    //
    // Both paths consume the same in-memory token, so whichever fires first
    // wins and the other becomes a no-op.
    const code = this.tg.generateLinkCode(u.id);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'uni_lms_bot';
    return {
      deepLink: `https://t.me/${botUsername}?start=${code}`,
      code,
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
