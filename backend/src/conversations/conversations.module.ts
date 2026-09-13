import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { SaveOfferController } from './save-offer.controller';
import { SaveOfferService } from './save-offer.service';
import { ReconnectionController } from './reconnection.controller';
import { ReconnectionService } from './reconnection.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [PrismaModule, SessionModule],
  controllers: [ConversationsController, SaveOfferController, ReconnectionController],
  providers: [ConversationsService, SaveOfferService, ReconnectionService],
  exports: [ConversationsService, SaveOfferService, ReconnectionService],
})
export class ConversationsModule {}