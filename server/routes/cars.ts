import express from 'express';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { lotId, status } = req.query;
    const isAdmin = req.userRole === 'admin';

    const where: any = {};

    if (lotId) where.lotId = lotId as string;
    if (status) where.status = status as string;

    if (!isAdmin && req.userRole !== 'business') {
      where.biddingEnabled = true;
      where.status = 'Active';
    }

    const cars = await prisma.car.findMany({
      where,
      include: {
        lot: true,
        bids: isAdmin || req.userRole === 'business' ? {
          include: { user: { select: { name: true, email: true, phone: true } } },
          orderBy: { createdAt: 'desc' }
        } : {
          where: { userId: req.userId },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: cars });
  } catch (error) {
    console.error('Get cars error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.userRole === 'admin';

    const car = await prisma.car.findUnique({
      where: { id },
      include: {
        lot: true,
        bids: isAdmin || req.userRole === 'business' ? {
          include: { user: { select: { name: true, email: true, phone: true } } },
          orderBy: { createdAt: 'desc' }
        } : {
          where: { userId: req.userId },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    res.json({ data: car });
  } catch (error) {
    console.error('Get car error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const car = await prisma.car.create({
      data: req.body
    });

    res.json({ data: car });
  } catch (error) {
    console.error('Create car error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const car = await prisma.car.update({
      where: { id },
      data: req.body
    });

    res.json({ data: car });
  } catch (error) {
    console.error('Update car error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.car.delete({
      where: { id }
    });

    res.json({ message: 'Car deleted successfully' });
  } catch (error) {
    console.error('Delete car error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/bulk', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { cars } = req.body;

    const result = await prisma.car.createMany({
      data: cars,
      skipDuplicates: true
    });

    res.json({ data: result, count: result.count });
  } catch (error) {
    console.error('Bulk create cars error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
