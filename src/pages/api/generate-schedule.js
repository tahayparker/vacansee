import { PrismaClient } from '@prisma/client';
import fs from 'fs';

// Initialize Prisma client
const prisma = new PrismaClient();

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const timeSlots = [
  '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', 
  '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', 
  '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', 
  '20:30', '21:00', '21:30', '22:00', '22:30'
];

export const config = {
  maxDuration: 60,
};

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
            { StartTime: { gte: endTime } }
          ]
        }
      }
    });
    return result.length === 0;
  } catch (error) {
    console.error('Error checking room availability:', error);
    return false;
  }
}

// Function to generate schedule data
async function generateScheduleData() {
  const fetchRooms = async () => {
    try {
      const rooms = await prisma.class.findMany({
        select: {
          Room: true
        },
        distinct: ['Room']
      });
      return rooms.map((room) => room.Room);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }
  }

  const roomNames = await fetchRooms();
  const schedule = [];

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
        roomData.availability.push(available ? 1 : 0);
      }

      dayData.rooms.push(roomData);
    }

    schedule.push(dayData);
  }

  return schedule;
}

// Save generated data to a file
async function saveScheduleData() {
  try {
    const scheduleData = await generateScheduleData();
    fs.writeFileSync('./scheduleData.json', JSON.stringify(scheduleData, null, 2));
    return scheduleData;
  } catch (error) {
    console.error('Error saving schedule data:', error);
    throw error;
  }
}

// API Route Handler
export default async function handler(req, res) {
  try {
    const scheduleData = await saveScheduleData();
    res.status(200).json({ message: 'Schedule generated successfully', data: scheduleData });
  } catch (error) {
    console.error('Error in API route:', error);
    res.status(500).json({ error: 'Failed to generate schedule' });
  } finally {
    await prisma.$disconnect();
  }
}