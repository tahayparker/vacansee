import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ 
        success: false, 
        message: 'Method not allowed' 
      });
    }

    // Path to your Python script
    const scriptPath = path.join(process.cwd(), 'scripts', 'scrape_timetable.py');
    const outputPath = path.join(process.cwd(), 'public', 'classes.csv');

    // Ensure the script exists
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({
        success: false,
        message: 'Scraping script not found'
      });
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
      console.log(output);
      scriptOutput += output;
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(error);
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

      // Add timeout
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Script execution timed out'));
      }, 30000); // 30 seconds timeout
    });

    // Verify the output file was created
    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate classes.csv'
      });
    }

    try {
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

      const initData = await initResponse.json();

      return res.status(200).json({
        success: true,
        message: 'Timetable updated successfully',
        output: scriptOutput,
        dbUpdate: initData
      });

    } catch (dbError) {
      console.error('Database update error:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update database',
        error: dbError.message
      });
    }

  } catch (error) {
    console.error('Error updating timetable:', error);
    // Ensure we always send a valid JSON response
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update timetable',
      error: error.toString()
    });
  }
} 