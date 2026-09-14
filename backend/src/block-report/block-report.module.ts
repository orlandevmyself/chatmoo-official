import { Module } from '@nestjs/common';
import { BlockReportService } from './block-report.service';
import { BlockReportController } from './block-report.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BlockReportService],
  controllers: [BlockReportController],
  exports: [BlockReportService],
})
export class BlockReportModule {}
