import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { PremiumService } from './premium.service';

@Controller('premium')
export class PremiumController {
  constructor(private premiumService: PremiumService) {}

  @Get('tiers')
  async getTiers() {
    return this.premiumService.getPremiumTiers();
  }

  @Get('status')
  async getStatus(@Query('userId') userId: string) {
    return this.premiumService.getPremiumStatus(userId);
  }

  @Get('is-premium')
  async isPremium(@Query('userId') userId: string) {
    const isPremium = await this.premiumService.isPremium(userId);
    return { isPremium };
  }

  @Get('stats')
  async getStats(@Query('adminUserId') adminUserId: string) {
    return this.premiumService.getPremiumStats();
  }

  @Post('purchase')
  async purchase(
    @Query('userId') userId: string,
    @Body() body: { tier: string },
  ) {
    return this.premiumService.purchasePremium(userId, body.tier);
  }

  @Post('update-tiers')
  async updateTiers(
    @Query('adminUserId') adminUserId: string,
    @Body() tierUpdates: Record<string, { costCoins?: number; costPHP?: number }>,
  ) {
    return this.premiumService.updateTierPricing(tierUpdates);
  }
}
