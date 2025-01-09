import { NextApiRequest, NextApiResponse } from 'next';
import acceleratedPrisma from '../../lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check if the requester is authenticated and authorized
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Check if the requester is an admin
  const requester = await acceleratedPrisma.authorizedUser.findUnique({
    where: { email: session.user.email },
    select: { isAdmin: true }
  });

  if (!requester?.isAdmin) {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }

  switch (req.method) {
    case 'POST':
      // Add a new authorized user
      try {
        const { email, name } = req.body;
        const user = await acceleratedPrisma.authorizedUser.create({
          data: {
            email,
            name,
            isAdmin: false, // New users are not admins by default
          },
        });
        return res.status(200).json(user);
      } catch (error) {
        console.error('Error adding authorized user:', error);
        return res.status(500).json({ message: 'Error adding user' });
      }

    case 'DELETE':
      // Remove an authorized user
      try {
        const { email } = req.body;
        await acceleratedPrisma.authorizedUser.delete({
          where: { email },
        });
        return res.status(200).json({ message: 'User removed' });
      } catch (error) {
        console.error('Error removing authorized user:', error);
        return res.status(500).json({ message: 'Error removing user' });
      }

    case 'GET':
      // List all authorized users
      try {
        const users = await acceleratedPrisma.authorizedUser.findMany({
          select: {
            email: true,
            name: true,
            isAdmin: true,
            createdAt: true,
          },
        });
        return res.status(200).json(users);
      } catch (error) {
        console.error('Error fetching authorized users:', error);
        return res.status(500).json({ message: 'Error fetching users' });
      }

    default:
      res.setHeader('Allow', ['POST', 'DELETE', 'GET']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 