import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlockReportService {
  constructor(private prisma: PrismaService) {}

  // Block a user
  async blockUser(blockerId: string, blockedId: string, reason?: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    // Check if blocked user exists
    const blockedUser = await this.prisma.user.findUnique({
      where: { id: blockedId },
    });

    if (!blockedUser) {
      throw new NotFoundException('User to block not found');
    }

    // Check if already blocked
    const existingBlock = await this.prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });

    if (existingBlock) {
      throw new BadRequestException('User is already blocked');
    }

    return this.prisma.userBlock.create({
      data: {
        blockerId,
        blockedId,
        reason: reason || null,
      },
    });
  }

  // Unblock a user
  async unblockUser(blockerId: string, blockedId: string) {
    const result = await this.prisma.userBlock.deleteMany({
      where: {
        blockerId,
        blockedId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Block not found');
    }

    return { success: true };
  }

  // Get list of blocked users
  async getBlockedUsers(userId: string) {
    return this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
            avatarSeed: true,
            country: true,
            countryCode: true,
            university: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Check if a user is blocked by another
  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const block = await this.prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });

    return !!block;
  }

  // Check if there's a mutual block between two users
  async isMutuallyBlocked(userId1: string, userId2: string): Promise<boolean> {
    const block1 = await this.isUserBlocked(userId1, userId2);
    const block2 = await this.isUserBlocked(userId2, userId1);
    return block1 || block2;
  }

  // Report a user
  async reportUser(reporterId: string, reportedId: string, reason: string, description?: string) {
    if (reporterId === reportedId) {
      throw new BadRequestException('Cannot report yourself');
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Report reason is required');
    }

    // Check if reported user exists
    const reportedUser = await this.prisma.user.findUnique({
      where: { id: reportedId },
    });

    if (!reportedUser) {
      throw new NotFoundException('User to report not found');
    }

    // Check if already reported by this user (prevent duplicate pending reports)
    const existingReport = await this.prisma.userReport.findFirst({
      where: {
        reporterId,
        reportedId,
        status: 'pending',
      },
    });

    if (existingReport) {
      throw new BadRequestException('You have already reported this user');
    }

    return this.prisma.userReport.create({
      data: {
        reporterId,
        reportedId,
        reason,
        description: description || null,
      },
    });
  }

  // Get reports (admin only)
  async getReports(
    adminUserId: string,
    status?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    // Verify admin status
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { role: true },
    });

    if (!admin || admin.role !== 'admin') {
      throw new ForbiddenException('Only admins can view reports');
    }

    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [reports, total] = await Promise.all([
      this.prisma.userReport.findMany({
        where,
        include: {
          reporter: {
            select: {
              id: true,
              displayName: true,
              username: true,
            },
          },
          reported: {
            select: {
              id: true,
              displayName: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userReport.count({ where }),
    ]);

    return {
      reports,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // Update report status (admin only)
  async updateReportStatus(adminUserId: string, reportId: string, status: string) {
    // Verify admin status
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { role: true },
    });

    if (!admin || admin.role !== 'admin') {
      throw new ForbiddenException('Only admins can update reports');
    }

    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const report = await this.prisma.userReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return this.prisma.userReport.update({
      where: { id: reportId },
      data: { status },
      include: {
        reporter: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
        reported: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
    });
  }

  // Get user's own reports they've made
  async getMyReports(userId: string) {
    return this.prisma.userReport.findMany({
      where: { reporterId: userId },
      include: {
        reported: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
            avatarSeed: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get reports about a user (admin only)
  async getReportsAboutUser(adminUserId: string, reportedId: string) {
    // Verify admin status
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { role: true },
    });

    if (!admin || admin.role !== 'admin') {
      throw new ForbiddenException('Only admins can view reports');
    }

    return this.prisma.userReport.findMany({
      where: { reportedId },
      include: {
        reporter: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
