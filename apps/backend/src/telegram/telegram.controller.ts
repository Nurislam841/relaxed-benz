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
    // Two artifacts: a 6-digit code (the canonical linking path) and a
    // "open bot" deep link (no `?start=` payload).
    //
    // Why we no longer pass the code as a deep-link payload: Telegram
    // *hides* the payload in the chat UI — the user types/sees just
    // `/start`, while the bot receives `/start 123456` and silently links
    // them. Users got confused because their first /start unexpectedly
    // succeeded (auto-link via payload) and a subsequent `/link <code>`
    // they tried to do manually failed with "code expired" (the code had
    // already been consumed by the hidden /start).
    //
    // New flow: every link goes through the explicit `/link 123456`
    // command. The deep link only opens the chat; the user pastes the
    // visible code themselves. No surprises.
    const code = this.tg.generateLinkCode(u.id);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'uni_lms_bot';
    return {
      deepLink: `https://t.me/${botUsername}`,
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
