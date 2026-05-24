import { Module } from '@nestjs/common';
import { CalendarExportController } from './calendar-export.controller';
import { CalendarExportService } from './calendar-export.service';

@Module({
  controllers: [CalendarExportController],
  providers: [CalendarExportService],
})
export class CalendarExportModule {}
