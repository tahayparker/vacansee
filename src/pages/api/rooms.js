import prisma from '../../lib/db';

const getFreeRooms = async (req, res) => {
  try {
    const { day, time } = req.query;
    
    if (!day || !time) {
      return res.status(400).json({ error: 'Day and time parameters are required' });
    }

    console.log('Client day:', day);
    console.log('Client time:', time);
    
    // First, get currently occupied rooms
    const occupiedRooms = await prisma.class.findMany({
      where: {
        Day: day,
        StartTime: { lte: time },
        EndTime: { gte: time },
      },
      select: {
        Room: true,
      },
    }, { cacheStrategy: { swr: 60 } });

    const occupiedRoomsList = occupiedRooms.map(c => c.Room);

    // Then, fetch rooms that are free
    const freeRooms = await prisma.class.findMany({
      where: {
        Room: {
          notIn: occupiedRoomsList,
        },
      },
      select: {
        Room: true,
      },
      distinct: ['Room'], // Ensure distinct Rooms
      orderBy: {
        Room: 'asc', // Sort Rooms in ascending order
      },
    }, { cacheStrategy: { swr: 60 } });

    // Ensure a valid response structure
    res.status(200).json(freeRooms.length ? freeRooms.map(room => room.Room) : []);
  } catch (error) {
    console.error('Error fetching free rooms:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default getFreeRooms;
