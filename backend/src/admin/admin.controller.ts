import { Controller, Get, Patch, Post, Put, Delete, Query, Body, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminWalletService } from './admin-wallet.service';
import { AdminLoudSpeakerService } from './admin-loud-speaker.service';
import { AdminVoucherService } from './admin-voucher.service';
import { GiftService } from '../gifts/gift.service';
import { AppConfigService } from '../config/config.service';

@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private adminAuthService: AdminAuthService,
    private adminWalletService: AdminWalletService,
    private adminLoudSpeakerService: AdminLoudSpeakerService,
    private adminVoucherService: AdminVoucherService,
    private giftService: GiftService,
    private config: AppConfigService,
  ) {}

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    return this.adminAuthService.loginWithPassword(body.email || '', body.password || '');
  }

  @Post('cleanup')
  async cleanup(@Query('userId') adminUserId: string) {
    return this.adminService.cleanupStaleData(adminUserId);
  }

  @Post('reset-all-data')
  async resetAllData(@Query('userId') adminUserId: string) {
    return this.adminService.resetAllData(adminUserId);
  }

  @Post('reseed-data')
  async reseedData(@Query('userId') adminUserId: string) {
    return this.adminService.reseedData(adminUserId);
  }

  @Get('overview')
  async overview(@Query('userId') adminUserId: string) {
    return this.adminService.getOverview(adminUserId);
  }

  // ---- Users ----
  @Get('users')
  async users(
    @Query('userId') adminUserId: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('banned') banned?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listUsers(adminUserId, { search, role, banned, page, limit });
  }

  @Patch('users/:id/role')
  async setRole(
    @Query('userId') adminUserId: string,
    @Param('id') targetUserId: string,
    @Body() body: { role?: string },
  ) {
    return this.adminService.setUserRole(adminUserId, targetUserId, body.role || 'user');
  }

  @Patch('users/:id/ban')
  async setBan(
    @Query('userId') adminUserId: string,
    @Param('id') targetUserId: string,
    @Body() body: { banned?: boolean },
  ) {
    return this.adminService.setUserBan(adminUserId, targetUserId, !!body.banned);
  }

  // ---- Transactions / reports ----
  @Get('transactions')
  async transactions(
    @Query('userId') adminUserId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listTransactions(adminUserId, { type, status, method, search, page, limit });
  }

  // ---- Platform config ----
  @Get('config')
  async getConfig(@Query('userId') adminUserId: string) {
    await this.adminService.assertAdmin(adminUserId);
    return this.config.getEffectiveConfig();
  }

  @Put('config')
  async updateConfig(
    @Query('userId') adminUserId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    await this.adminService.assertAdmin(adminUserId);
    return this.config.updateConfig(patch);
  }

  @Delete('config/:key')
  async clearConfig(
    @Query('userId') adminUserId: string,
    @Param('key') key: string,
  ) {
    await this.adminService.assertAdmin(adminUserId);
    return this.config.clearOverride(key);
  }

  // ---- Gifts ----
  @Get('gifts')
  async gifts(@Query('userId') adminUserId: string) {
    await this.adminService.assertAdmin(adminUserId);
    return this.giftService.listForAdmin();
  }

  @Post('gifts')
  async createGift(
    @Query('userId') adminUserId: string,
    @Body() body: { key: string; label: string; coins: number; amountMinor: number; emoji?: string; color?: string },
  ) {
    await this.adminService.assertAdmin(adminUserId);
    return this.giftService.upsert(body.key, {
      label: body.label,
      coins: body.coins,
      amountMinor: body.amountMinor,
      emoji: body.emoji,
      color: body.color,
    });
  }

  @Patch('gifts/:key')
  async updateGift(
    @Query('userId') adminUserId: string,
    @Param('key') key: string,
    @Body() patch: { label?: string; coins?: number; amountMinor?: number; emoji?: string; color?: string; lucide?: string; enabled?: boolean; rank?: number },
  ) {
    await this.adminService.assertAdmin(adminUserId);
    return this.giftService.upsert(key, patch);
  }

  @Patch('gifts/:key/enabled')
  async setGiftEnabled(
    @Query('userId') adminUserId: string,
    @Param('key') key: string,
    @Body() body: { enabled?: boolean },
  ) {
    await this.adminService.assertAdmin(adminUserId);
    await this.giftService.setEnabled(key, !!body.enabled);
    return this.giftService.listForAdmin();
  }

  // ---- Wallet & Revenue ----
  @Get('wallet/stats')
  async getWalletStats(@Query('userId') adminUserId: string) {
    await this.adminService.assertAdmin(adminUserId);
    return this.adminWalletService.getWalletStats(adminUserId);
  }

  @Post('wallet/withdraw')
  async withdrawAdminIncome(
    @Query('userId') adminUserId: string,
    @Body() body: { amountMinor: number; method: string; destination: string },
  ) {
    await this.adminService.assertAdmin(adminUserId);
    return this.adminWalletService.withdrawAdminIncome(
      adminUserId,
      body.amountMinor,
      body.method,
      body.destination,
    );
  }

  // ---- Loud Speaker ----
  @Get('loud-speaker/stats')
  async getLoudSpeakerStats(@Query('userId') adminUserId: string) {
    await this.adminService.assertAdmin(adminUserId);
    return this.adminLoudSpeakerService.getStats(adminUserId);
  }

  @Get('loud-speaker/campaigns')
  async listLoudSpeakerCampaigns(
    @Query('userId') adminUserId: string,
    @Query('status') status?: string,
    @Query('scope') scope?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    await this.adminService.assertAdmin(adminUserId);
    return this.adminLoudSpeakerService.listCampaigns(adminUserId, { status, scope, page, limit });
  }

  @Get('loud-speaker/campaigns/:id')
  async getLoudSpeakerCampaignDetails(
    @Query('userId') adminUserId: string,
    @Param('id') campaignId: string,
  ) {
    await this.adminService.assertAdmin(adminUserId);
    return this.adminLoudSpeakerService.getCampaignDetails(adminUserId, campaignId);
  }

  @Get('loud-speaker/config')
  async getLoudSpeakerConfig(@Query('userId') adminUserId: string) {
    await this.adminService.assertAdmin(adminUserId);
    return this.adminLoudSpeakerService.getConfig(adminUserId);
  }

  @Put('loud-speaker/config')
  async updateLoudSpeakerConfig(
    @Query('userId') adminUserId: string,
    @Body() body: any,
  ) {
    await this.adminService.assertAdmin(adminUserId);
    return this.adminLoudSpeakerService.updateConfig(adminUserId, body);
  }

  @Post('loud-speaker/campaigns/:id/cancel')
  async cancelLoudSpeakerCampaign(
    @Query('userId') adminUserId: string,
    @Param('id') campaignId: string,
    @Body() body: { reason?: string },
  ) {
    await this.adminService.assertAdmin(adminUserId);
    return this.adminLoudSpeakerService.cancelCampaign(
      adminUserId,
      campaignId,
      body.reason || 'Admin cancelled',
    );
  }

  // ---- Vouchers ----
  @Get('vouchers')
  async listVouchers(
    @Query('userId') adminUserId: string,
    @Query('active') active?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const activeVal = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.adminVoucherService.listVouchers(adminUserId, { active: activeVal, search, page, limit });
  }

  @Post('vouchers')
  async createVoucher(
    @Query('userId') adminUserId: string,
    @Body() body: {
      bonusType: 'percentage' | 'fixed';
      bonusAmount: number;
      maxBonusMinor?: number;
      maxUses: number;
      validUntil?: string;
      description?: string;
      code?: string;
    },
  ) {
    return this.adminVoucherService.createVoucher(adminUserId, {
      ...body,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
    });
  }

  @Get('vouchers/:id')
  async getVoucherDetail(
    @Query('userId') adminUserId: string,
    @Param('id') voucherId: string,
  ) {
    return this.adminVoucherService.getVoucherDetail(adminUserId, voucherId);
  }

  @Patch('vouchers/:id')
  async updateVoucher(
    @Query('userId') adminUserId: string,
    @Param('id') voucherId: string,
    @Body() body: {
      description?: string;
      maxUses?: number;
      validUntil?: string;
      active?: boolean;
    },
  ) {
    return this.adminVoucherService.updateVoucher(adminUserId, voucherId, {
      ...body,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
    });
  }
}