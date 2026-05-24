import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PdfReportsService } from './pdf-reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class PdfReportsController {
  constructor(private svc: PdfReportsService) {}

  @Get('courses/:id/grades.pdf')
  @ApiOperation({ summary: 'Course gradebook as PDF (teacher/admin only)' })
  @ApiProduces('application/pdf')
  gradebook(@Param('id') id: string, @CurrentUser() u: any, @Res() res: Response) {
    return this.svc.streamGradebook(id, u, res);
  }

  @Get('courses/:id/attendance.pdf')
  @ApiOperation({ summary: 'Course attendance summary as PDF (teacher/admin only)' })
  @ApiProduces('application/pdf')
  attendance(@Param('id') id: string, @CurrentUser() u: any, @Res() res: Response) {
    return this.svc.streamAttendance(id, u, res);
  }

  @Get('me/transcript.pdf')
  @ApiOperation({ summary: 'Personal academic transcript across all enrolled courses' })
  @ApiProduces('application/pdf')
  transcript(@CurrentUser() u: any, @Res() res: Response) {
    return this.svc.streamTranscript(u, res);
  }
}
