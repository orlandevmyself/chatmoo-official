import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPaymentProvider } from './payment-providers';
import { getGift } from './gift-catalog';

// Demo guardrails (minor units = centavos). Real limits/fees/KYC tiers belong
// to the licensed production configuration, not here.
const MIN_DEPOSIT_MINOR = 2000; // ₱20
const MIN_WITHDRAW_MINOR = 5000; // ₱50
const MAX_TX_MINOR = 5000000; // ₱50,000
const ALLOWED_METHODS = ['gcash', 'maya', 'card', 'bank'];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  private maskAccount(accountNumber?: string) {
    if (!accountNumber) return undefined;
    const digits = accountNumber.replace(/\D/g, '');
    if (digits.length <= 4) return '****';
    return `****${digits.slice(-4)}`;
  }

  private toClient(tx: any) {
    if (!tx) return tx;
    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      fee: tx.fee,
      status: tx.status,
      provider: tx.provider,
      providerRef: tx.providerRef,
      method: tx.method,
      destination: tx.destination,
      remarks: tx.remarks,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
  }

  async getOrCreateWallet(userId: string) {
    return (this.prisma as any).wallet.upsert({
      where: { userId },
      create: { userId, balance: 0, currency: 'PHP', status: 'active' },
      update: {},
    });
  }

  async getBalance(userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    const wallet = await this.getOrCreateWallet(userId);
    return { balance: wallet.balance, currency: wallet.currency, status: wallet.status };
  }

  async listTransactions(userId: string, query: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    if (!userId) throw new BadRequestException('userId is required');
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const where: any = { userId };
    if (['deposit', 'withdraw', 'gift', 'gift_send', 'gift_receive'].includes(query.type || '')) {
      if (query.type === 'gift') {
        where.type = { in: ['gift_send', 'gift_receive'] };
      } else {
        where.type = query.type;
      }
    }
    if (['pending', 'completed', 'failed', 'cancelled'].includes(query.status || '')) {
      where.status = query.status;
    }

    const [total, rows] = await Promise.all([
      (this.prisma as any).walletTransaction.count({ where }),
      (this.prisma as any).walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { items: rows.map((r: any) => this.toClient(r)), total, page, limit };
  }

  private validateAmount(amountMinor: any, min: number) {
    if (!Number.isInteger(amountMinor) || amountMinor < min || amountMinor > MAX_TX_MINOR) {
      throw new BadRequestException(
        `Amount must be an integer between ${min} and ${MAX_TX_MINOR} (minor units)`,
      );
    }
  }

  private validateMethod(method?: string) {
    if (method && !ALLOWED_METHODS.includes(method)) {
      throw new BadRequestException(`Unsupported method. Use one of: ${ALLOWED_METHODS.join(', ')}`);
    }
  }

  async createDeposit(userId: string, data: {
    amountMinor: number;
    method?: string;
    idempotencyKey?: string;
  }) {
    if (!userId) throw new BadRequestException('userId is required');
    this.validateAmount(data.amountMinor, MIN_DEPOSIT_MINOR);
    this.validateMethod(data.method);

    const provider = getPaymentProvider(); // throws safely if misconfigured
    const quote = provider.quote('deposit', data.amountMinor, data.method);

    try {
      const tx = await (this.prisma as any).$transaction(async (t: any) => {
        const wallet = await t.wallet.upsert({
          where: { userId },
          create: { userId, balance: 0, currency: 'PHP', status: 'active' },
          update: {},
        });
        if (wallet.status !== 'active') {
          throw new BadRequestException('Wallet is frozen');
        }
        return t.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            type: 'deposit',
            amount: data.amountMinor,
            fee: quote.feeMinor,
            status: 'pending',
            provider: provider.name,
            method: data.method,
            idempotencyKey: data.idempotencyKey || undefined,
          },
        });
      });

      // Settle asynchronously (demo: short delay, then credit).
      void this.settleDeposit(tx.id, quote.etaSeconds);
      return this.toClient(tx);
    } catch (e: any) {
      // Idempotent retry: return the already-created row.
      if (e?.code === 'P2002' && data.idempotencyKey) {
        const existing = await (this.prisma as any).walletTransaction.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
        });
        if (existing) return this.toClient(existing);
      }
      throw e;
    }
  }

  private async settleDeposit(txId: string, etaSeconds: number) {
    try {
      await delay(Math.min(etaSeconds, 10) * 1000);
      const tx = await (this.prisma as any).walletTransaction.findUnique({ where: { id: txId } });
      if (!tx || tx.status !== 'pending') return; // already handled / cancelled
      const provider = getPaymentProvider();
      const { providerRef } = await provider.initiateDeposit(txId, tx.userId, tx.amount, tx.method);
      // Idempotent credit: only pending rows move.
      const moved = await (this.prisma as any).$transaction(async (t: any) => {
        const claimed = await t.walletTransaction.updateMany({
          where: { id: txId, status: 'pending' },
          data: { status: 'completed', providerRef },
        });
        if (claimed.count === 0) return 0;
        await t.wallet.update({
          where: { id: tx.walletId },
          data: { balance: { increment: tx.amount } },
        });
        return 1;
      });
      console.log('[WalletService] Deposit settled:', txId, 'credited:', moved === 1);
    } catch (e: any) {
      console.error('[WalletService] Deposit settlement failed:', txId, e?.message);
      await (this.prisma as any).walletTransaction.updateMany({
        where: { id: txId, status: 'pending' },
        data: { status: 'failed', remarks: 'Provider settlement failed' },
      });
    }
  }

  async createWithdraw(userId: string, data: {
    amountMinor: number;
    method?: string;
    accountName?: string;
    accountNumber?: string;
    idempotencyKey?: string;
  }) {
    if (!userId) throw new BadRequestException('userId is required');
    this.validateAmount(data.amountMinor, MIN_WITHDRAW_MINOR);
    this.validateMethod(data.method);

    const provider = getPaymentProvider(); // throws safely if misconfigured
    const quote = provider.quote('withdraw', data.amountMinor, data.method);
    const total = data.amountMinor + quote.feeMinor;

    try {
      const tx = await (this.prisma as any).$transaction(async (t: any) => {
        const wallet = await t.wallet.upsert({
          where: { userId },
          create: { userId, balance: 0, currency: 'PHP', status: 'active' },
          update: {},
        });
        if (wallet.status !== 'active') {
          throw new BadRequestException('Wallet is frozen');
        }
        // Atomic reservation: only debits when funds cover it.
        const reserved = await t.wallet.updateMany({
          where: { id: wallet.id, balance: { gte: total } },
          data: { balance: { decrement: total } },
        });
        if (reserved.count === 0) {
          throw new BadRequestException('Insufficient balance');
        }
        return t.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            type: 'withdraw',
            amount: data.amountMinor,
            fee: quote.feeMinor,
            status: 'pending',
            provider: provider.name,
            method: data.method,
            destination: this.maskAccount(data.accountNumber),
            remarks: data.accountName ? `To ${data.accountName}` : undefined,
            idempotencyKey: data.idempotencyKey || undefined,
          },
        });
      });

      // Settle asynchronously (demo: short delay, then release to provider).
      void this.settleWithdraw(tx.id, quote.etaSeconds);
      return this.toClient(tx);
    } catch (e: any) {
      if (e?.code === 'P2002' && data.idempotencyKey) {
        const existing = await (this.prisma as any).walletTransaction.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
        });
        if (existing) return this.toClient(existing);
      }
      throw e;
    }
  }

  private async settleWithdraw(txId: string, etaSeconds: number) {
    try {
      await delay(Math.min(etaSeconds, 10) * 1000);
      const tx = await (this.prisma as any).walletTransaction.findUnique({ where: { id: txId } });
      if (!tx || tx.status !== 'pending') return;
      const provider = getPaymentProvider();
      const { providerRef } = await provider.initiateWithdraw(txId, tx.userId, tx.amount, tx.method, tx.destination);
      const moved = await (this.prisma as any).walletTransaction.updateMany({
        where: { id: txId, status: 'pending' },
        data: { status: 'completed', providerRef },
      });
      console.log('[WalletService] Withdraw settled:', txId, 'completed:', moved.count === 1);
    } catch (e: any) {
      console.error('[WalletService] Withdraw settlement failed, refunding:', txId, e?.message);
      // Refund the reservation on provider failure.
      await (this.prisma as any).$transaction(async (t: any) => {
        const claimed = await t.walletTransaction.updateMany({
          where: { id: txId, status: 'pending' },
          data: { status: 'failed', remarks: 'Provider settlement failed — amount refunded' },
        });
        if (claimed.count === 0) return;
        const tx = await t.walletTransaction.findUnique({ where: { id: txId } });
        await t.wallet.update({
          where: { id: tx.walletId },
          data: { balance: { increment: tx.amount + tx.fee } },
        });
      });
    }
  }

  async getTransaction(userId: string, txId: string) {
    const tx = await (this.prisma as any).walletTransaction.findFirst({
      where: { id: txId, userId },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return this.toClient(tx);
  }

  // Gift transfer: AUTH <-> AUTH only. Atomic debit sender + credit recipient.
  // Uses WalletTransaction rows gift_send / gift_receive so both sides see it
  // in their wallet history. Idempotent via idempotencyKey.
  async sendGift(senderUserId: string, recipientUserId: string, giftKey: string, idempotencyKey?: string) {
    if (!senderUserId || !recipientUserId) throw new BadRequestException('sender and recipient required');
    if (senderUserId === recipientUserId) throw new BadRequestException('Cannot gift yourself');
    const gift = getGift(giftKey);
    if (!gift) throw new BadRequestException('Unknown gift');

    const amountMinor = gift.amountMinor;

    try {
      const result = await (this.prisma as any).$transaction(async (t: any) => {
        const [senderWallet, recipientWallet] = await Promise.all([
          t.wallet.upsert({
            where: { userId: senderUserId },
            create: { userId: senderUserId, balance: 0, currency: 'PHP', status: 'active' },
            update: {},
          }),
          t.wallet.upsert({
            where: { userId: recipientUserId },
            create: { userId: recipientUserId, balance: 0, currency: 'PHP', status: 'active' },
            update: {},
          }),
        ]);

        if (senderWallet.status !== 'active' || recipientWallet.status !== 'active') {
          throw new BadRequestException('Wallet is frozen');
        }

        const reserved = await t.wallet.updateMany({
          where: { id: senderWallet.id, balance: { gte: amountMinor } },
          data: { balance: { decrement: amountMinor } },
        });
        if (reserved.count === 0) {
          throw new BadRequestException('Insufficient balance');
        }

        await t.wallet.update({
          where: { id: recipientWallet.id },
          data: { balance: { increment: amountMinor } },
        });

        const senderTx = await t.walletTransaction.create({
          data: {
            walletId: senderWallet.id,
            userId: senderUserId,
            type: 'gift_send',
            amount: amountMinor,
            fee: 0,
            status: 'completed',
            provider: 'demo',
            method: 'gift',
            remarks: `Gift ${gift.label} to ${recipientUserId} (${gift.coins} coins)`,
            idempotencyKey: idempotencyKey || undefined,
          },
        });

        const recipientTx = await t.walletTransaction.create({
          data: {
            walletId: recipientWallet.id,
            userId: recipientUserId,
            type: 'gift_receive',
            amount: amountMinor,
            fee: 0,
            status: 'completed',
            provider: 'demo',
            method: 'gift',
            remarks: `Gift ${gift.label} from ${senderUserId} (${gift.coins} coins)`,
          },
        });

        return { gift, senderTx: this.toClient(senderTx), recipientTx: this.toClient(recipientTx) };
      });

      console.log('[WalletService] Gift sent:', gift.key, gift.coins, 'coins from', senderUserId, 'to', recipientUserId);
      return result;
    } catch (e: any) {
      if (e?.code === 'P2002' && idempotencyKey) {
        const existing = await (this.prisma as any).walletTransaction.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          const giftAgain = getGift(giftKey)!;
          return { gift: giftAgain, senderTx: this.toClient(existing), recipientTx: null, idempotent: true };
        }
      }
      throw e;
    }
  }

  async getGiftsCatalog() {
    const { GIFT_LIST } = await import('./gift-catalog');
    return GIFT_LIST;
  }
}
