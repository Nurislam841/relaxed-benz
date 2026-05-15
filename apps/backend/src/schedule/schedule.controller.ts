import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ScheduleService } from './schedule.service';
import { CreateScheduleItemDto, UpdateScheduleItemDto } from './schedule.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Schedule')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ScheduleController {
  constructor(private svc: ScheduleService) {}

  @Get('me/schedule')
  @ApiOperation({ summary: 'Get current user schedule between two dates' })
  my(@CurrentUser() u: any, @Query('from') from: string, @Query('to') to: string) {
    return this.svc.getMySchedule(u, from, to);
  }

  @Get('me/calendar')
  @ApiOperation({ summary: 'Get current user calendar (schedule + assignments) for a month' })
  cal(@CurrentUser() u: any, @Query('month') month: string) {
    return this.svc.getCalendar(u, month);
  }

  @Get('courses/:id/schedule')
  @ApiOperation({ summary: 'Get schedule for a course' })
  cs(@Param('id') id: string, @Query('from') f?: string, @Query('to') t?: string) {
    return this.svc.getCourseSchedule(id, f, t);
  }

  @Post('courses/:id/schedule')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Add a schedule item to a course (teacher/admin)' })
  create(@Param('id') id: string, @Body() dto: CreateScheduleItemDto, @CurrentUser() u: any) {
    return this.svc.create(id, dto, u);
  }

  // ─── Admin/teacher CRUD endpoints ─────────────────────────────────────────────
  // The `/admin/schedule` screen lets staff edit individual sessions in place
  // rather than only seeding via Prisma migrations.

  @Get('admin/schedule')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'List all schedule items (admin/teacher)' })
  listAll(@Query('courseId') courseId?: string, @Query('groupId') groupId?: string) {
    return this.svc.listAll({ courseId, groupId });
  }

  @Patch('schedule/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Update a schedule item (teacher of course or admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateScheduleItemDto, @CurrentUser() u: any) {
    return this.svc.update(id, dto, u);
  }

  @Delete('schedule/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Soft-delete a schedule item (teacher of course or admin)' })
  remove(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.remove(id, u);
  }
}
