import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { QuizService } from './quiz.service';
import {
  CreateQuizDto,
  UpdateQuizDto,
  SubmitAttemptDto,
  AdaptiveAnswerDto,
  CreateQuizQuestionDto,
  UpdateQuizQuestionDto,
} from './quiz.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { QuizBroadcastService } from '../telegram/quiz-broadcast.service';

@ApiTags('Quizzes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class QuizController {
  constructor(
    private svc: QuizService,
    private telegramBroadcast: QuizBroadcastService,
  ) {}

  @Post('quizzes/:id/broadcast-telegram')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary:
      'Fan a quiz out to every linked student in the course as native Telegram quiz polls (with confetti on correct answer)',
  })
  broadcastTelegram(@Param('id') id: string, @CurrentUser() u: any) {
    return this.telegramBroadcast.broadcast(id, u);
  }

  @Get('courses/:courseId/quizzes')
  @ApiOperation({ summary: 'List quizzes for a course' })
  listByCourse(@Param('courseId') courseId: string, @CurrentUser() u: any) {
    return this.svc.listByCourse(courseId, u);
  }

  @Post('courses/:courseId/quizzes')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Create quiz with questions (teacher/admin)' })
  create(@Param('courseId') courseId: string, @Body() dto: CreateQuizDto, @CurrentUser() u: any) {
    return this.svc.create(courseId, dto, u);
  }

  @Get('quizzes/:id')
  @ApiOperation({ summary: 'Get quiz with questions (students see correctIndex=-1)' })
  one(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.findOne(id, u);
  }

  @Patch('quizzes/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Update quiz metadata (author or admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateQuizDto, @CurrentUser() u: any) {
    return this.svc.update(id, dto, u);
  }

  @Delete('quizzes/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Soft-delete quiz (author or admin)' })
  remove(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.remove(id, u);
  }

  // ─── Single-question CRUD (author or admin only) ────────────────────

  @Post('quizzes/:id/questions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Append a new question to the quiz (auto position = max+1). Author or admin only.',
  })
  addQuestion(@Param('id') id: string, @Body() dto: CreateQuizQuestionDto, @CurrentUser() u: any) {
    return this.svc.addQuestion(id, dto, u);
  }

  @Patch('quiz-questions/:questionId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Update a single question. Supplying `position` reorders within the quiz.',
  })
  updateQuestion(@Param('questionId') questionId: string, @Body() dto: UpdateQuizQuestionDto, @CurrentUser() u: any) {
    return this.svc.updateQuestion(questionId, dto, u);
  }

  @Delete('quiz-questions/:questionId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Soft-delete a question. Remaining questions are reindexed to keep positions dense.',
  })
  deleteQuestion(@Param('questionId') questionId: string, @CurrentUser() u: any) {
    return this.svc.deleteQuestion(questionId, u);
  }

  @Post('quizzes/:id/attempts')
  @ApiOperation({ summary: 'Start a new attempt (student)' })
  startAttempt(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.startAttempt(id, u);
  }

  @Patch('quizzes/:id/attempts/:attemptId/submit')
  @ApiOperation({ summary: 'Submit answers for an attempt (student)' })
  submitAttempt(
    @Param('id') id: string,
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitAttemptDto,
    @CurrentUser() u: any,
  ) {
    return this.svc.submitAttempt(id, attemptId, dto, u);
  }

  @Get('quizzes/:id/attempts/me')
  @ApiOperation({ summary: 'Get my attempts for a quiz' })
  myAttempts(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.myAttempts(id, u);
  }

  @Get('quizzes/:id/attempts')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Get all attempts for a quiz (teacher/admin)' })
  allAttempts(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.allAttempts(id, u);
  }

  // ─── Adaptive practice ────────────────────────────────────────────────

  @Post('quizzes/:id/adaptive/start')
  @ApiOperation({
    summary: 'Begin an adaptive practice session — server picks the first question and tracks streaks',
  })
  startAdaptive(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.startAdaptive(id, u);
  }

  @Post('quizzes/:id/adaptive/answer')
  @ApiOperation({
    summary: 'Submit an adaptive answer; server replies with feedback + next question (or done=true)',
  })
  answerAdaptive(@Param('id') _id: string, @Body() dto: AdaptiveAnswerDto, @CurrentUser() u: any) {
    return this.svc.answerAdaptive(dto, u);
  }
}
