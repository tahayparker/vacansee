import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { room, day, startTime, endTime } = req.query;

  try {
    const filePath = path.resolve(process.cwd(), 'public', 'classes.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const classes = JSON.parse(fileContents);

    const result = classes.filter(
      (cls) =>
        cls.Room === room &&
        cls.Day === day &&
        !(
          (cls.EndTime <= startTime) ||
          (cls.StartTime >= endTime)
        )
    );

    const isAvailable = result.length === 0; // If no result, the room is available
    res.status(200).json({ available: isAvailable });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}