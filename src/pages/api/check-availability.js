import prisma from '../../lib/db';

export default async function handler(req, res) {
  const { room, day, startTime, endTime } = req.query;

  console.log('Checking availability for:', { room, day, startTime, endTime });

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
      },
      select: {
        SubCode: true,
        Class: true,
        Teacher: true,
        StartTime: true,
        EndTime: true
      },
      orderBy: {
        StartTime: 'asc'
      },
      cacheStrategy: {
        swr: 60 * 60 // 1 hour
      }
    });

    const isAvailable = result.length === 0;
    
    if (isAvailable) {
      res.status(200).json({ available: true });
    } else {
      // Format the class details
      const classes = result.map(classInfo => {
        // Format the class type to be Title Case
        const formattedType = classInfo.Class.toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        // Format times to ensure HH:mm format
        const formatTime = (time) => {
          const [hours, minutes] = time.split(':');
          return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
        };

        return {
          subject: `${classInfo.SubCode} - ${formattedType}`,
          professor: classInfo.Teacher,
          startTime: formatTime(classInfo.StartTime),
          endTime: formatTime(classInfo.EndTime)
        };
      });

      res.status(200).json({ 
        available: false,
        classes
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
