import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const dbFile = path.resolve(process.cwd(), 'classes.db');

const createTable = async (db: Database) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS classes (
      SubCode TEXT,
      Class TEXT,
      Day TEXT,
      StartTime TEXT,
      EndTime TEXT,
      Room TEXT,
      Teacher TEXT
    )
  `);
};

const clearTable = async (db: Database) => {
  await db.exec('DELETE FROM classes');
};

interface ClassData {
  SubCode: string;
  Class: string;
  Day: string;
  StartTime: string;
  EndTime: string;
  Room: string;
  Teacher: string;
}

const insertData = async (db: Database, data: ClassData[]) => {
  const insert = 'INSERT INTO classes (SubCode, Class, Day, StartTime, EndTime, Room, Teacher) VALUES (?, ?, ?, ?, ?, ?, ?)';
  for (const row of data) {
    await db.run(insert, [row.SubCode, row.Class, row.Day, row.StartTime, row.EndTime, row.Room, row.Teacher]);
  }
};

const initDB = async () => {
  const db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });

  await createTable(db);
  await clearTable(db); // Clear existing data

  const csvFilePath = path.resolve(process.cwd(), 'public', 'classes.csv');
  const csvText = fs.readFileSync(csvFilePath, 'utf8');
  const parsedData = Papa.parse<ClassData>(csvText, { header: true }).data;

  await insertData(db, parsedData as ClassData[]);

  await db.close();
};

export default initDB;

initDB().then(() => {
  console.log('Database initialized');
}).catch((err) => {
  console.error('Error initializing database:', err);
});