import {
  Controller, Post, Body, UseGuards, Res, HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { AiService } from './ai.service';
import { AssignmentFeedbackDto, GenerateQuizDto, CourseSummaryDto, StudentAnalysisDto, ChatMessageDto, StudyCoachDto, ClassInsightsDto } from './ai.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('ai')
export class AiController {
  constructor(private svc: AiService) {}

  @Post('assignment-feedback')
  @HttpCode(200)
  @ApiOperation({ summary: 'AI feedback for a student submission (student: own submission only; teacher/admin: any)' })
  @ApiResponse({ status: 200, description: 'Feedback with assessment, strengths, improvements, suggestions. _demo:true when no LLM key.' })
  @ApiResponse({ status: 403, description: 'Student accessing another student\'s submission' })
  assignmentFeedback(@Body() dto: AssignmentFeedbackDto, @CurrentUser() user: any) {
    return this.svc.getAssignmentFeedback(dto, user.id, user.role);
  }

  @Post('generate-quiz')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate a quiz for a course topic (teacher/admin only)' })
  @ApiResponse({ status: 200, description: 'Quiz with questions, options, correctIndex, explanation. _demo:true when no LLM key.' })
  @ApiResponse({ status: 403, description: 'Students cannot generate quizzes' })
  generateQuiz(@Body() dto: GenerateQuizDto, @CurrentUser() user: any) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teachers and admins can generate quizzes');
    }
    return this.svc.generateQuiz(dto, user.id);
  }

  @Post('course-summary')
  @HttpCode(200)
  @ApiOperation({ summary: 'AI-generated course overview and study tips (all authenticated users)' })
  @ApiResponse({ status: 200, description: 'Summary with keyTopics, tips, workload. _demo:true when no LLM key.' })
  courseSummary(@Body() dto: CourseSummaryDto, @CurrentUser() user: any) {
    return this.svc.getCourseSummary(dto, user.id);
  }

  @Post('student-analysis')
  @HttpCode(200)
  @ApiOperation({ summary: '[Deprecated] AI analysis of student performance. Use /ai/study-coach instead.' })
  @ApiResponse({ status: 200, description: 'Analysis with strengths, areasToImprove, recommendations, riskLevel. _demo:true when no LLM key.' })
  @ApiResponse({ status: 403, description: 'Student accessing another student\'s analysis' })
  studentAnalysis(@Body() dto: StudentAnalysisDto, @CurrentUser() user: any) {
    return this.svc.getStudentAnalysis(dto, user.id, user.role);
  }

  @Post('study-coach')
  @HttpCode(200)
  @ApiOperation({ summary: 'Personal AI Study Coach: predicted grade trajectory + study plan + mistake patterns' })
  @ApiResponse({ status: 200, description: 'trajectory{}, weaknesses[], studyPlan[], mistakePatterns[]. _demo:true when no LLM key.' })
  studyCoach(@Body() dto: StudyCoachDto, @CurrentUser() user: any) {
    return this.svc.getStudyCoach(dto, user.id, user.role);
  }

  @Post('class-insights')
  @HttpCode(200)
  @ApiOperation({ summary: 'Teacher-only: at-risk students + class weakness map + high performers (course-wide)' })
  @ApiResponse({ status: 200, description: 'atRiskStudents[], classWeaknesses[], highPerformers[]. _demo:true when no LLM key.' })
  @ApiResponse({ status: 403, description: 'Students cannot view class insights' })
  classInsights(@Body() dto: ClassInsightsDto, @CurrentUser() user: any) {
    return this.svc.getClassInsights(dto, user.id, user.role);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Streaming AI assistant chat (SSE). Demo mode streams placeholder text when no LLM key.' })
  async chat(@Body() dto: ChatMessageDto, @CurrentUser() user: any, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.svc.chatStream(dto.message, user.id, dto.context, dto.lang)) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (e: any) {
      res.write(`data: ${JSON.stringify({ error: e.message || 'AI error' })}\n\n`);
    } finally {
      res.end();
    }
  }
}
