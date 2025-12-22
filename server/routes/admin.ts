import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/me', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: req.userId }
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const { passwordHash, ...adminData } = admin;
    res.json({ data: adminData });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/create', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email, password, name } = req.body;

    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        name
      }
    });

    const { passwordHash: _, ...adminData } = admin;
    res.json({ data: adminData });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
