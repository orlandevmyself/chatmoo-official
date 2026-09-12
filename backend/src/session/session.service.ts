import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createSession(data: {
    userId: string;
    username: string;
    country?: string;
    countryCode?: string;
    university?: string;
    genderFilter?: string;
    gender?: string;
    avatar?: string;
    avatarSeed?: string;
  }) {
    const session = await this.prisma.session.create({
      data: {
        userId: data.userId,
        username: data.username,
        country: data.country,
        countryCode: data.countryCode,
        university: data.university,
        genderFilter: data.genderFilter || 'all',
        gender: data.gender,
        avatar: data.avatar || 'adventurer',
        avatarSeed: data.avatarSeed,
        status: 'active',
      },
    });

    // Add to matching queue in Redis
    const redisClient = this.redis.getClient();
    await redisClient.setex(
      `queue:${session.id}`,
      300,
      JSON.stringify({
        sessionId: session.id,
        username: session.username,
        country: session.country,
        countryCode: data.countryCode,
        university: session.university,
        genderFilter: session.genderFilter,
        gender: session.gender,
        avatar: (session as any).avatar || 'adventurer',
        avatarSeed: (session as any).avatarSeed,
        timestamp: Date.now(),
      }),
    );

    return session;
  }

  async getSession(id: string) {
    return this.prisma.session.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async updateSessionStatus(id: string, status: string) {
    const session = await this.prisma.session.update({
      where: { id },
      data: { status },
    });

    // Remove from queue if ended or inactive
    if (status === 'ended' || status === 'inactive') {
      const redisClient = this.redis.getClient();
      await redisClient.del(`queue:${id}`);
      await redisClient.del(`searching:${id}`); // Also remove from searching
    }

    return session;
  }

  async getActiveSessions() {
    return this.prisma.session.findMany({
      where: { status: 'active' },
      include: { user: true },
    });
  }

  async getMatchingSession(excludeSessionId: string, genderFilter?: string) {
    const searchingSessions = await this.getSearchingSessions(genderFilter);

    // Filter out the current session
    const availableSessions = searchingSessions.filter(
      (session) => session.id !== excludeSessionId
    );

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
    return this.prisma.session.delete({
      where: { id },
    });
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
    });

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