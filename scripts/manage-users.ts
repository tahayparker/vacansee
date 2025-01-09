import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // List of authorized users
  const authorizedUsers = [
    {
      email: 'user1@example.com',
      name: 'User One'
    },
    // Add more users as needed
  ];

  console.log('Starting to add authorized users...');

  for (const user of authorizedUsers) {
    try {
      const result = await prisma.authorizedUser.upsert({
        where: { email: user.email },
        update: { name: user.name },
        create: {
          email: user.email,
          name: user.name,
        },
      });
      console.log(`✅ Added/Updated user: ${result.email}`);
    } catch (error) {
      console.error(`❌ Error adding user ${user.email}:`, error);
    }
  }

  console.log('Finished adding authorized users');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 