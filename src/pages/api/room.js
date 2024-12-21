import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const filePath = path.resolve(process.cwd(), 'public', 'classes.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const classes = JSON.parse(fileContents);

    const rooms = [...new Set(classes.map((cls) => cls.Room))].sort();
    res.status(200).json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}