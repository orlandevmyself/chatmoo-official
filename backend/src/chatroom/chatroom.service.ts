import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ChatroomService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createChatroom(sessionIds: string[]) {
    const chatroom = await this.prisma.chatroom.create({
      data: {
        status: 'active',
        members: {
          create: sessionIds.map((sessionId) => ({
            sessionId,
          })),
        },
      },
      include: {
        members: {
          include: {
            session: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    // Cache chatroom info
    await this.redis.set(
      `chatroom:${chatroom.id}`,
      JSON.stringify(chatroom),
      3600,
    );

    return chatroom;
  }

  async getChatroom(id: string) {
    const cached = await this.redis.get(`chatroom:${id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const chatroom = await this.prisma.chatroom.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            session: {
              include: {
                user: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (chatroom) {
      await this.redis.set(`chatroom:${id}`, JSON.stringify(chatroom), 3600);
    }

    return chatroom;
  }

  async endChatroom(id: string) {
    const chatroom = await this.prisma.chatroom.update({
      where: { id },
      data: {
        status: 'ended',
        members: {
          updateMany: {
            where: { leftAt: null },
            data: { leftAt: new Date() },
          },
        },
      },
    });

    // Remove from cache
    await this.redis.del(`chatroom:${id}`);

    return chatroom;
  }

  async addMessage(data: {
    chatroomId: string;
    senderId: string;
    content: string;
    imageUrl?: string;
    type?: string;
    replyToId?: string;
  }) {
    console.log('[ChatroomService] Creating message:', data);
    const message = await this.prisma.message.create({
      data: {
        chatroomId: data.chatroomId,
        senderId: data.senderId,
        content: data.content,
        imageUrl: data.imageUrl,
        type: data.type || 'text',
        replyToId: data.replyToId,
      },
      include: {
        replyTo: true,
      },
    } as any);

    console.log('[ChatroomService] Message created successfully:', message);

    // Invalidate chatroom cache
    await this.redis.del(`chatroom:${data.chatroomId}`);

    return message;
  }

  async getChatroomMessages(chatroomId: string) {
    return this.prisma.message.findMany({
      where: { chatroomId },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        replyTo: true,
      },
    } as any);
  }

  async getChatroomBySession(sessionId: string) {
    const member = await this.prisma.chatroomMember.findFirst({
      where: {
        sessionId,
        leftAt: null,
      },
      include: {
        chatroom: {
          include: {
            members: {
              include: {
                session: {
                  include: {
                    user: true,
                  },
                },
              },
            },
            messages: {
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },
      },
    });

    return member?.chatroom || null;
  }
}