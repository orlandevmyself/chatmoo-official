import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GiftService } from '../gifts/gift.service';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private giftService: GiftService,
    private config: AppConfigService,
  ) {}

  // Every admin route passes the acting admin's userId in the query so the
  // demo security model (userId-identified requests) still gates admin powers.
  async assertAdmin(adminUserId: string) {
    if (!adminUserId) {
      throw new BadRequestException('adminUserId is required');
    }
    const admin = await (this.prisma as any).user.findUnique({
      where: { id: adminUserId },
      select: { id: true, role: true, banned: true },
    });
    if (!admin || admin.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    if (admin.banned) {
      throw new ForbiddenException('This admin account is suspended');
    }
    return admin;
  }

  private daysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async getOverview(adminUserId: string) {
    await this.assertAdmin(adminUserId);
    const now = new Date();
    const last7d = this.daysAgo(7);
    const last30d = this.daysAgo(30);
    const todayStart = this.startOfToday();

    const sessionRows = await (this.prisma as any).session.findMany({
      select: { status: true },
    });
    const statusCounts: Record<string, number> = {};
    for (const s of sessionRows) statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;

    const usersTotal = await (this.prisma as any).user.count();
    const [users7d, users30d, usersToday, bannedUsers, admins] = await Promise.all([
      (this.prisma as any).user.count({ where: { createdAt: { gte: last7d } } }),
      (this.prisma as any).user.count({ where: { createdAt: { gte: last30d } } }),
      (this.prisma as any).user.count({ where: { createdAt: { gte: todayStart } } }),
      (this.prisma as any).user.count({ where: { banned: true } }),
      (this.prisma as any).user.count({ where: { role: 'admin' } }),
    ]);

    const chatroomRows = await (this.prisma as any).chatroom.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        members: { select: { id: true } },
      },
    });
    let activeChatrooms = 0;
    let chatroomsToday = 0;
    const uniqueChatroomIds = new Set<string>();

    for (const c of chatroomRows) {
      uniqueChatroomIds.add(c.id);
      if (c.status === 'active' && (c as any).members?.length > 0) activeChatrooms++;
      if (c.createdAt >= todayStart && (c as any).members?.length > 0) chatroomsToday++;
    }

    const messagesTotal = await (this.prisma as any).message.count();
    const messagesToday = await (this.prisma as any).message.count({
      where: { createdAt: { gte: todayStart } },
    });

    const walletAgg = await (this.prisma as any).wallet.aggregate({
      _sum: { balance: true },
    });
    const depAgg = await (this.prisma as any).walletTransaction.aggregate({
      where: { type: 'deposit', status: 'completed' },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const wdAgg = await (this.prisma as any).walletTransaction.aggregate({
      where: { type: 'withdraw', status: 'completed' },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const pendingTx = await (this.prisma as any).walletTransaction.count({
      where: { status: 'pending' },
    });
    const txsToday = await (this.prisma as any).walletTransaction.count({
      where: { createdAt: { gte: todayStart } },
    });

    const savedCount = await (this.prisma as any).savedConversation.count();
    const saveOffers = await (this.prisma as any).saveOffer.findMany({
      select: { status: true },
    });
    let acceptedOffers = 0;
    for (const o of saveOffers) if (o.status === 'accepted') acceptedOffers++;

    const gifts = await this.giftService.listForAdmin();
    const config = await this.config.getEffectiveConfig();

    const recentSignups = await (this.prisma as any).user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, name: true, email: true, username: true,
        country: true, avatar: true, profileComplete: true,
        role: true, banned: true, createdAt: true,
      },
    });

    return {
      generatedAt: now,
      users: {
        total: usersTotal,
        newLast7d: users7d,
        newLast30d: users30d,
        newToday: usersToday,
        banned: bannedUsers,
        admins,
        recent: recentSignups,
      },
      sessions: { total: sessionRows.length, ...statusCounts },
      chatrooms: {
        total: uniqueChatroomIds.size,
        active: activeChatrooms,
        createdToday: chatroomsToday,
      },
      messages: { total: messagesTotal, today: messagesToday },
      wallet: {
        totalBalance: walletAgg._sum?.balance ?? 0,
        totalDeposited: depAgg._sum?.amount ?? 0,
        totalWithdrawn: wdAgg._sum?.amount ?? 0,
        completedDeposits: depAgg._count?._all ?? 0,
        completedWithdrawals: wdAgg._count?._all ?? 0,
        pendingTransactions: pendingTx,
        transactionsToday: txsToday,
      },
      conversations: {
        total: savedCount,
        saveOffersTotal: saveOffers.length,
        saveOffersAccepted: acceptedOffers,
        saveOfferAcceptanceRate:
          saveOffers.length > 0 ? Math.round((acceptedOffers / saveOffers.length) * 100) : 0,
      },
      gifts: { enabled: gifts.filter((g) => g.enabled).length, total: gifts.length },
      config,
    };
  }

  async listUsers(adminUserId: string, query: {
    search?: string;
    role?: string;
    banned?: string;
    page?: number;
    limit?: number;
  }) {
    await this.assertAdmin(adminUserId);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where: any = {};
    if (query.role === 'user' || query.role === 'admin') where.role = query.role;
    if (query.banned === 'true' || query.banned === 'false') where.banned = query.banned === 'true';
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { username: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      (this.prisma as any).user.count({ where }),
      (this.prisma as any).user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, username: true, email: true, displayName: true,
          country: true, university: true, gender: true, avatar: true,
          profileComplete: true, role: true, banned: true, createdAt: true, updatedAt: true,
        },
      }),
    ]);

    const userIds = rows.map((u: any) => u.id);
    const [wallets, sessions] = await Promise.all([
      (this.prisma as any).wallet.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, balance: true, status: true },
      }),
      (this.prisma as any).session.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, status: true },
      }),
    ]);
    const walletMap = new Map<string, any>(wallets.map((w: any) => [w.userId, w]));
    const sessionsByUser = new Map<string, Record<string, number>>();
    for (const s of sessions) {
      const cur = sessionsByUser.get(s.userId) || {};
      cur[s.status] = (cur[s.status] || 0) + 1;
      sessionsByUser.set(s.userId, cur);
    }

    return {
      total,
      page,
      limit,
      items: rows.map((u: any) => ({
        ...u,
        walletBalance: walletMap.get(u.id)?.balance ?? 0,
        walletStatus: walletMap.get(u.id)?.status ?? 'none',
        sessions: sessionsByUser.get(u.id) || {},
      })),
    };
  }

  async setUserRole(adminUserId: string, targetUserId: string, role: string) {
    await this.assertAdmin(adminUserId);
    if (role !== 'user' && role !== 'admin' && role !== 'guest') {
      throw new BadRequestException('Role must be admin, user, or guest');
    }
    if (targetUserId === adminUserId) {
      throw new BadRequestException('You cannot change your own role');
    }
    const target = await (this.prisma as any).user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new BadRequestException('User not found');
    return (this.prisma as any).user.update({
      where: { id: targetUserId },
      data: { role },
      select: { id: true, email: true, role: true, banned: true },
    });
  }

  async setUserBan(adminUserId: string, targetUserId: string, banned: boolean) {
    await this.assertAdmin(adminUserId);
    if (targetUserId === adminUserId) {
      throw new BadRequestException('You cannot ban your own account');
    }
    const target = await (this.prisma as any).user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new BadRequestException('User not found');
    return (this.prisma as any).user.update({
      where: { id: targetUserId },
      data: { banned: !!banned },
      select: { id: true, email: true, role: true, banned: true },
    });
  }

  async cleanupStaleData(adminUserId: string) {
    await this.assertAdmin(adminUserId);

    // Clean up demo/test accounts
    const deletedDemoUsers = await (this.prisma as any).user.deleteMany({
      where: {
        OR: [
          { email: { contains: 'paginate-demo' } },
          { name: 'Paginate Demo' },
        ],
      },
    });

    // Clean up inactive sessions (older than 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deletedSessions = await (this.prisma as any).session.deleteMany({
      where: {
        status: 'inactive',
        updatedAt: { lt: twentyFourHoursAgo },
      },
    });

    // Clean up ended chatrooms without messages (dump chatrooms)
    const allChatrooms = await (this.prisma as any).chatroom.findMany({
      where: { status: 'ended' },
      include: { messages: { select: { id: true } } },
    });

    let deletedChatrooms = 0;
    for (const room of allChatrooms) {
      // Only delete ended chatrooms with no messages (dump data)
      if (room.messages.length === 0) {
        await (this.prisma as any).chatroom.delete({
          where: { id: room.id },
        });
        deletedChatrooms++;
      }
    }

    // Clean up orphaned sessions
    const orphanedSessions = await (this.prisma as any).session.deleteMany({
      where: {
        user: null,
      },
    });

    return {
      message: 'Cleanup completed successfully',
      deletedDemoUsers: deletedDemoUsers.count,
      deletedChatrooms,
      deletedSessions: deletedSessions.count,
      deletedOrphanedSessions: orphanedSessions.count,
      timestamp: new Date(),
    };
  }

  async resetAllData(adminUserId: string) {
    await this.assertAdmin(adminUserId);

    // Delete all conversations and saved messages
    const deletedConversations = await (this.prisma as any).savedConversation.deleteMany({});

    // Delete all chatrooms and messages
    const deletedChatrooms = await (this.prisma as any).chatroom.deleteMany({});

    // Delete all sessions
    const deletedSessions = await (this.prisma as any).session.deleteMany({});

    // Delete all users except admins
    const deletedUsers = await (this.prisma as any).user.deleteMany({
      where: { role: { not: 'admin' } },
    });

    return {
      message: 'All data has been reset. Admin account remains.',
      deletedUsers: deletedUsers.count,
      deletedConversations: deletedConversations.count,
      deletedSessions: deletedSessions.count,
      timestamp: new Date(),
    };
  }

  async reseedData(adminUserId: string) {
    await this.assertAdmin(adminUserId);

    // First reset all data except admin
    await this.resetAllData(adminUserId);

    // Create demo users
    const demoUsers = [
      { email: 'demo1@chatmoo.com', name: 'Demo User 1', username: 'demo1', role: 'user' },
      { email: 'demo2@chatmoo.com', name: 'Demo User 2', username: 'demo2', role: 'user' },
      { email: 'guest-demo@chatmoo.com', name: 'Guest Demo', username: 'guest-demo', role: 'guest' },
    ];

    let createdCount = 0;
    for (const user of demoUsers) {
      try {
        await (this.prisma as any).user.create({
          data: {
            email: user.email,
            name: user.name,
            username: user.username,
            displayName: user.name,
            role: user.role,
            profileComplete: user.role === 'user',
            avatar: 'adventurer',
            avatarSeed: user.username,
            wallet: { create: { balance: 0, currency: 'PHP', status: 'active' } },
            settings: { create: {} },
          },
        });
        createdCount++;
      } catch (err) {
        console.log(`Failed to create demo user ${user.email}`);
      }
    }

    return {
      message: `Data has been reset and reseeded with ${createdCount} demo accounts.`,
      demoUsersCreated: createdCount,
      timestamp: new Date(),
    };
  }

  async listTransactions(adminUserId: string, query: {
    type?: string;
    status?: string;
    method?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    await this.assertAdmin(adminUserId);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const where: any = {};
    if (query.type && query.type !== 'all') {
      if (query.type === 'gift') where.type = { in: ['gift_send', 'gift_receive'] };
      else if (query.type === 'media') where.type = { in: ['media_send', 'media_receive'] };
      else where.type = query.type;
    }
    if (query.status && query.status !== 'all') where.status = query.status;
    if (query.method && query.method !== 'all') where.method = query.method;
    if (query.search) {
      where.OR = [
        { userId: { contains: query.search, mode: 'insensitive' } },
        { remarks: { contains: query.search, mode: 'insensitive' } },
      ];
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

    const userIds = [...new Set(rows.map((r: any) => r.userId))];
    const users = await (this.prisma as any).user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true, username: true },
    });
    const userMap = new Map<string, any>(users.map((u: any) => [u.id, u]));

    return {
      total,
      page,
      limit,
      items: rows.map((r: any) => {
        const u = userMap.get(r.userId);
        return {
          id: r.id,
          userId: r.userId,
          userEmail: u?.email || null,
          userName: u?.name || null,
          type: r.type,
          amount: r.amount,
          fee: r.fee,
          status: r.status,
          provider: r.provider,
          method: r.method,
          destination: r.destination,
          remarks: r.remarks,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      }),
    };
  }
}