import acceleratedPrisma from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email } = req.body;

  try {
    const authorizedUser = await acceleratedPrisma.authorizedUser.findUnique({
      where: { email },
    });

    if (authorizedUser) {
      res.status(200).json({ authorized: true });
    } else {
      await acceleratedPrisma.signInLog.create({
        data: {
          email,
          timestamp: new Date(),
          success: false,
        },
      });
      res.status(403).json({ authorized: false });
    }
  } catch (error) {
    console.error('Authorization check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
} 