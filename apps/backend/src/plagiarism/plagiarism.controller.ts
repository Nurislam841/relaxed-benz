import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PlagiarismService } from './plagiarism.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Plagiarism')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.TEACHER)
@Controller()
export class PlagiarismController {
  constructor(private svc: PlagiarismService) {}

  @Post('assignments/:id/check-plagiarism')
  @ApiOperation({ summary: 'Run Jaccard 3-gram plagiarism check across all submissions' })
  check(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.checkAssignment(id, u);
  }

  @Get('assignments/:id/plagiarism-reports')
  @ApiOperation({ summary: 'List cached plagiarism reports for an assignment' })
  list(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.listByAssignment(id, u);
  }

  @Get('submissions/:id/plagiarism')
  @ApiOperation({ summary: 'Get plagiarism reports involving a specific submission' })
  forSubmission(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.forSubmission(id, u);
  }
}
