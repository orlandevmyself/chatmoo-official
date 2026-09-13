const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting demo/test accounts...');

  // Delete demo accounts with "paginate-demo" in email
  const deletedPaginateDemo = await prisma.user.deleteMany({
    where: {
      email: { contains: 'paginate-demo' },
    },
  });

  console.log(`Deleted ${deletedPaginateDemo.count} paginate-demo accounts`);

  // Delete other test accounts (optional - comment out if you want to keep them)
  // const testPatterns = ['ChatMe30', 'Fem', 'fem20', 'Orlando', 'Fe', 'Trish'];
  // for (const pattern of testPatterns) {
  //   const deleted = await prisma.user.deleteMany({
  //     where: { name: pattern },
  //   });
  //   console.log(`Deleted ${deleted.count} accounts with name "${pattern}"`);
  // }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
