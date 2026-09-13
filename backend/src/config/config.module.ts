import { Module } from '@nestjs/common';
import { AppConfigService } from './config.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
