import { Module } from '@nestjs/common';
import { LoudSpeakerService } from './loud-speaker.service';
import { LoudSpeakerController } from './loud-speaker.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [LoudSpeakerController],
  providers: [LoudSpeakerService],
  exports: [LoudSpeakerService],
})
export class LoudSpeakerModule {}
