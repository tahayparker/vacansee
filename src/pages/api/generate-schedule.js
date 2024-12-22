import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const timeSlots = [
  '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', 
  '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', 
  '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', 
  '20:30', '21:00', '21:30', '22:00', '22:30'
];

// Function to check if a time slot is within a class's time range
function isTimeSlotOccupied(classStartTime, classEndTime, timeSlot) {
  return timeSlot >= classStartTime && timeSlot <= classEndTime;
}

// Function to generate schedule data from CSV
async function generateScheduleData() {
  try {
    // Read CSV file
    const csvPath = path.join(process.cwd(), 'public', 'classes.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ',',
    });

    // Get unique rooms
    const roomSet = new Set(records.map(record => record.Room));
    const rooms = Array.from(roomSet);

    // Initialize schedule structure
    const schedule = daysOfWeek.map(day => ({
      day,
      rooms: rooms.map(room => ({
        room,
        availability: timeSlots.map(() => 1) // Initially all slots available
      }))
    }));

    // Mark occupied time slots
    records.forEach(record => {
      const dayIndex = daysOfWeek.indexOf(record.Day);
      if (dayIndex === -1) return;

      const roomData = schedule[dayIndex].rooms.find(r => r.room === record.Room);
      if (!roomData) return;

      const startTime = record.StartTime.substring(0, 5); // Get HH:MM format
      const endTime = record.EndTime.substring(0, 5);

      timeSlots.forEach((timeSlot, index) => {
        if (isTimeSlotOccupied(startTime, endTime, timeSlot)) {
          roomData.availability[index] = 0;
        }
      });
    });

    return schedule;
  } catch (error) {
    console.error('Error generating schedule:', error);
    throw error;
  }
}

// Save generated data to a file
async function saveScheduleData() {
  try {
    const scheduleData = await generateScheduleData();
    const filePath = path.join(process.cwd(), 'public', 'scheduleData.json');
    fs.writeFileSync(filePath, JSON.stringify(scheduleData, null, 2));
    return scheduleData;
  } catch (error) {
    console.error('Error saving schedule data:', error);
    throw error;
  }
}

// API Route Handler
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'scheduleData.json');
    let scheduleData;
    
    if (fs.existsSync(filePath)) {
      scheduleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else {
      scheduleData = await saveScheduleData();
    }
    
    res.status(200).json(scheduleData);
  } catch (error) {
    console.error('Error in API route:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};