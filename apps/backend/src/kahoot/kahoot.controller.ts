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

  /**
   * Feature #4 — student's own post-session view. Returns the caller's
   * score, rank, and per-question answer trail. Distinct endpoint from
   * /report (which is host-only) so students can't see each other's
   * answers; 403 if the caller didn't actually play this session.
   */
  @Get('sessions/:id/my-results')
  @ApiOperation({ summary: 'Student-facing post-session results: own score, rank, and answer trail' })
  myResults(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.getMyResults(id, u);
  }

  /**
   * Quiz history endpoints (Feature: Kahoot history).
   *
   *   /sessions/my-history     → sessions the caller played (any role)
   *   /sessions/hosted-history → sessions the caller hosted (teacher/admin)
   *
   * Both are scoped to the caller — no global session list leaks. Used
   * by the /kahoot/history page so users can find their old games.
   */
  @Get('sessions/my-history')
  @ApiOperation({ summary: 'List of Kahoot sessions the calling user played' })
  myHistory(@CurrentUser() u: any) {
    return this.svc.getMyKahootHistory(u);
  }

  @Get('sessions/hosted-history')
  @ApiOperation({ summary: 'List of Kahoot sessions the calling user hosted (teacher/admin only)' })
  hostedHistory(@CurrentUser() u: any) {
    return this.svc.getHostedKahootHistory(u);
  }
}
