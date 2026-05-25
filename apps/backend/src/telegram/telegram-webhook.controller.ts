import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  UnauthorizedException,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { getBackendPublicUrl } from '../common/public-url';

/**
 * Public Telegram webhook endpoint + bot lifecycle controller.
 *
 * Telegram sends updates here as POST requests with a JSON body. We require
 * the `X-Telegram-Bot-Api-Secret-Token` header to match `TELEGRAM_WEBHOOK_SECRET`
 * — without that anyone could POST fake updates and impersonate users.
 *
 * Bot lifecycle:
 *  - `TELEGRAM_MODE=webhook` (default in prod): on startup we call
 *    `bot.api.setWebhook(...)` so Telegram knows where to POST. No polling.
 *  - `TELEGRAM_MODE=polling`: we delete any existing webhook and start grammY's
 *    long-polling loop in the background. Local dev or no-public-URL deploys.
 *
 * Inbound updates flow through TelegramUpdatesService (see its handlers).
 */
@ApiTags('Telegram')
@Controller('telegram')
export class TelegramWebhookController implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramWebhookController.name);
  private pollingActive = false;

  constructor(private readonly tg: TelegramService) {}

  async onModuleInit() {
    const bot = this.tg.bot;
    if (!bot) return; // bot disabled — nothing to register

    // Don't fight a real bot instance during tests — both grabbing
    // getUpdates causes a 409 storm in logs and adds zero value.
    if (process.env.JEST_WORKER_ID) {
      this.logger.log('Skipping bot startup (test environment)');
      return;
    }

    const mode = (process.env.TELEGRAM_MODE || 'polling').toLowerCase();
    const publicUrl = getBackendPublicUrl();
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    // Diagnostic log — surfaces config issues immediately. Useful when the
    // env var is wrong (internal host, missing scheme, trailing newline etc.)
    this.logger.log(
      `Telegram bot lifecycle: mode=${mode}, publicUrl=${publicUrl ?? '(unset)'}, hasSecret=${!!secretToken}`,
    );

    if (mode === 'webhook') {
      if (!publicUrl) {
        this.logger.warn(
          'TELEGRAM_MODE=webhook but BACKEND_PUBLIC_URL is not set — skipping setWebhook. ' +
            'Bot will receive no updates until configured.',
        );
        return;
      }
      try {
        const webhookUrl = `${publicUrl}/api/telegram/webhook`;
        await bot.api.setWebhook(webhookUrl, {
          secret_token: secretToken || undefined,
          allowed_updates: [
            'message',
            'callback_query',
            'poll_answer',
            'my_chat_member', // group joins/leaves (Phase 4.2)
          ],
        });
        this.logger.log(`Telegram webhook registered at ${webhookUrl}`);
      } catch (e: any) {
        this.logger.error(`Failed to set webhook: ${e?.message ?? e}`);
      }
    } else {
      // polling mode — drop any stale webhook first to avoid getUpdates 409.
      try {
        await bot.api.deleteWebhook({ drop_pending_updates: false });
        // bot.start() is a long-running promise — we don't await it.
        // It resolves only on bot.stop() / process death.
        bot
          .start({
            allowed_updates: ['message', 'callback_query', 'poll_answer', 'my_chat_member'],
            onStart: (info) => {
              this.pollingActive = true;
              this.logger.log(`Telegram bot polling started as @${info.username}`);
            },
          })
          .catch((e) => this.logger.error(`Bot polling crashed: ${e?.message ?? e}`));
      } catch (e: any) {
        this.logger.error(`Failed to start polling: ${e?.message ?? e}`);
      }
    }
  }

  async onModuleDestroy() {
    const bot = this.tg.bot;
    if (!bot) return;
    if (this.pollingActive) {
      await bot.stop().catch(() => undefined);
    }
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  webhook(@Body() update: any, @Headers('x-telegram-bot-api-secret-token') secret?: string) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected && secret !== expected) {
      throw new UnauthorizedException('invalid webhook secret');
    }
    const bot = this.tg.bot;
    if (!bot) return { ok: true }; // bot disabled — silently accept
    // Process the update OUT OF BAND so Telegram receives the 200 ack within
    // its 5-second timeout window — even when the actual handler is slow
    // (AI streaming response, S3 upload, slow DB query, etc.). Telegram
    // doesn't care about the response body; it only cares whether we
    // acknowledged delivery. Handler errors are logged for debugging but
    // never bubble up because Telegram would retry the same update.
    void bot.handleUpdate(update).catch((e: any) => {
      this.logger.warn(`handleUpdate failed: ${e?.message ?? e}`);
    });
    return { ok: true };
  }
}
