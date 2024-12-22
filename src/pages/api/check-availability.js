import prisma from '../../lib/db';

export default async function handler(req, res) {
  const { room, day, startTime, endTime } = req.query;

  try {
    // Query to check room availability based on the given time range
    const result = await prisma.class.findMany({
      where: {
        Room: room,
        Day: day,
        NOT: {
          OR: [
            { EndTime: { lte: startTime } },
            { StartTime: { gte: endTime } }
          ]
        }
      }
    });

    const isAvailable = result.length === 0;
    res.status(200).json({ available: isAvailable });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
