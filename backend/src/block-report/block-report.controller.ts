import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Query,
  Param,
} from '@nestjs/common';
import { BlockReportService } from './block-report.service';

@Controller('block-report')
export class BlockReportController {
  constructor(private blockReportService: BlockReportService) {}

  // Block a user
  @Post('block')
  async blockUser(
    @Query('userId') userId: string,
    @Body() body: { blockedId: string; reason?: string },
  ) {
    return this.blockReportService.blockUser(userId, body.blockedId, body.reason);
  }

  // Unblock a user
  @Delete('block/:blockedId')
  async unblockUser(
    @Query('userId') userId: string,
    @Param('blockedId') blockedId: string,
  ) {
    return this.blockReportService.unblockUser(userId, blockedId);
  }

  // Get my blocked users
  @Get('blocked-users')
  async getBlockedUsers(@Query('userId') userId: string) {
    return this.blockReportService.getBlockedUsers(userId);
  }

  // Check if a user is blocked
  @Get('is-blocked')
  async isUserBlocked(
    @Query('blockerId') blockerId: string,
    @Query('blockedId') blockedId: string,
  ) {
    const isBlocked = await this.blockReportService.isUserBlocked(blockerId, blockedId);
    return { isBlocked };
  }

  // Report a user
  @Post('report')
  async reportUser(
    @Query('userId') userId: string,
    @Body() body: { reportedId: string; reason: string; description?: string },
  ) {
    return this.blockReportService.reportUser(
      userId,
      body.reportedId,
      body.reason,
      body.description,
    );
  }

  // Get my reports
  @Get('my-reports')
  async getMyReports(@Query('userId') userId: string) {
    return this.blockReportService.getMyReports(userId);
  }

  // Admin: Get all reports
  @Get('admin/reports')
  async getReports(
    @Query('userId') adminUserId: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.blockReportService.getReports(
      adminUserId,
      status,
      page || 1,
      limit || 20,
    );
  }

  // Admin: Get reports about a specific user
  @Get('admin/reports/:reportedId')
  async getReportsAboutUser(
    @Query('userId') adminUserId: string,
    @Param('reportedId') reportedId: string,
  ) {
    return this.blockReportService.getReportsAboutUser(adminUserId, reportedId);
  }

  // Admin: Update report status
  @Patch('admin/reports/:reportId')
  async updateReportStatus(
    @Query('userId') adminUserId: string,
    @Param('reportId') reportId: string,
    @Body() body: { status: string },
  ) {
    return this.blockReportService.updateReportStatus(adminUserId, reportId, body.status);
  }
}
