import { Module } from '@nestjs/common';
import { GiftService } from './gift.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [GiftService],
  exports: [GiftService],
})
export class GiftModule {}