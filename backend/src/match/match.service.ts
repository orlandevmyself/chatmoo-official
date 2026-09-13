import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { ChatroomService } from '../chatroom/chatroom.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chatroom/chat.gateway';
import { isGuestUser } from '../auth/auth.constants';

@Injectable()
export class MatchService {
  constructor(
    private sessionService: SessionService,
    private chatroomService: ChatroomService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  private buildMatchedSessionPayload(session: any) {
    return {
      id: session.id,
      username: session.username,
      // Auth users are shown by displayName (it can change any time);
      // username stays the stable identity. Guests have no displayName.
      displayName: session.user?.displayName || session.username,
      country: session.country,
      countryCode: session.countryCode,
      university: session.university,
      gender: session.gender,
      avatar: session.avatar || 'adventurer',
      avatarSeed: session.avatarSeed,
      userId: session.userId || undefined,
      isAuthenticated: !!session.userId && !isGuestUser(session.user),
    };
  }

  async findMatch(sessionId: string) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Don't match if already matched
    if (session.status === 'matched' || session.status === 'ended') {
      return { matched: false, message: 'Session already matched or ended' };
    }

    // Ensure session is active and searching (reactivate if inactive)
    if (session.status !== 'active') {
      await this.sessionService.updateSessionStatus(sessionId, 'active');
      // Clear chatroomId if session was inactive
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { chatroomId: null },
      });
    }
    await this.sessionService.setSearching(sessionId, true);

    // Try to find a matching session
    const matchedSession = await this.sessionService.getMatchingSession(
      sessionId,
      session.genderFilter,
    );

    if (!matchedSession) {
      return { matched: false, message: 'No match found' };
    }

    // Double-check that the current session is still eligible before matching
    const currentSession = await this.sessionService.getSession(sessionId);
    if (currentSession.status !== 'active' || currentSession.chatroomId) {
      await this.sessionService.setSearching(sessionId, false);
      return { matched: false, message: 'Session no longer eligible for matching' };
    }

    // Double-check that the matched session is still eligible
    const eligibleMatchedSession = await this.sessionService.getSession(matchedSession.id);
    if (eligibleMatchedSession.status !== 'active' || eligibleMatchedSession.chatroomId) {
      await this.sessionService.setSearching(matchedSession.id, false);
      return { matched: false, message: 'Matched session no longer eligible' };
    }

    // Create a chatroom for the matched sessions
    const chatroom = await this.chatroomService.createChatroom([
      sessionId,
      matchedSession.id,
    ]);

    // Update both sessions to matched status and set chatroomId
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'matched', chatroomId: chatroom.id },
    });
    await this.prisma.session.update({
      where: { id: matchedSession.id },
      data: { status: 'matched', chatroomId: chatroom.id },
    });
    
    // Stop searching for both sessions
    await this.sessionService.setSearching(sessionId, false);
    await this.sessionService.setSearching(matchedSession.id, false);

    // Get current session details for both users
    const currentSessionDetails = await this.sessionService.getSession(sessionId);

    // Notify both users via WebSocket
    this.chatGateway.notifyMatch(sessionId, {
      chatroomId: chatroom.id,
      matchedSession: this.buildMatchedSessionPayload(matchedSession),
    });

    this.chatGateway.notifyMatch(matchedSession.id, {
      chatroomId: chatroom.id,
      matchedSession: this.buildMatchedSessionPayload(currentSessionDetails),
    });

    return {
      matched: true,
      chatroomId: chatroom.id,
      matchedSession: this.buildMatchedSessionPayload(matchedSession),
    };
  }

  async skipMatch(sessionId: string) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // End current chatroom if exists
    const activeChatroom = await this.prisma.chatroomMember.findFirst({
      where: {
        sessionId,
        leftAt: null,
      },
      include: {
        chatroom: true,
      },
    });

    if (activeChatroom && activeChatroom.chatroom.status === 'active') {
      // Notify partner via WebSocket before ending chatroom
      const otherMembers = await this.prisma.chatroomMember.findMany({
        where: {
          chatroomId: activeChatroom.chatroomId,
          sessionId: { not: sessionId },
        },
      });

      for (const member of otherMembers) {
        this.chatGateway.notifyPartnerSkipped(member.sessionId, sessionId);
      }

      // Remove this user from the chatroom but keep the chatroom active for the partner
      await this.prisma.chatroomMember.update({
        where: { id: activeChatroom.id },
        data: { leftAt: new Date() },
      });

      // Keep the other user in the chatroom, just notify them partner left
      // Don't update their session status or chatroomId
    }

    // Set this user's session to inactive and clear chatroomId
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'inactive', chatroomId: null },
    });
    await this.sessionService.setSearching(sessionId, false);

    return { message: 'Match skipped, session inactive' };
  }

  async endMatch(sessionId: string) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // End current chatroom if exists
    const activeChatroom = await this.prisma.chatroomMember.findFirst({
      where: {
        sessionId,
        leftAt: null,
      },
      include: {
        chatroom: true,
      },
    });

    if (activeChatroom && activeChatroom.chatroom.status === 'active') {
      // Notify partner via WebSocket before ending chatroom
      const otherMembers = await this.prisma.chatroomMember.findMany({
        where: {
          chatroomId: activeChatroom.chatroomId,
          sessionId: { not: sessionId },
        },
      });

      for (const member of otherMembers) {
        this.chatGateway.notifyPartnerEnded(member.sessionId, sessionId);
      }

      // Remove this user from the chatroom but keep the chatroom active for the partner
      await this.prisma.chatroomMember.update({
        where: { id: activeChatroom.id },
        data: { leftAt: new Date() },
      });

      // Keep the other user in the chatroom, just notify them partner left
      // Don't update their session status or chatroomId
    }

    // Set this user's session to inactive and clear chatroomId
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'inactive', chatroomId: null },
    });
    await this.sessionService.setSearching(sessionId, false);

    return { message: 'Match ended, session inactive' };
  }

  async stopSearching(sessionId: string) {
    await this.sessionService.setSearching(sessionId, false);
    return { message: 'Stopped searching' };
  }
}