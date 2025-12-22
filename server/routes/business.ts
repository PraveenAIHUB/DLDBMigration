import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, requireBusinessUser, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const businessUsers = await prisma.businessUser.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: businessUsers });
  } catch (error) {
    console.error('Get business users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticateToken, requireBusinessUser, async (req: AuthRequest, res) => {
  try {
    const businessUser = await prisma.businessUser.findUnique({
      where: { id: req.userId }
    });

    if (!businessUser) {
      return res.status(404).json({ error: 'Business user not found' });
    }

    const { passwordHash, ...userData } = businessUser;
    res.json({ data: userData });
  } catch (error) {
    console.error('Get business user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email, password, name, phone } = req.body;

    const existingUser = await prisma.businessUser.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Business user already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const businessUser = await prisma.businessUser.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
        createdById: req.userId
      }
    });

    const { passwordHash: _, ...userData } = businessUser;
    res.json({ data: userData });
  } catch (error) {
    console.error('Create business user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { email, name, phone, password } = req.body;

    const updateData: any = { email, name, phone };

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const businessUser = await prisma.businessUser.update({
      where: { id },
      data: updateData
    });

    const { passwordHash, ...userData } = businessUser;
    res.json({ data: userData });
  } catch (error) {
    console.error('Update business user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.businessUser.delete({
      where: { id }
    });

    res.json({ message: 'Business user deleted successfully' });
  } catch (error) {
    console.error('Delete business user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
