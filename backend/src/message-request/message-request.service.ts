import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessageRequestService {
  constructor(private prisma: PrismaService) {}

  async searchUsers(userId: string, query: string, limit: number = 20) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query is required');
    }
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const searchTerm = query.toLowerCase().trim();

    // Search by username or displayName, exclude self and blocked users
    const users = await (this.prisma as any).user.findMany({
      where: {
        AND: [
          { id: { not: userId } }, // Exclude self
          { banned: false }, // Exclude banned users
          {
            OR: [
              { username: { contains: searchTerm, mode: 'insensitive' } },
              { displayName: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        avatarSeed: true,
        country: true,
        university: true,
      },
      take: limit,
    });

    // For each result, fetch the status of any message request between them
    const usersWithRequest = await Promise.all(
      users.map(async (user: any) => {
        const request = await (this.prisma as any).messageRequest.findFirst({
          where: {
            OR: [
              { senderId: userId, recipientId: user.id },
              { senderId: user.id, recipientId: userId },
            ],
          },
          select: {
            id: true,
            status: true,
            senderId: true,
          },
        });

        return {
          ...user,
          requestStatus: request?.status || null, // 'pending', 'accepted', 'rejected', 'cancelled'
          requestId: request?.id || null,
          isOutgoing: request?.senderId === userId || false, // Is this an outgoing request from current user?
        };
      })
    );

    return usersWithRequest;
  }

  async sendMessageRequest(senderId: string, recipientId: string, message?: string) {
    if (senderId === recipientId) {
      throw new BadRequestException('Cannot send message request to yourself');
    }

    // Check if recipient exists and is not banned
    const recipient = await (this.prisma as any).user.findUnique({
      where: { id: recipientId },
      select: { id: true, banned: true },
    });

    if (!recipient) {
      throw new NotFoundException('User not found');
    }

    if (recipient.banned) {
      throw new BadRequestException('Cannot send message request to a banned user');
    }

    // Check if a request already exists (in either direction)
    const existing = await (this.prisma as any).messageRequest.findFirst({
      where: {
        OR: [
          { senderId, recipientId },
          { senderId: recipientId, recipientId: senderId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'pending') {
        throw new BadRequestException('A pending message request already exists');
      }
      if (existing.status === 'accepted') {
        throw new BadRequestException('You are already connected with this user');
      }
      // If rejected or cancelled, allow creating a new one
    }

    const request = await (this.prisma as any).messageRequest.create({
      data: {
        senderId,
        recipientId,
        message: message?.trim() || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            avatarSeed: true,
          },
        },
      },
    });

    return request;
  }

  async getIncomingRequests(userId: string) {
    const requests = await (this.prisma as any).messageRequest.findMany({
      where: {
        recipientId: userId,
        status: 'pending',
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            avatarSeed: true,
            country: true,
            university: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests;
  }

  async acceptMessageRequest(requestId: string, userId: string) {
    const request = await (this.prisma as any).messageRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Message request not found');
    }

    if (request.recipientId !== userId) {
      throw new BadRequestException('You are not the recipient of this request');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('This request is no longer pending');
    }

    const updated = await (this.prisma as any).messageRequest.update({
      where: { id: requestId },
      data: { status: 'accepted' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            avatarSeed: true,
          },
        },
      },
    });

    return updated;
  }

  async rejectMessageRequest(requestId: string, userId: string) {
    const request = await (this.prisma as any).messageRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Message request not found');
    }

    if (request.recipientId !== userId) {
      throw new BadRequestException('You are not the recipient of this request');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('This request is no longer pending');
    }

    const updated = await (this.prisma as any).messageRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' },
    });

    return updated;
  }

  async cancelMessageRequest(requestId: string, userId: string) {
    const request = await (this.prisma as any).messageRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Message request not found');
    }

    if (request.senderId !== userId) {
      throw new BadRequestException('Only the sender can cancel this request');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    const updated = await (this.prisma as any).messageRequest.update({
      where: { id: requestId },
      data: { status: 'cancelled' },
    });

    return updated;
  }

  async getOutgoingRequests(userId: string) {
    const requests = await (this.prisma as any).messageRequest.findMany({
      where: {
        senderId: userId,
        status: 'pending',
      },
      include: {
        recipient: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            avatarSeed: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests;
  }
}
