import { Module } from '@nestjs/common';
import { PdfReportsController } from './pdf-reports.controller';
import { PdfReportsService } from './pdf-reports.service';

@Module({
  controllers: [PdfReportsController],
  providers: [PdfReportsService],
})
export class PdfReportsModule {}
