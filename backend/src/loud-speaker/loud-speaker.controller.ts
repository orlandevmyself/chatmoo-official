import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { LoudSpeakerService } from './loud-speaker.service';

@Controller('loud-speaker')
export class LoudSpeakerController {
  constructor(private loudSpeakerService: LoudSpeakerService) {}

  @Post('create')
  async createCampaign(
    @Query('userId') userId: string,
    @Body() body: { message: string; scope: string; durationMinutes: number },
  ) {
    return this.loudSpeakerService.createCampaign(userId, body);
  }

  @Get('active')
  async getActiveCampaigns(@Query('scope') scope?: string) {
    return this.loudSpeakerService.getActiveCampaigns(scope);
  }

  @Get('config')
  async getPublicConfig() {
    return this.loudSpeakerService.getPublicConfig();
  }

  @Get('user')
  async getUserCampaigns(@Query('userId') userId: string) {
    return this.loudSpeakerService.getUserCampaigns(userId);
  }

  @Post(':id/impression')
  async recordImpression(@Param('id') campaignId: string) {
    await this.loudSpeakerService.recordImpression(campaignId);
    return { ok: true };
  }

  @Post(':id/click')
  async recordClick(@Param('id') campaignId: string) {
    await this.loudSpeakerService.recordClick(campaignId);
    return { ok: true };
  }

  @Delete(':id')
  async cancelCampaign(
    @Query('userId') userId: string,
    @Param('id') campaignId: string,
  ) {
    return this.loudSpeakerService.cancelCampaign(userId, campaignId);
  }
}
