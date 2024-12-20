import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export const parseCSV = async <T>(filePath: string): Promise<T[]> => {
  const absolutePath = path.resolve(process.cwd(), 'public', filePath);
  const csvText = fs.readFileSync(absolutePath, 'utf8');
  return new Promise((resolve, reject) => {
    Papa.parse<T>(csvText, {
      header: true,
      complete: (results) => resolve(results.data),
      error: (error: Error) => reject(error),
    });
  });
};