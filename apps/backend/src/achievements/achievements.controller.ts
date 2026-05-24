import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AchievementsService } from './achievements.service';

@ApiTags('Achievements')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('me/achievements')
export class AchievementsController {
  constructor(private svc: AchievementsService) {}

  @Get()
  @ApiOperation({ summary: 'Full achievement catalog with earned/locked status for the current user' })
  list(@CurrentUser() u: any) {
    return this.svc.listForUser(u.id);
  }

  @Post('recompute')
  @ApiOperation({ summary: 'Re-evaluate all achievements for the current user. Returns newly-unlocked keys.' })
  async recompute(@CurrentUser() u: any) {
    const newKeys = await this.svc.recomputeForUser(u.id);
    return { newlyEarned: newKeys };
  }
}
