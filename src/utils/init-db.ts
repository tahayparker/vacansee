import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ClassData {
  SubCode: string;
  Class: string;
  Day: string;
  StartTime: string;
  EndTime: string;
  Room: string;
  Teacher: string;
}

const clearTable = async () => {
  try {
    await prisma.class.deleteMany({});
    console.log('Table cleared');
  } catch (error) {
    console.error('Error clearing table:', error);
  }
};

const insertData = async (data: ClassData[]) => {
  try {
    if (data.length === 0) {
      throw new Error('No data to insert');
    }
    await prisma.class.createMany({
      data: data,
    });
    console.log('Data inserted successfully');
  } catch (error) {
    console.error('Error inserting data:', error);
  }
};

const initDB = async () => {
  await clearTable(); // Clear existing data

  const csvFilePath = path.resolve(process.cwd(), 'public', 'classes.csv');
  const csvText = fs.readFileSync(csvFilePath, 'utf8');
  const parsedData = Papa.parse<ClassData>(csvText, { header: true }).data;

  console.log('Parsed Data:', parsedData); // Debugging log

  await insertData(parsedData as ClassData[]);
};

export default initDB;

initDB().then(() => {
  console.log('Database initialized');
}).catch((err) => {
  console.error('Error initializing database:', err);
}).finally(() => {
  prisma.$disconnect();
});