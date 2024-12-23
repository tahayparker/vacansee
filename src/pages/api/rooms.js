import prisma from '../../lib/db';

const getFreeRooms = async (req, res) => {
  try {
    // Get current day and time
    const currentDay = new Date().toLocaleString('en-US', { weekday: 'long' });
    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false }); // HH:mm:ss format

    // Fetch rooms that are free
    const freeRooms = await prisma.class.findMany({
      where: {
        Room: {
          notIn: await prisma.class.findMany({
              where: {
                Day: currentDay,
                StartTime: { lte: currentTime },
                EndTime: { gte: currentTime },
              },
              select: {
                Room: true,
              },
            })
            .then(classes => classes.map(c => c.Room)), // Extract Room values
        },
      },
      select: {
        Room: true,
      },
      distinct: ['Room'], // Ensure distinct Rooms
      orderBy: {
        Room: 'asc', // Sort Rooms in ascending order
      },
    });

    // Ensure a valid response structure
    res.status(200).json(freeRooms.length ? freeRooms.map(room => room.Room) : []);
  } catch (error) {
    console.error('Error fetching free rooms:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default getFreeRooms;
