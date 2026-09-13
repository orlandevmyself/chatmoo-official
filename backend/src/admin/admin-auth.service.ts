import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminAuthService {
  constructor(private prisma: PrismaService) {}

  async loginWithPassword(email: string, password: string) {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await (this.prisma as any).user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        role: true,
        passwordHash: true,
        banned: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.role !== 'admin') {
      throw new UnauthorizedException('This account does not have admin privileges');
    }

    if (user.banned) {
      throw new UnauthorizedException('This admin account is suspended');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('This account is not configured for password login');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      role: user.role,
    };
  }
}
