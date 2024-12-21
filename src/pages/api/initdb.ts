import type { NextApiRequest, NextApiResponse } from 'next';
import initDB from '../../utils/init-db';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await initDB();
    res.status(200).json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Error initializing database:', error);
    res.status(500).json({ error: 'Error initializing database' });
  }
}
