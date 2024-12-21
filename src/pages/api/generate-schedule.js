import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const timeSlots = [
  '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', 
  '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', 
  '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', 
  '20:30', '21:00', '21:30', '22:00', '22:30'
];

// Function to check room availability
async function checkRoomAvailability(room, day, startTime, endTime) {
  try {
    const result = await prisma.class.findMany({
      where: {
        Room: room,
        Day: day,
        NOT: {
          OR: [
            { EndTime: { lte: startTime } },
            { StartTime: { gte: endTime } },
          ],
        },
      },
    });
    return result.length === 0; // If no results, the room is available
  } catch (error) {
    console.error(error);
    return false; // In case of an error, assume not available
  }
}

// Function to generate schedule data
async function generateScheduleData() {
  const fetchRooms = async () => {
    try {
      const rooms = await prisma.class.findMany({
        distinct: ['Room'],
        select: { Room: true },
      });
      return rooms.map((room) => room.Room);
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  const roomNames = await fetchRooms();

  const schedule = [];

  // Loop through each day and room, then check availability for each time slot
  for (let day of daysOfWeek) {
    const dayData = {
      day,
      rooms: []
    };

    for (let room of roomNames) {
      const roomData = {
        room,
        availability: []
      };

      for (let i = 0; i < timeSlots.length; i++) {
        const startTime = timeSlots[i].replace(/:(\d+)$/, (_, m) => ':' + (parseInt(m) + 1).toString().padStart(2, '0'));
        const available = await checkRoomAvailability(room, day, startTime, startTime);
        roomData.availability.push(available ? 1 : 0);  // 1 for available, 0 for unavailable
      }

      dayData.rooms.push(roomData);
    }

    schedule.push(dayData);
  }

  return schedule;
}

// Save generated data to a file
async function saveScheduleData() {
  const scheduleData = await generateScheduleData();
  fs.writeFileSync('./scheduleData.json', JSON.stringify(scheduleData));
  console.log('Schedule data generated and saved.');
}

// Default export function to handle API route
export default async function handler(req, res) {
  try {
    await saveScheduleData();
    res.status(200).json({ message: 'Schedule data generated and saved.' });
  } catch (error) {
    console.error('Error generating schedule data:', error);
    res.status(500).json({ error: 'Error generating schedule data.' });
  } finally {
    await prisma.$disconnect();
  }
}