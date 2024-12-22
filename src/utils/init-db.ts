import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import prisma from '../lib/db';

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

  const parsedData = Papa.parse<ClassData>(csvText, {
    header: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
    complete: (results) => {
      results.data.forEach((row) => {
        const keys = Object.keys(row);
        if (keys.length > 7) { // Assuming 7 is the number of expected columns
          const extraData = keys.slice(7).map(key => (row as unknown as Record<string, string>)[key]).join(' ');
          row.Teacher += ` ${extraData}`; // Concatenate extra data to the last column
          keys.slice(7).forEach(key => delete (row as unknown as Record<string, string>)[key]);
        }
      });
    }
  }).data;

  // Log parsed data for debugging
  console.log('Parsed Data:', parsedData);

  // Filter out any empty rows that might be parsed
  const validData = parsedData.filter((row) => row.SubCode && row.Class && row.Day && row.StartTime && row.EndTime && row.Room && row.Teacher);

  if (validData.length === 0) {
    throw new Error('No valid data found in CSV');
  }

  await insertData(validData as ClassData[]);
};

export default initDB;

initDB().then(() => {
  console.log('Database initialized');
}).catch((err) => {
  console.error('Error initializing database:', err);
}).finally(() => {
  prisma.$disconnect();
});