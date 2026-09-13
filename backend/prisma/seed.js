const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // Create default admin account
  const adminEmail = 'admin@chatmoo.com';
  const adminPassword = '@admin123456';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`Admin user ${adminEmail} already exists`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: 'Admin',
      displayName: 'ChatMoo Admin',
      username: 'admin',
      role: 'admin',
      passwordHash,
      avatar: 'adventurer',
      avatarSeed: 'admin-seed',
      profileComplete: true,
      wallet: {
        create: {
          balance: 0,
          currency: 'PHP',
          status: 'active',
        },
      },
      settings: {
        create: {
          messageSound: true,
          browserNotifications: false,
          typingIndicators: true,
          showAvatars: true,
          showTimestamps: true,
          fontSize: 'medium',
          chatTheme: 'default',
          status: 'online',
        },
      },
    },
  });

  console.log(`Created admin user: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
