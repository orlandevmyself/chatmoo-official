import { Module } from '@nestjs/common';
import { ChatroomController } from './chatroom.controller';
import { ChatroomService } from './chatroom.service';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { SessionModule } from '../session/session.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { WalletModule } from '../wallet/wallet.module';
import { BlockReportModule } from '../block-report/block-report.module';

@Module({
  imports: [PrismaModule, RedisModule, SessionModule, ConversationsModule, WalletModule, BlockReportModule],
  controllers: [ChatroomController],
  providers: [ChatroomService, ChatGateway],
  exports: [ChatroomService, ChatGateway],
})
export class ChatroomModule {}