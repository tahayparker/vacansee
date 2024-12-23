import prisma from '../../lib/db';

const getFreeRooms = async (req, res) => {
  try {
    const currentDay = new Date().toLocaleString('en-US', { weekday: 'long' });
    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false });

    const freeRooms = await prisma.class.findMany({
      where: {
        NOT: {
          AND: [
            { Day: currentDay },
            { StartTime: { lte: currentTime } },
            { EndTime: { gte: currentTime } }
          ]
        }
      },
      select: {
        Room: true
      },
      distinct: ['Room'],
      orderBy: {
        Room: 'asc'
      },
      cacheStrategy: {
        swr: 60 * 60 // 1 hour
      }
    });

    res.status(200).json(freeRooms.map(room => room.Room));
  } catch {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default getFreeRooms;