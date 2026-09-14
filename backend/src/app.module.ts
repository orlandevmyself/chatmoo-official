import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';
import { SessionModule } from './session/session.module';
import { ChatroomModule } from './chatroom/chatroom.module';
import { MatchModule } from './match/match.module';
import { UploadModule } from './upload/upload.module';
import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { WalletModule } from './wallet/wallet.module';
import { AdminModule } from './admin/admin.module';
import { LoudSpeakerModule } from './loud-speaker/loud-speaker.module';
import { MessageRequestModule } from './message-request/message-request.module';
import { PremiumModule } from './premium/premium.module';
import { UtilsModule } from './utils/utils.module';
import { BlockReportModule } from './block-report/block-report.module';
import { PaymongoModule } from './paymongo/paymongo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    HealthModule,
    UserModule,
    SessionModule,
    ChatroomModule,
    MatchModule,
    UploadModule,
    AuthModule,
    ConversationsModule,
    WalletModule,
    AdminModule,
    LoudSpeakerModule,
    MessageRequestModule,
    PremiumModule,
    UtilsModule,
    BlockReportModule,
    PaymongoModule,
  ],
})
export class AppModule {}