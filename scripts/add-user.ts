import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addUser(email: string, name: string) {
  try {
    const user = await prisma.authorizedUser.create({
      data: {
        email,
        name,
      },
    });
    console.log('✅ Successfully added user:', user);
  } catch (error) {
    console.error('❌ Error adding user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email and name from command line arguments
const email = process.argv[2];
const name = process.argv[3];

if (!email) {
  console.error('Please provide an email address');
  process.exit(1);
}

addUser(email, name || ''); 