import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeSlotIndex = Math.floor((currentHour * 60 + currentMinute) / 30);

    const filePath = path.resolve(process.cwd(), 'scheduleData.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const scheduleData = JSON.parse(fileContents);

    const todaySchedule = scheduleData.find(schedule => schedule.day === currentDay);

    if (!todaySchedule) {
      return res.status(200).json([]);
    }

    const freeRooms = todaySchedule.rooms.filter(room => room.availability[currentTimeSlotIndex] === 1).map(room => room.room);

    const uniqueFreeRooms = [...new Set(freeRooms)].sort();
    res.status(200).json(uniqueFreeRooms);
  } catch (error) {
    console.error('Error fetching free rooms:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}