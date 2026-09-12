import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { SessionModule } from '../session/session.module';
import { ChatroomModule } from '../chatroom/chatroom.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [SessionModule, ChatroomModule, PrismaModule],
  controllers: [MatchController],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}