import { Module } from '@nestjs/common';
import { PaymongoService } from './paymongo.service';
import { PaymongoController } from './paymongo.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaymongoController],
  providers: [PaymongoService],
  exports: [PaymongoService],
})
export class PaymongoModule {}
