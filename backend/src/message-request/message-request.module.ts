import { Module } from '@nestjs/common';
import { MessageRequestService } from './message-request.service';
import { MessageRequestController } from './message-request.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MessageRequestService],
  controllers: [MessageRequestController],
  exports: [MessageRequestService],
})
export class MessageRequestModule {}
