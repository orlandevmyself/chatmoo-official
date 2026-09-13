import { Controller, Get, Post, Delete, Put, Body, Param, Req } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Post()
  async saveConversation(@Req() req, @Body() conversationData: any) {
    const userId = req.body.userId || req.user?.id;
    console.log('[ConversationsController] Saving conversation for user:', userId);
    console.log('[ConversationsController] Conversation data:', conversationData);
    return this.conversationsService.saveConversation(userId, conversationData);
  }

  @Get('user/:userId')
  async getUserConversations(@Param('userId') userId: string) {
    console.log('[ConversationsController] Getting conversations for user:', userId);
    return this.conversationsService.getUserConversations(userId);
  }

  @Get(':conversationId')
  async getConversation(@Param('conversationId') conversationId: string, @Req() req) {
    const userId = req.query.userId || req.user?.id;
    const guestId = req.query.guestId;
    console.log('[ConversationsController] Getting conversation:', conversationId);
    return this.conversationsService.getConversationById(conversationId, userId, guestId);
  }

  @Delete(':conversationId')
  async deleteConversation(@Param('conversationId') conversationId: string, @Req() req) {
    const userId = req.query.userId || req.user?.id;
    console.log('[ConversationsController] Deleting conversation:', conversationId);
    return this.conversationsService.deleteConversation(conversationId, userId);
  }

  @Put(':conversationId/title')
  async updateTitle(@Param('conversationId') conversationId: string, @Body() body: { title: string }, @Req() req) {
    const userId = req.query.userId || req.user?.id;
    console.log('[ConversationsController] Updating conversation title:', conversationId);
    return this.conversationsService.updateConversationTitle(conversationId, userId, body.title);
  }
}