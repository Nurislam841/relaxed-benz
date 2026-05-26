import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PrismaModule } from '../prisma/prisma.module';
import { KahootModule } from '../kahoot/kahoot.module';

// Export AiService so other modules can inject it — TelegramUpdatesService
// streams /ask + /coach through aiService.chatStream / getStudyCoach.
//
// KahootModule via forwardRef: AiService.kahootInsights reuses
// KahootService.getSessionReport (same host-or-admin auth + same data
// shape, no duplication). forwardRef because the dependency arrow runs
// both directions (kahoot.gateway.ts uses AiService for future class
// insights — this avoids a cold-boot circular import even though we
// haven't wired it yet).
@Module({
  imports: [PrismaModule, forwardRef(() => KahootModule)],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
