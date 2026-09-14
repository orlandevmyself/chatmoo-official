export const googleProvider = {
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: ['email', 'profile'],
};

export const GUEST_EMAIL_DOMAIN = 'chatmoo.com';

// Guest users are created with auto-generated <username><timestamp>@chatmoo.com emails
export function isGuestUser(user?: { email?: string | null } | null): boolean {
  return !!user?.email?.endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}
