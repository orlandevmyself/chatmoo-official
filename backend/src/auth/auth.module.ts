import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { GuestCleanupService } from './guest-cleanup.service';
import { GuestCleanupController } from './guest-cleanup.controller';
import { GuestCleanupScheduler } from './guest-cleanup.scheduler';
import { SessionModule } from '../session/session.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'google' }), SessionModule, PrismaModule],
  controllers: [AuthController, GuestCleanupController],
  providers: [AuthService, GoogleStrategy, GuestCleanupService, GuestCleanupScheduler],
  exports: [AuthService, GuestCleanupService],
})
export class AuthModule {}
