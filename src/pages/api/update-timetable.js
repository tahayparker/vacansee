import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import * as cheerio from 'cheerio';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      console.log(`Attempt ${i + 1} failed, status: ${response.status}`);
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) throw error;
    }
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
  }
  throw new Error(`Failed after ${maxRetries} attempts`);
}

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

    // Fetch timetable data directly from the viewer page
    const timetableUrl = 'https://my.uowdubai.ac.ae/timetable/viewer';
    
    try {
      const response = await fetchWithRetry(timetableUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch timetable: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Check if we're on the login page
      if (html.includes('login.microsoftonline.com')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. Please log in to UOW Dubai first.'
        });
      }
      
      // Load HTML into cheerio
      const $ = cheerio.load(html);
      
      // Try to extract the timetableData JavaScript variable
      const scripts = $('script').map((_, el) => $(el).html()).get();
      let timetableData = null;
      
      for (const script of scripts) {
        if (script.includes('timetableData')) {
          try {
            // Extract the timetableData array using regex
            const match = script.match(/timetableData\s*=\s*(\[.*?\]);/s);
            if (match && match[1]) {
              timetableData = JSON.parse(match[1]);
              break;
            }
          } catch (error) {
            console.error('Error parsing timetable data:', error);
          }
        }
      }

      if (!timetableData || timetableData.length === 0) {
        throw new Error('No timetable data found on the page');
      }

      // Transform the data to match our CSV format
      const transformedData = timetableData.map(entry => ({
        SubCode: (entry.subject_code || '').replace(/\s+/g, ''),
        Class: (entry.type_with_section || '').trim(),
        Day: entry.week_day || '',
        StartTime: entry.start_time || '',
        EndTime: entry.end_time || '',
        Room: entry.location || '',
        Teacher: entry.lecturer || ''
      }));

      // Initialize the database with the new data
      const initResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/initdb`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timetableData: transformedData })
      });

      if (!initResponse.ok) {
        const errorData = await initResponse.text();
        throw new Error(`Failed to initialize database: ${errorData}`);
      }

      const initData = await initResponse.json();

      return res.status(200).json({
        success: true,
        message: 'Timetable updated successfully',
        recordCount: transformedData.length,
        dbUpdate: initData
      });

    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch timetable data',
        error: fetchError.message
      });
    }

  } catch (error) {
    console.error('Error updating timetable:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update timetable',
      error: error.toString()
    });
  }
} 