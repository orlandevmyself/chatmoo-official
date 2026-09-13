import { Controller, Get, Req, Res, UseGuards, Post, Put, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    // Handle Google OAuth callback
    console.log('[Auth] Google callback received:', req.user);
    
    const { user } = req;
    
    if (!user) {
      return res.redirect('http://localhost:3001?error=auth_failed');
    }
    
    // Return user data to frontend
    const nameString = typeof user.name === 'object' ? 
      `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim() : 
      (user.name || user.email?.split('@')[0] || 'User');
    
    const redirectUrl = `http://localhost:3001/auth/callback?userId=${user.id}&email=${encodeURIComponent(user.email || '')}&name=${encodeURIComponent(nameString)}&profileComplete=${user.profileComplete}`;
    console.log('[Auth] Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  }

  @Get('user/:userId')
  async getUser(@Req() req) {
    const userId = req.params.userId;
    return this.authService.getUserProfile(userId);
  }

  @Post('user/:userId/profile')
  async updateUserProfile(@Req() req, @Body() profileData: any) {
    const userId = req.params.userId;
    console.log('[AuthController] Profile update request for user:', userId);
    console.log('[AuthController] Profile data:', profileData);
    try {
      return this.authService.updateUserProfile(userId, profileData);
    } catch (error) {
      console.error('[AuthController] Profile update error:', error);
      throw error;
    }
  }

  @Get('check-username/:username')
  async checkUsername(@Req() req) {
    const username = req.params.username;
    console.log('[AuthController] Checking username availability:', username);
    const available = await this.authService.checkUsernameAvailable(username);
    console.log('[AuthController] Username available result:', available);
    return { available };
  }

  @Get('user/:userId/settings')
  async getUserSettings(@Req() req) {
    const userId = req.params.userId;
    console.log('[AuthController] Getting settings for user:', userId);
    return this.authService.getUserSettings(userId);
  }

  @Put('user/:userId/settings')
  async updateUserSettings(@Req() req, @Body() settingsData: any) {
    const userId = req.params.userId;
    console.log('[AuthController] Updating settings for user:', userId);
    return this.authService.updateUserSettings(userId, settingsData || {});
  }
}
