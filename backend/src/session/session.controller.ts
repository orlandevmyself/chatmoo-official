import { Controller, Post, Body, Get, Param, Put, Delete } from '@nestjs/common';
import { SessionService } from './session.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('sessions')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private prisma: PrismaService,
  ) {}

  @Post()
  async create(@Body() body: {
    userId?: string;
    username: string;
    genderFilter?: string;
  }) {
    // If userId is provided, get user profile data
    let profileData = {};
    if (body.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: body.userId },
      } as any);
      if (user) {
        profileData = {
          username: user.username || user.displayName || user.name,
          country: user.country,
          countryCode: user.countryCode,
          university: user.university,
          gender: user.gender,
          avatar: user.avatar,
          avatarSeed: user.avatarSeed,
        };
      }
    }

    return this.sessionService.createSession({
      ...body,
      ...profileData,
    });
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