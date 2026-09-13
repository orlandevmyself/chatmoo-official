import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminWalletService } from './admin-wallet.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GiftModule } from '../gifts/gift.module';
import { AppConfigModule } from '../config/config.module';

@Module({
  imports: [PrismaModule, GiftModule, AppConfigModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthService, AdminWalletService],
})
export class AdminModule {}