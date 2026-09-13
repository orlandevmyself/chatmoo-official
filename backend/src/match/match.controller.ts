import { Controller, Post, Param, Body, Query } from '@nestjs/common';
import { MatchService } from './match.service';

@Controller('match')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Post(':sessionId/find')
  async findMatch(
    @Param('sessionId') sessionId: string,
    @Query('country') country?: string,
    @Query('gender') gender?: string,
  ) {
    return this.matchService.findMatch(sessionId, { country, gender });
  }

  @Post(':sessionId/skip')
  async skipMatch(@Param('sessionId') sessionId: string) {
    return this.matchService.skipMatch(sessionId);
  }

  @Post(':sessionId/end')
  async endMatch(@Param('sessionId') sessionId: string) {
    return this.matchService.endMatch(sessionId);
  }

  @Post(':sessionId/stop-searching')
  async stopSearching(@Param('sessionId') sessionId: string) {
    return this.matchService.stopSearching(sessionId);
  }
}