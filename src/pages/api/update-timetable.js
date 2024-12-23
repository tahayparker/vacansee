import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

/**
 * API handler for updating timetable data
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Path to your Python script
    const scriptPath = path.join(process.cwd(), 'scripts', 'scrape_timetable.py');
    const outputPath = path.join(process.cwd(), 'public', 'classes.csv');

    // Ensure the script exists
    if (!fs.existsSync(scriptPath)) {
      throw new Error('Scraping script not found');
    }

    // Run the Python script
    const pythonProcess = spawn('python', [
      scriptPath,
      '--output',
      outputPath
    ]);

    let scriptOutput = '';
    let scriptError = '';

    // Collect data from script
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output); // Log to server console
      scriptOutput += output;
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(error); // Log to server console
      scriptError += error;
    });

    // Wait for the script to finish
    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Script exited with code ${code}: ${scriptError}`));
        }
      });
    });

    // Verify the output file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('Failed to generate classes.csv');
    }

    // Initialize the database with the new data
    const initResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/initdb`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!initResponse.ok) {
      throw new Error('Failed to initialize database with new data');
    }

    return res.status(200).json({
      success: true,
      message: 'Timetable updated successfully',
      output: scriptOutput
    });

  } catch (error) {
    console.error('Error updating timetable:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update timetable',
      error: error.toString()
    });
  }
} 