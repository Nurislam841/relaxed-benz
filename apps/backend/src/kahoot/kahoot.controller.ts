import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { KahootService } from './kahoot.service';
import { CreateSessionDto, SubmitAnswerDto } from './kahoot.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Kahoot')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('kahoot')
export class KahootController {
  constructor(private svc: KahootService) {}

  @Post('sessions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Host: create a live Kahoot session from a quiz' })
  create(@Body() dto: CreateSessionDto, @CurrentUser() u: any) {
    return this.svc.createSession(dto, u);
  }

  @Get('sessions/by-code/:joinCode')
  @ApiOperation({ summary: 'Player: look up session by 6-char join code' })
  joinByCode(@Param('joinCode') joinCode: string, @CurrentUser() u: any) {
    return this.svc.joinByCode(joinCode, u);
  }

  @Post('sessions/:id/start')
  @ApiOperation({ summary: 'Host: start the session (LOBBY → IN_PROGRESS)' })
  start(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.start(id, u);
  }

  @Post('sessions/:id/next')
  @ApiOperation({ summary: 'Host: advance to the next question or finish' })
  next(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.next(id, u);
  }

  @Get('sessions/:id/current-question')
  @ApiOperation({ summary: 'Get the currently active question (without correctIndex)' })
  current(@Param('id') id: string) {
    return this.svc.currentQuestion(id);
  }

  @Post('sessions/:id/answer')
  @ApiOperation({ summary: 'Player: submit an answer to the current question' })
  answer(@Param('id') id: string, @Body() dto: SubmitAnswerDto, @CurrentUser() u: any) {
    return this.svc.answer(id, dto, u);
  }

  @Get('sessions/:id/leaderboard')
  @ApiOperation({ summary: 'Get current leaderboard for this session' })
  leaderboard(@Param('id') id: string) {
    return this.svc.leaderboard(id);
  }

  @Post('sessions/:id/finish')
  @ApiOperation({ summary: 'Host: end the session early' })
  finish(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.finish(id, u);
  }

  @Get('sessions/:id/report')
  @ApiOperation({
    summary:
      'Detailed post-session report (host or admin): per-player answer trail + per-question distribution & accuracy',
  })
  report(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.getSessionReport(id, u);
  }
}
