import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import fs from 'fs';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const timeSlots = [
  '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', 
  '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', 
  '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', 
  '20:30', '21:00', '21:30', '22:00', '22:30'
];

// Function to check room availability
async function checkRoomAvailability(room, day, startTime, endTime) {
  const db = await open({
    filename: 'classes.db',
    driver: sqlite3.Database,
  });

  try {
    const query = `
      SELECT * FROM classes
      WHERE Room = ?
      AND Day = ?
      AND NOT (EndTime <= ? OR StartTime >= ?)
    `;
    const result = await db.all(query, [room, day, startTime, endTime]);
    return result.length === 0; // If no results, the room is available
  } catch (error) {
    console.error(error);
    return false; // In case of an error, assume not available
  } finally {
    await db.close();
  }
}

// Function to generate schedule data
async function generateScheduleData() {
  const fetchRooms = async () => {
    const db = await open({
      filename: 'classes.db',
      driver: sqlite3.Database,
    });

    try {
      const rooms = await db.all('SELECT DISTINCT Room FROM classes');
      return rooms.map((room) => room.Room);
    } catch (error) {
      console.error(error);
      return [];
    } finally {
      await db.close();
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

// Run the script to generate and save the data
saveScheduleData().catch((error) => console.error('Error generating schedule data:', error));
