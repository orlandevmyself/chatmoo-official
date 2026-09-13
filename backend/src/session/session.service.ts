import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GuestCleanupService } from '../auth/guest-cleanup.service';
import { PremiumService } from '../premium/premium.service';

@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private moduleRef: ModuleRef,
    private premiumService: PremiumService,
  ) {}

  async createSession(data: {
    userId?: string;
    username: string;
    country?: string;
    countryCode?: string;
    university?: string;
    genderFilter?: string;
    gender?: string;
    avatar?: string;
    avatarSeed?: string;
  }) {
    let userId = data.userId;

    // If no userId provided, create a guest account
    if (!userId) {
      const guestEmail = `${Math.random().toString(36).substring(2, 15)}@chatmoo.com`;
      const guestUser = await (this.prisma as any).user.create({
        data: {
          email: guestEmail,
          name: data.username,
          username: data.username,
          role: 'guest',
          country: data.country,
          countryCode: data.countryCode,
          university: data.university,
          gender: data.gender,
          avatar: data.avatar || 'adventurer',
          avatarSeed: data.avatarSeed,
        },
      });
      userId = guestUser.id;
    }

    // Check if user has active premium subscription
    const isPremium = await this.premiumService.isPremium(userId);

    const session = await this.prisma.session.create({
      data: {
        userId,
        username: data.username,
        country: data.country,
        countryCode: data.countryCode,
        university: data.university,
        genderFilter: data.genderFilter || 'all',
        gender: data.gender,
        avatar: data.avatar || 'adventurer',
        avatarSeed: data.avatarSeed,
        isPremium,
        status: 'active',
      },
    });

    // Add to matching queue in Redis (premium users get priority)
    const redisClient = this.redis.getClient();
    const queueData = {
      sessionId: session.id,
      username: session.username,
      country: session.country,
      countryCode: session.countryCode,
      university: session.university,
      genderFilter: session.genderFilter,
      gender: session.gender,
      avatar: session.avatar || 'adventurer',
      avatarSeed: session.avatarSeed,
      isPremium,
      timestamp: Date.now(),
    };

    // Premium users get longer queue TTL (higher priority)
    const queueTTL = isPremium ? 600 : 300;
    await redisClient.setex(
      `queue:${session.id}`,
      queueTTL,
      JSON.stringify(queueData),
    );

    return session;
  }

  async getSession(id: string) {
    return this.prisma.session.findUnique({
      where: { id },
      include: { user: true },
    } as any);
  }

  async updateSessionStatus(id: string, status: string) {
    try {
      const session = await this.prisma.session.update({
        where: { id },
        data: { status },
      });

      // Remove from queue if ended or inactive
      if (status === 'ended' || status === 'inactive') {
        const redisClient = this.redis.getClient();
        await redisClient.del(`queue:${id}`);
        await redisClient.del(`searching:${id}`); // Also remove from searching

        // Cleanup guest data if session belongs to a guest
        if (session.userId) {
          try {
            const guestCleanup = this.moduleRef.get(GuestCleanupService, { strict: false });
            if (guestCleanup) {
              await guestCleanup.cleanupSessionlessGuestData(id);
            }
          } catch (error) {
            console.error(`[SessionService] Error cleaning up guest data: ${(error as Error).message}`);
          }
        }
      }

      return session;
    } catch (error: any) {
      // Handle case where session doesn't exist
      if (error.code === 'P2025') {
        console.log(`[SessionService] Session ${id} not found, skipping status update`);
        // Clean up Redis entries even if session doesn't exist
        const redisClient = this.redis.getClient();
        await redisClient.del(`queue:${id}`);
        await redisClient.del(`searching:${id}`);
        return null;
      }
      throw error;
    }
  }

  async getActiveSessions() {
    return this.prisma.session.findMany({
      where: { status: 'active' },
      include: { user: true },
    } as any);
  }

  async getMatchingSession(excludeSessionId: string, genderFilter?: string, countryFilter?: string) {
    const searchingSessions = await this.getSearchingSessions(genderFilter);

    // Filter out the current session
    let availableSessions = searchingSessions.filter(
      (session) => session.id !== excludeSessionId
    );

    // Apply country filter if provided
    if (countryFilter) {
      availableSessions = availableSessions.filter(
        (session) => session.country === countryFilter
      );
    }

    // Try to find the best match based on university
    const targetSession = await this.getSession(excludeSessionId);
    const targetUniversity = targetSession?.university;

    if (targetUniversity) {
      const universityMatch = availableSessions.find(
        (session) => session.university === targetUniversity,
      );
      if (universityMatch) return universityMatch;
    }

    // Return first available session if no university match
    return availableSessions[0] || null;
  }

  async deleteSession(id: string) {
    const redisClient = this.redis.getClient();
    await redisClient.del(`queue:${id}`);
    await redisClient.del(`searching:${id}`);
    
    try {
      return this.prisma.session.delete({
        where: { id },
      });
    } catch (error: any) {
      // Handle case where session doesn't exist
      if (error.code === 'P2025') {
        console.log(`[SessionService] Session ${id} not found, skipping deletion`);
        return null;
      }
      throw error;
    }
  }

  async setSearching(id: string, searching: boolean) {
    // Use Redis to track searching state
    const redisClient = this.redis.getClient();
    if (searching) {
      await redisClient.setex(
        `searching:${id}`,
        300, // 5 minutes TTL
        'true',
      );
    } else {
      await redisClient.del(`searching:${id}`);
    }
    return;
  }

  async getSearchingSessions(genderFilter?: string) {
    // Get all searching sessions from Redis keys
    const redisClient = this.redis.getClient();
    const keys = await redisClient.keys('searching:*');
    const searchingSessionIds = keys.map(key => key.replace('searching:', ''));
    
    if (searchingSessionIds.length === 0) {
      return [];
    }

    // Get sessions that are in Redis as searching
    const sessions = await this.prisma.session.findMany({
      where: {
        id: { in: searchingSessionIds },
        status: 'active',
        chatroomId: null, // Only users not in a chatroom
        ...(genderFilter && genderFilter !== 'all' && {
          gender: genderFilter,
        }),
      },
      include: { user: true },
    } as any);

    // Clean up stale searching flags for sessions that are no longer active or already matched
    const validSessionIds = sessions.map(s => s.id);
    const staleSessionIds = searchingSessionIds.filter(id => !validSessionIds.includes(id));
    
    for (const staleId of staleSessionIds) {
      await redisClient.del(`searching:${staleId}`);
      console.log(`[SessionService] Cleaned up stale searching flag for session ${staleId}`);
    }

    return sessions;
  }

  async cleanupInactiveSessions() {
    // Find sessions that are inactive for more than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const inactiveSessions = await this.prisma.session.findMany({
      where: {
        status: 'inactive',
        updatedAt: {
          lt: oneHourAgo,
        },
      },
    });

    for (const session of inactiveSessions) {
      await this.deleteSession(session.id);
      console.log(`[SessionService] Cleaned up inactive session ${session.id}`);
    }

    return { cleaned: inactiveSessions.length };
  }
}