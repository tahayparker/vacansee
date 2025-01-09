import db from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, name, success, provider = 'GOOGLE' } = req.body;

  try {
    // Convert the provider string to uppercase
    const authProvider = provider.toUpperCase();
    
    // Check if the provider is valid
    if (!['GOOGLE', 'GITHUB', 'UNDETERMINED'].includes(authProvider)) {
      throw new Error(`Invalid auth provider: ${provider}`);
    }

    await db.signInLog.create({
      data: {
        email,
        name,
        timestamp: new Date(),
        success,
        authProvider
      }
    });

    res.status(200).json({ message: 'Log entry created' });
  } catch (error) {
    console.error('Sign-in logging error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
} 