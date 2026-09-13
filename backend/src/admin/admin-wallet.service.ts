import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminWalletService {
  constructor(private prisma: PrismaService) {}

  async getWalletStats(adminUserId: string) {
    // Get admin wallet
    let adminWallet = await (this.prisma as any).adminWallet.findFirst();
    if (!adminWallet) {
      adminWallet = await (this.prisma as any).adminWallet.create({
        data: { balance: 0, currency: 'PHP', status: 'active' },
      });
    }

    // Calculate stats from wallet transactions
    const allWallets = await (this.prisma as any).wallet.findMany({
      select: { balance: true },
    });

    const totalUserBalance = allWallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    // Get commission stats
    const commissionTransactions = await (this.prisma as any).walletTransaction.findMany({
      where: { adminCommission: { gt: 0 } },
      select: { adminCommission: true, status: true, createdAt: true, type: true },
    });

    const totalCommission = commissionTransactions.reduce(
      (sum, tx) => sum + (tx.adminCommission || 0),
      0,
    );

    const completedCommission = commissionTransactions
      .filter((tx) => tx.status === 'completed')
      .reduce((sum, tx) => sum + (tx.adminCommission || 0), 0);

    // Get withdrawal stats
    const withdrawals = await (this.prisma as any).walletTransaction.findMany({
      where: { type: 'withdraw' },
      select: { amount: true, adminCommission: true, status: true, createdAt: true },
    });

    const totalWithdrawnAmount = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const completedWithdrawals = withdrawals.filter((w) => w.status === 'completed').length;

    // Get deposit stats
    const deposits = await (this.prisma as any).walletTransaction.findMany({
      where: { type: 'deposit' },
      select: { amount: true, status: true, createdAt: true },
    });

    const totalDepositedAmount = deposits.reduce((sum, d) => sum + d.amount, 0);
    const pendingCommission = Math.max(0, (totalCommission || 0) - (completedCommission || 0));

    // Estimated income: 20% commission on total user balance (if all users withdrew)
    const estimatedIncome = Math.ceil((totalUserBalance * 20) / 100);

    return {
      adminWallet: {
        balance: adminWallet.balance || 0,
        currency: adminWallet.currency || 'PHP',
        estimatedIncome: estimatedIncome,
      },
      userStats: {
        totalBalance: totalUserBalance,
        currency: 'PHP',
      },
      commissionStats: {
        totalCommission,
        completedCommission,
        pendingCommission,
        commissionRate: 20, // 20% commission
      },
      withdrawalStats: {
        totalWithdrawnAmount,
        completedWithdrawals,
        totalWithdrawals: withdrawals.length,
        averageWithdrawal: withdrawals.length > 0 ? totalWithdrawnAmount / withdrawals.length : 0,
      },
      depositStats: {
        totalDepositedAmount,
        totalDeposits: deposits.length,
        averageDeposit: deposits.length > 0 ? totalDepositedAmount / deposits.length : 0,
      },
      totalCoinsInCirculation: totalUserBalance + completedCommission,
    };
  }

  async updateAdminWalletBalance(amount: number, reason: string) {
    let wallet = await (this.prisma as any).adminWallet.findFirst();
    if (!wallet) {
      wallet = await (this.prisma as any).adminWallet.create({
        data: { balance: 0, currency: 'PHP', status: 'active' },
      });
    }

    return (this.prisma as any).adminWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });
  }

  async withdrawAdminIncome(adminUserId: string, amountMinor: number, method: string, destination: string) {
    await (this.prisma as any).adminWallet;

    let wallet = await (this.prisma as any).adminWallet.findFirst();
    if (!wallet) {
      wallet = await (this.prisma as any).adminWallet.create({
        data: { balance: 0, currency: 'PHP', status: 'active' },
      });
    }

    if (wallet.balance < amountMinor) {
      throw new Error(`Insufficient balance. Available: ₱${(wallet.balance / 100).toFixed(2)}`);
    }

    if (amountMinor < 10000) {
      // Minimum 100 PHP
      throw new Error('Minimum withdrawal is ₱100.00');
    }

    // Deduct from admin wallet
    const updatedWallet = await (this.prisma as any).adminWallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amountMinor } },
    });

    return {
      success: true,
      message: `Withdrawal of ₱${(amountMinor / 100).toFixed(2)} initiated`,
      withdrawalAmount: amountMinor,
      method,
      destination,
      newBalance: updatedWallet.balance,
      timestamp: new Date(),
    };
  }
}
