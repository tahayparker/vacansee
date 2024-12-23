import prisma from '../../lib/db';

export default async function handler(req, res) {
  try {
    const rooms = await prisma.class.findMany({
      select: {
        Room: true
      },
      distinct: ['Room'],
      orderBy: {
        Room: 'asc'
      },
      cacheStrategy: {
        swr: 60 * 60 * 24 // 24 hours
      }
    });

    const roomNames = rooms.map((room) => room.Room);
    res.status(200).json(roomNames);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}