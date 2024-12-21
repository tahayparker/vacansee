import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
export default async function handler(req, res) {
  const db = await open({
    filename: 'classes.db',
    driver: sqlite3.Database,
  });
  try {
    const rooms = await db.all('SELECT DISTINCT Room FROM classes ORDER BY Room ASC');
    const roomNames = rooms.map((room) => room.Room);
    res.status(200).json(roomNames);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    await db.close();
  }
}