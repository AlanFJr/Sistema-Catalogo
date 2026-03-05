import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const run = async () => {
  const total = await prisma.card.count();
  const sample = await prisma.card.findMany({
    where: {
      refCode: {
        in: ['26653', '29569', '13387']
      }
    },
    orderBy: { refCode: 'asc' },
    select: {
      refCode: true,
      title: true
    }
  });

  console.log(`cards_total=${total}`);
  console.log(`sample=${JSON.stringify(sample)}`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });