import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export default async function handler(req, res) {
  const { room, day, startTime, endTime } = req.query;

  // Open a connection to the database
  const db = await open({
    filename: 'classes.db',
    driver: sqlite3.Database,
  });

  try {
    // Query to check room availability based on the given time range
    const query = `
      SELECT * FROM classes
      WHERE Room = ?
      AND Day = ?
      AND NOT (EndTime <= ? OR StartTime >= ?)
    `;
    const result = await db.all(query, [room, day, startTime, endTime]);

    const isAvailable = result.length === 0;
    
    res.status(200).json({ available: isAvailable });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    // Close the database connection
    await db.close();
  }
}