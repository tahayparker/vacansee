import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const csvFilePath = path.resolve(process.cwd(), 'public', 'classes.csv');
    const csvText = fs.readFileSync(csvFilePath, 'utf8');
    const parsedData = Papa.parse(csvText, { header: true }).data;

    const jsonFilePath = path.resolve(process.cwd(), 'public', 'classes.json');
    fs.writeFileSync(jsonFilePath, JSON.stringify(parsedData, null, 2));

    res.status(200).json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Error initializing database:', error);
    res.status(500).json({ error: 'Error initializing database' });
  }
}