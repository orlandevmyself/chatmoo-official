import { Controller, Get, Req, Res, UseGuards, Post, Put, Body, Inject } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { GuestCleanupService } from './guest-cleanup.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    @Inject(GuestCleanupService) private guestCleanup: GuestCleanupService,
  ) {}

  private getFrontendUrl(): string {
    const url = process.env.FRONTEND_URL;
    if (!url) {
      throw new Error('FRONTEND_URL is not set — refusing to redirect to localhost');
    }
    return url;
  }

  private buildAuthCallbackUrl(user: any): string {
    const nameString = typeof user.name === 'object' ?
      `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim() :
      (user.name || user.email?.split('@')[0] || 'User');
    return `${this.getFrontendUrl()}/auth/callback?userId=${user.id}&email=${encodeURIComponent(user.email || '')}&name=${encodeURIComponent(nameString)}&profileComplete=${user.profileComplete}`;
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    console.log('[Auth] Google callback received:', req.user);

    const { user } = req;

    if (!user) {
      return res.redirect(`${this.getFrontendUrl()}?error=auth_failed`);
    }

    // Clean up previous guest account if transitioning from guest to authenticated user
    const prevGuestId = req.query?.prevGuestId || req.headers?.['x-prev-guest-id'];
    if (prevGuestId && prevGuestId !== user.id) {
      try {
        await this.guestCleanup.cleanupGuestOnAuthentication(prevGuestId as string, user.id);
        console.log(`[Auth] Cleaned up previous guest account: ${prevGuestId}`);
      } catch (error) {
        console.error(`[Auth] Error cleaning up guest account: ${(error as Error).message}`);
      }
    }

    // Return user data to frontend
    const redirectUrl = this.buildAuthCallbackUrl(user);
    console.log('[Auth] Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  }

  // Code exchange for the Vercel-hosted frontend. Google redirects the browser
  // to <frontend>/auth/google/callback?code=..., the frontend forwards the code
  // here, and we exchange it server-side (the client secret never leaves the
  // backend) before redirecting the browser back to the frontend.
  @Get('google/code')
  async googleAuthCode(@Req() req, @Res() res: Response) {
    const code = req.query.code as string;
    const redirectUri = (req.query.redirectUri as string) || process.env.GOOGLE_CALLBACK_URL;

    if (!code || !redirectUri) {
      return res.redirect(`${this.getFrontendUrl()}?error=auth_failed`);
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenData: any = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[Auth] Token exchange failed:', tokenData);
      return res.redirect(`${this.getFrontendUrl()}?error=auth_failed`);
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo: any = await profileResponse.json();
    if (!profileResponse.ok || !userInfo.email) {
      console.error('[Auth] Profile fetch failed:', userInfo);
      return res.redirect(`${this.getFrontendUrl()}?error=auth_failed`);
    }

    const profile = {
      emails: [{ value: userInfo.email }],
      displayName: userInfo.name,
      name: { givenName: userInfo.given_name, familyName: userInfo.family_name },
    };
    const user = await this.authService.validateGoogleUser(profile);

    const prevGuestId = req.query?.prevGuestId || req.headers?.['x-prev-guest-id'];
    if (prevGuestId && prevGuestId !== user.id) {
      try {
        await this.guestCleanup.cleanupGuestOnAuthentication(prevGuestId as string, user.id);
      } catch (error) {
        console.error(`[Auth] Error cleaning up previous guest account: ${(error as Error).message}`);
      }
    }

    const redirectUrl = this.buildAuthCallbackUrl(user);
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
