import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ChatroomService } from './chatroom.service';

@Controller('chatrooms')
export class ChatroomController {
  constructor(private readonly chatroomService: ChatroomService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.chatroomService.getChatroom(id);
  }

  @Get(':id/messages')
  async getMessages(@Param('id') id: string) {
    return this.chatroomService.getChatroomMessages(id);
  }

  @Post(':id/messages')
  async createMessage(
    @Param('id') id: string,
    @Body() body: { senderId: string; content: string; type?: string },
  ) {
    return this.chatroomService.addMessage({
      chatroomId: id,
      senderId: body.senderId,
      content: body.content,
      type: body.type,
    });
  }

  @Post(':id/end')
  async endChatroom(@Param('id') id: string) {
    return this.chatroomService.endChatroom(id);
  }
}