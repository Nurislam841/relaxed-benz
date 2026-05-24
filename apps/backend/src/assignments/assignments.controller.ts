import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AssignmentsService } from './assignments.service';
import {
  CreateAssignmentDto,
  UpdateAssignmentDto,
  SubmitDto,
  GradeDto,
  CreateCommentDto,
  SaveDraftDto,
} from './assignments.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'audio/mpeg',
  'audio/mp4',
];

const mimeFilter = (_req: any, file: Express.Multer.File, cb: (e: Error | null, accept: boolean) => void) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException(`File type "${file.mimetype}" is not allowed`), false);
  }
};

// Memory storage: multer keeps the file as a Buffer on `file.buffer` instead of
// writing it to `./uploads`. StorageService then decides where the bytes
// actually land (disk in dev, S3 in prod). Memory cost is bounded by
// MAX_FILE_SIZE per file × FilesInterceptor's count limit (10 below) so for a
// university LMS this is well within reason.
const uploadOptions = { storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE }, fileFilter: mimeFilter };

@ApiTags('Assignments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class AssignmentsController {
  constructor(private svc: AssignmentsService) {}

  @Get('courses/:id/assignments')
  @ApiOperation({ summary: 'List assignments for a course' })
  byCourse(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.svc.findByCourse(id, page ? +page : undefined, limit ? +limit : undefined);
  }

  @Post('courses/:id/assignments')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Create assignment (teacher/admin)' })
  create(@Param('id') id: string, @Body() dto: CreateAssignmentDto, @CurrentUser() u: any) {
    return this.svc.create(id, dto, u);
  }

  @Get('assignments/:id')
  @ApiOperation({ summary: 'Get single assignment' })
  one(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch('assignments/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Update assignment (teacher/admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    return this.svc.update(id, dto);
  }

  @Delete('assignments/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Delete assignment (teacher/admin)' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post('assignments/:id/submit')
  @UseGuards(RolesGuard)
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit assignment (student)' })
  submit(@Param('id') id: string, @Body() dto: SubmitDto, @CurrentUser() u: any) {
    return this.svc.submit(id, dto, u.id);
  }

  @Post('assignments/:id/submit-file')
  @UseGuards(RolesGuard)
  @Roles(Role.STUDENT)
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit assignment with single file upload (student)' })
  async submitFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() u: any) {
    return this.svc.submitSingleFile(id, file, u.id);
  }

  @Post('assignments/:id/submit-files')
  @UseGuards(RolesGuard)
  @Roles(Role.STUDENT)
  @UseInterceptors(FilesInterceptor('files', 10, uploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit assignment with multiple file uploads (student)' })
  submitFiles(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { contentText?: string; contentUrl?: string },
    @CurrentUser() u: any,
  ) {
    return this.svc.submitWithFiles(id, files, body, u.id);
  }

  @Post('assignments/:id/save-draft')
  @UseGuards(RolesGuard)
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Save submission as draft (student)' })
  saveDraft(@Param('id') id: string, @Body() dto: SaveDraftDto, @CurrentUser() u: any) {
    return this.svc.saveDraft(id, dto, u.id);
  }

  @Get('courses/:id/my-submissions')
  @ApiOperation({ summary: 'Get my submissions for a course (student)' })
  mySubmissions(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.getMySubmissionsForCourse(id, u.id);
  }

  @Get('assignments/:id/submission')
  @ApiOperation({ summary: 'Get my submission' })
  mySub(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.getMySub(id, u.id);
  }

  @Get('assignments/:id/submissions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Get all submissions for assignment (teacher/admin)' })
  allSubs(@Param('id') id: string) {
    return this.svc.allSubs(id);
  }

  @Get('submissions/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Get single submission details (teacher/admin)' })
  subById(@Param('id') id: string) {
    return this.svc.getSubById(id);
  }

  @Post('submissions/:id/grade')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Grade submission (teacher/admin)' })
  grade(@Param('id') id: string, @Body() dto: GradeDto, @CurrentUser() u: any) {
    return this.svc.grade(id, dto, u.id);
  }

  @Patch('submissions/:id/grade')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Grade submission via PATCH (teacher/admin)' })
  gradePatch(@Param('id') id: string, @Body() dto: GradeDto, @CurrentUser() u: any) {
    return this.svc.grade(id, dto, u.id);
  }

  @Post('assignments/:id/resources')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @UseInterceptors(FilesInterceptor('files', 10, uploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload resource files to an assignment (teacher/admin)' })
  uploadResources(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() u: any) {
    if (!files?.length) throw new BadRequestException('No files provided');
    return this.svc.uploadResources(id, files, u);
  }

  @Delete('assignments/:id/resources/:resourceId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Delete a resource file from an assignment (teacher/admin)' })
  deleteResource(@Param('id') id: string, @Param('resourceId') resourceId: string, @CurrentUser() u: any) {
    return this.svc.deleteResource(resourceId, u);
  }

  @Get('assignments/:id/comments')
  @ApiOperation({ summary: 'Get comments for an assignment' })
  getComments(@Param('id') id: string) {
    return this.svc.getComments(id);
  }

  @Post('assignments/:id/comments')
  @ApiOperation({ summary: 'Add a comment to an assignment' })
  addComment(@Param('id') id: string, @Body() dto: CreateCommentDto, @CurrentUser() u: any) {
    return this.svc.addComment(id, dto, u.id);
  }
}
