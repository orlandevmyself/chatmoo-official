import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ReconnectionService } from './reconnection.service';

@Controller('reconnection')
export class ReconnectionController {
  constructor(private reconnectionService: ReconnectionService) {}

  @Post('request/:conversationId')
  async requestReconnection(
    @Param('conversationId') conversationId: string,
    @Query('userId') userId?: string,
    @Query('guestId') guestId?: string,
  ) {
    console.log('[ReconnectionController] Requesting reconnection');
    return this.reconnectionService.requestReconnection(conversationId, userId, guestId);
  }

  @Post('accept/:conversationId')
  async acceptReconnection(
    @Param('conversationId') conversationId: string,
    @Query('userId') userId?: string,
    @Query('guestId') guestId?: string,
  ) {
    console.log('[ReconnectionController] Accepting reconnection');
    return this.reconnectionService.acceptReconnection(conversationId, userId, guestId);
  }

  @Get(':conversationId')
  async getReconnectionInfo(@Param('conversationId') conversationId: string) {
    console.log('[ReconnectionController] Getting reconnection info');
    return this.reconnectionService.getReconnectionInfo(conversationId);
  }
}