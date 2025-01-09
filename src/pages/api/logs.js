import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import db from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get user's email from the session to check if they're an admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if user is admin
    const user = await db.authorizedUser.findUnique({
      where: { email: session.user.email }
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Fetch logs
    const logs = await db.signInLog.findMany({
      orderBy: { timestamp: 'desc' }
    });

    res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
} 