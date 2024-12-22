import prisma from '../../lib/db';
import fs from 'fs/promises';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const timeSlots = [
    '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
    '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
    '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00',
    '20:30', '21:00', '21:30', '22:00', '22:30'
];

// Debugging helper
const logDebug = (message, data = null) => {
    console.log(`[DEBUG] ${message}`);
    if (data !== null) {
        console.log(JSON.stringify(data, null, 2));
    }
};

// Fetch unique room names and truncate them
async function fetchRooms() {
    try {
        logDebug('Fetching unique room names from database...');
        const rooms = await prisma.class.findMany({
            select: { Room: true },
            distinct: ['Room'],
            orderBy: { Room: 'asc' }
        });
        const roomNames = rooms.map(({ Room }) => Room.replace(/-.*$/, ''));
        logDebug('Fetched and truncated room names:', roomNames);
        return roomNames;
    } catch (error) {
        console.error('Error fetching rooms:', error);
        return [];
    }
}

// Check room availability for a specific slot
async function checkRoomAvailability(room, day, startTime, endTime) {
    try {
        logDebug(`Checking availability for room ${room} on ${day} from ${startTime} to ${endTime}...`);
        const result = await prisma.class.findFirst({
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
        logDebug(`Result: ${JSON.stringify(result, null, 2)}`);
        logDebug(`Room ${room} availability: ${isAvailable ? 'Available' : 'Not Available'}`);
        return isAvailable;
    } catch (error) {
        console.error(`Error checking availability for room ${room}:`, error);
        return false;
    }
}

// Generate the schedule data
async function generateScheduleData() {
    logDebug('Starting schedule data generation...');
    const roomNames = await fetchRooms();
    const schedule = [];

    for (const day of daysOfWeek) {
        const dayData = { day, rooms: [] };
        logDebug(`Processing day: ${day}`);

        for (const room of roomNames) {
            const roomData = { room, availability: [] };
            logDebug(`Processing room: ${room}`);

            for (let i = 0; i < timeSlots.length - 1; i++) {

                // Start time is current time slot + 1 minute. Replace the last character of each time slot with '1'
                const startTime = timeSlots[i].slice(0, -1) + '1';
                const endTime = startTime.slice(0, -1) + '2';
                const available = await checkRoomAvailability(room, day, startTime, endTime);
                roomData.availability.push(available ? 1 : 0);
            }

            dayData.rooms.push(roomData);
        }

        schedule.push(dayData);
    }

    logDebug('Completed schedule data generation.');
    return schedule;
}

// Save the generated schedule data to a file
async function saveScheduleData() {
    try {
        logDebug('Saving schedule data to JSON file...');
        const scheduleData = await generateScheduleData();
        await fs.writeFile('./scheduleData.json', JSON.stringify(scheduleData, null, 2));
        logDebug('Schedule data saved successfully.');
    } catch (error) {
        console.error('Error saving schedule data:', error);
    }
}

// Export for API usage
export default async function handler(req, res) {
    try {
        logDebug('Handler triggered via API request.');
        await saveScheduleData();
        res.status(200).json({ message: 'Schedule generated successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate schedule' });
    }
}
