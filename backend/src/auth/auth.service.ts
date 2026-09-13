import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateGoogleUser(profile: any) {
    console.log('[AuthService] Google profile:', profile);
    
    // Extract email and name from profile
    const email = profile.emails?.[0]?.value || profile.email;
    const name = profile.displayName || (typeof profile.name === 'object' ? 
      `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() : 
      profile.name) || 
      email.split('@')[0];

    if (!email) {
      throw new Error('Email not found in Google profile');
    }

    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    } as any);

    // Create user if doesn't exist
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          displayName: name,
          profileComplete: false,
        },
      } as any);
    } else {
      // Update name if changed
      user = await this.prisma.user.update({
        where: { email },
        data: { name },
      } as any);
    }

    console.log('[AuthService] User validated:', user);
    return user;
  }

  async getUserProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    } as any);
  }

  async updateUserProfile(userId: string, data: { 
    displayName?: string; 
    username?: string;
    country?: string; 
    countryCode?: string; 
    university?: string; 
    gender?: string; 
    avatar?: string; 
    avatarSeed?: string;
    profileComplete?: boolean;
  }) {
    console.log('[AuthService] Updating profile for user:', userId);
    console.log('[AuthService] Profile data:', data);
    
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    } as any);
    
    if (!existingUser) {
      console.error('[AuthService] User not found:', userId);
      throw new Error('User not found');
    }
    
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
    } as any);
    
    console.log('[AuthService] Profile updated successfully:', updatedUser);
    return updatedUser;
  }

  async checkUsernameAvailable(username: string): Promise<boolean> {
    console.log('[AuthService] Checking username availability:', username);
    const user = await this.prisma.user.findFirst({
      where: { username },
    } as any);
    const available = !user;
    console.log('[AuthService] Username available:', available);
    return available;
  }

  private settingsDefaults() {
    return {
      messageSound: true,
      browserNotifications: false,
      typingIndicators: true,
      showAvatars: true,
      showTimestamps: true,
      fontSize: 'medium',
      chatTheme: 'default',
      status: 'online',
      statusMessage: '',
    };
  }

  async getUserSettings(userId: string) {
    console.log('[AuthService] Getting settings for user:', userId);
    const settings = await (this.prisma as any).userSettings.findUnique({
      where: { userId },
    });
    if (!settings) {
      return { userId, ...this.settingsDefaults() };
    }
    const { id, createdAt, updatedAt, ...rest } = settings;
    return rest;
  }

  async updateUserSettings(userId: string, data: any) {
    console.log('[AuthService] Updating settings for user:', userId);

    const allowedBooleans = [
      'messageSound',
      'browserNotifications',
      'typingIndicators',
      'showAvatars',
      'showTimestamps',
    ];
    const clean: any = {};
    for (const key of allowedBooleans) {
      if (typeof data?.[key] === 'boolean') {
        clean[key] = data[key];
      }
    }
    if (['small', 'medium', 'large'].includes(data?.fontSize)) {
      clean.fontSize = data.fontSize;
    }
    if (typeof data?.chatTheme === 'string' && data.chatTheme.length <= 32) {
      clean.chatTheme = data.chatTheme;
    }
    if (['online', 'busy', 'away', 'invisible'].includes(data?.status)) {
      clean.status = data.status;
    }
    if (typeof data?.statusMessage === 'string') {
      clean.statusMessage = data.statusMessage.slice(0, 120);
    }

    const updated = await (this.prisma as any).userSettings.upsert({
      where: { userId },
      create: { userId, ...this.settingsDefaults(), ...clean },
      update: clean,
    });

    const { id, createdAt, updatedAt, ...rest } = updated;
    console.log('[AuthService] Settings updated for user:', userId);
    return rest;
  }
}
