import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CalendarExportService } from './calendar-export.service';

@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('me')
export class CalendarExportController {
  constructor(private svc: CalendarExportService) {}

  @Get('schedule.ics')
  @ApiOperation({
    summary: "Download the user's schedule + assignment deadlines as an iCalendar (.ics) file",
  })
  @ApiProduces('text/calendar')
  async ics(@CurrentUser() user: any, @Res() res: Response) {
    const body = await this.svc.forUser(user);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="unilms-schedule.ics"');
    // Allow subscriptions to refresh — calendar apps cache aggressively.
    res.setHeader('Cache-Control', 'private, max-age=900');
    res.send(body);
  }
}
