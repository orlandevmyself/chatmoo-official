import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get()
  async getBalance(@Query('userId') userId: string) {
    console.log('[WalletController] Getting balance for user:', userId);
    return this.walletService.getBalance(userId);
  }

  @Get('transactions')
  async listTransactions(
    @Query('userId') userId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    console.log('[WalletController] Listing transactions for user:', userId, type, status);
    return this.walletService.listTransactions(userId, { type, status, page, limit });
  }

  @Get('transactions/:txId')
  async getTransaction(@Param('txId') txId: string, @Query('userId') userId: string) {
    return this.walletService.getTransaction(userId, txId);
  }

  @Post('deposit')
  async createDeposit(@Body() body: {
    userId: string;
    amountMinor: number;
    method?: string;
    idempotencyKey?: string;
  }) {
    console.log('[WalletController] Deposit request for user:', body?.userId, body?.amountMinor);
    return this.walletService.createDeposit(body?.userId, {
      amountMinor: body?.amountMinor,
      method: body?.method,
      idempotencyKey: body?.idempotencyKey,
    });
  }

  @Post('withdraw')
  async createWithdraw(@Body() body: {
    userId: string;
    amountMinor: number;
    method?: string;
    accountName?: string;
    accountNumber?: string;
    idempotencyKey?: string;
  }) {
    console.log('[WalletController] Withdraw request for user:', body?.userId, body?.amountMinor);
    return this.walletService.createWithdraw(body?.userId, {
      amountMinor: body?.amountMinor,
      method: body?.method,
      accountName: body?.accountName,
      accountNumber: body?.accountNumber,
      idempotencyKey: body?.idempotencyKey,
    });
  }
}
