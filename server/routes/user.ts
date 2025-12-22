import express from 'express';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { role, approved } = req.query;

    const where: any = {};
    if (role) where.role = role as string;
    if (approved !== undefined) where.approved = approved === 'true';

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== 'bidder') {
      return res.status(403).json({ error: 'Not a bidder' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { passwordHash, ...userData } = user;
    res.json({ data: userData });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== 'bidder') {
      return res.status(403).json({ error: 'Not a bidder' });
    }

    const { name, phone, secondaryContact } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name, phone, secondaryContact }
    });

    const { passwordHash, ...userData } = user;
    res.json({ data: userData });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/approve', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: {
        approved: true,
        approvedById: req.userId,
        approvedAt: new Date()
      }
    });

    res.json({ data: user });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/reject', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: {
        approved: false,
        approvedById: null,
        approvedAt: null
      }
    });

    res.json({ data: user });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
