import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Global storage module — `StorageService` is injected into assignments,
 * (eventually course materials), and the Telegram bot's photo-submission
 * handler. Marked @Global so the rest of the app doesn't need to import it
 * everywhere.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
