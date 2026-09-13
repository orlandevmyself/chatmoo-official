const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@chatmoo.com';
  const adminPassword = '@admin123456';

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.update({
    where: { email: adminEmail },
    data: { passwordHash },
    select: { email: true, passwordHash: true },
  });

  console.log(`Updated admin user: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
