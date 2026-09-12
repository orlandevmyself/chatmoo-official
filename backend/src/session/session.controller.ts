import { Controller, Post, Body, Get, Param, Put, Delete } from '@nestjs/common';
import { SessionService } from './session.service';

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  async create(@Body() body: {
    userId: string;
    username: string;
    country?: string;
    countryCode?: string;
    university?: string;
    genderFilter?: string;
    gender?: string;
    avatar?: string;
    avatarSeed?: string;
  }) {
    return this.sessionService.createSession(body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.sessionService.getSession(id);
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.sessionService.updateSessionStatus(id, body.status);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.sessionService.deleteSession(id);
  }

  @Post('cleanup')
  async cleanup() {
    return this.sessionService.cleanupInactiveSessions();
  }
}