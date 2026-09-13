import { Controller, Get, Post, Patch, Delete, Query, Body, Param } from '@nestjs/common';
import { MessageRequestService } from './message-request.service';

@Controller('message-requests')
export class MessageRequestController {
  constructor(private service: MessageRequestService) {}

  @Get('search')
  async searchUsers(
    @Query('userId') userId: string,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.searchUsers(userId, query, limit ? Math.min(50, Math.max(1, parseInt(limit))) : 20);
  }

  @Get('incoming')
  async getIncomingRequests(@Query('userId') userId: string) {
    return this.service.getIncomingRequests(userId);
  }

  @Get('outgoing')
  async getOutgoingRequests(@Query('userId') userId: string) {
    return this.service.getOutgoingRequests(userId);
  }

  @Post()
  async sendMessageRequest(
    @Query('userId') senderId: string,
    @Body() body: { recipientId: string; message?: string },
  ) {
    return this.service.sendMessageRequest(senderId, body.recipientId, body.message);
  }

  @Patch(':id/accept')
  async acceptMessageRequest(
    @Param('id') requestId: string,
    @Query('userId') userId: string,
  ) {
    return this.service.acceptMessageRequest(requestId, userId);
  }

  @Patch(':id/reject')
  async rejectMessageRequest(
    @Param('id') requestId: string,
    @Query('userId') userId: string,
  ) {
    return this.service.rejectMessageRequest(requestId, userId);
  }

  @Delete(':id')
  async cancelMessageRequest(
    @Param('id') requestId: string,
    @Query('userId') userId: string,
  ) {
    return this.service.cancelMessageRequest(requestId, userId);
  }
}
