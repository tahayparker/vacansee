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
    const result = await prisma.class.deleteMany({});
    console.log('Table cleared, deleted count:', result.count);
    return result;
  } catch (error) {
    console.error('Error clearing table:', error);
    throw error; // Re-throw to handle it in the calling function
  }
};

const insertData = async (data: ClassData[]) => {
  try {
    if (data.length === 0) {
      throw new Error('No data to insert');
    }
    const result = await prisma.class.createMany({
      data: data,
    });
    console.log('Data inserted successfully, count:', result.count);
    return result;
  } catch (error) {
    console.error('Error inserting data:', error);
    throw error; // Re-throw to handle it in the calling function
  }
};

const initDB = async () => {
  try {
    await clearTable(); // Clear existing data

    const csvFilePath = path.resolve(process.cwd(), 'public', 'classes.csv');
    console.log('CSV Path:', csvFilePath);
    
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found at path: ${csvFilePath}`);
    }

    const csvText = fs.readFileSync(csvFilePath, 'utf8');
    console.log('CSV content length:', csvText.length);

    if (!csvText.trim()) {
      throw new Error('CSV file is empty');
    }

    const parsedData = Papa.parse<ClassData>(csvText, {
      header: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          console.error('CSV parsing errors:', results.errors);
        }
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
    console.log('Number of rows parsed:', parsedData.length);

    // Filter out any empty rows that might be parsed
    const validData = parsedData.filter((row) => {
      const isValid = row.SubCode && row.Class && row.Day && 
                     row.StartTime && row.EndTime && row.Room && row.Teacher;
      if (!isValid) {
        console.log('Invalid row found:', row);
      }
      return isValid;
    });

    console.log('Number of valid rows:', validData.length);

    if (validData.length === 0) {
      throw new Error('No valid data found in CSV');
    }

    await insertData(validData as ClassData[]);
    return validData; // Return the data that was inserted
  } catch (error) {
    console.error('Error in initDB:', error);
    throw error; // Re-throw to be caught by runInitDB
  }
};

export const runInitDB = async () => {
  try {
    // Test database connection first
    await prisma.$connect();
    console.log('Database connection successful');

    const data = await initDB();
    
    if (!data) {
      throw new Error('No data returned from initDB');
    }

    console.log('Database initialized with', data.length, 'records');
    return { 
      success: true, 
      message: 'Database initialized successfully',
      count: data.length 
    };
  } catch (err) {
    console.error('Error in runInitDB:', err);
    
    // More specific error message
    const errorMessage = err instanceof Error 
      ? err.message 
      : 'Unknown database initialization error';
      
    return { 
      success: false, 
      message: errorMessage,
      error: err
    };
  } finally {
    try {
      await prisma.$disconnect();
      console.log('Database disconnected');
    } catch (disconnectError) {
      console.error('Error disconnecting from database:', disconnectError);
    }
  }
};