import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createUser(email: string, name?: string, role?: string) {
    // Try to create user, if exists due to unique constraint, get existing user
    try {
      const user = await this.prisma.user.create({
        data: { email, name, ...(role && { role }) },
      });
      
      // Cache the user in Redis
      await this.redis.set(`user:${user.id}`, JSON.stringify(user), 3600);
      
      return user;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // User already exists, get the existing user
        const existingUser = await this.prisma.user.findUnique({
          where: { email },
        });
        if (existingUser) {
          return existingUser;
        }
      }
      throw error;
    }
  }

  async getUserById(id: string) {
    // Try to get from cache first
    const cached = await this.redis.get(`user:${id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // If not in cache, get from database
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (user) {
      // Cache the result
      await this.redis.set(`user:${id}`, JSON.stringify(user), 3600);
    }

    return user;
  }

  async getAllUsers() {
    return this.prisma.user.findMany();
  }

  async updateUser(id: string, email?: string, name?: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { email, name },
    });

    // Update cache
    await this.redis.set(`user:${id}`, JSON.stringify(user), 3600);

    return user;
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.delete({
      where: { id },
    });

    // Remove from cache
    await this.redis.del(`user:${id}`);

    return user;
  }
}