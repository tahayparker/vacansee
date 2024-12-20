import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ClassData {
  SubCode: string;
  Class: string;
  Day: string;
  StartTime: string;
  EndTime: string;
  Room: string;
  Teacher: string;
}

const createTable = async () => {
  const { error } = await supabase.from('classes').select('*').limit(1);
  if (error) {
    const { error: createError } = await supabase.rpc('create_table', {
      table_name: 'classes',
      columns: [
        { name: 'SubCode', type: 'text' },
        { name: 'Class', type: 'text' },
        { name: 'Day', type: 'text' },
        { name: 'StartTime', type: 'text' },
        { name: 'EndTime', type: 'text' },
        { name: 'Room', type: 'text' },
        { name: 'Teacher', type: 'text' }
      ]
    });
    if (createError) {
      console.error('Error creating table:', createError);
    }
  }
};

const clearTable = async () => {
  const { error } = await supabase.from('classes').delete().neq('id', 0);
  if (error) {
    console.error('Error clearing table:', error);
  }
};

const insertData = async (data: ClassData[]) => {
  const { error } = await supabase.from('classes').insert(data);
  if (error) {
    console.error('Error inserting data:', error);
  }
};

const initDB = async () => {
  await createTable();
  await clearTable(); // Clear existing data

  const csvFilePath = path.resolve(process.cwd(), 'public', 'classes.csv');
  const csvText = fs.readFileSync(csvFilePath, 'utf8');
  const parsedData = Papa.parse<ClassData>(csvText, { header: true }).data;

  await insertData(parsedData as ClassData[]);
};

export default initDB;

initDB().then(() => {
  console.log('Database initialized');
}).catch((err) => {
  console.error('Error initializing database:', err);
});