import express from 'express';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.userRole === 'admin';

    const where: any = isAdmin ? {} : {
      approved: true,
      status: { in: ['Approved', 'Active', 'Closed', 'Early Closed'] }
    };

    const lots = await prisma.lot.findMany({
      where,
      include: {
        cars: true,
        _count: {
          select: { cars: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: lots });
  } catch (error) {
    console.error('Get lots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const lot = await prisma.lot.findUnique({
      where: { id },
      include: {
        cars: {
          include: {
            bids: req.userRole === 'admin' || req.userRole === 'business' ? {
              include: { user: { select: { name: true, email: true, phone: true } } }
            } : {
              where: { userId: req.userId }
            }
          }
        }
      }
    });

    if (!lot) {
      return res.status(404).json({ error: 'Lot not found' });
    }

    res.json({ data: lot });
  } catch (error) {
    console.error('Get lot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const lot = await prisma.lot.create({
      data: {
        ...req.body,
        uploadedById: req.userId
      }
    });

    res.json({ data: lot });
  } catch (error) {
    console.error('Create lot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const lot = await prisma.lot.update({
      where: { id },
      data: req.body
    });

    res.json({ data: lot });
  } catch (error) {
    console.error('Update lot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/approve', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const lot = await prisma.lot.update({
      where: { id },
      data: {
        approved: true,
        approvedById: req.userId,
        approvedAt: new Date()
      }
    });

    res.json({ data: lot });
  } catch (error) {
    console.error('Approve lot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/close', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const lot = await prisma.lot.update({
      where: { id },
      data: {
        earlyClosed: true,
        earlyClosedById: req.userId,
        earlyClosedAt: new Date(),
        status: 'Early Closed'
      }
    });

    await prisma.car.updateMany({
      where: { lotId: id },
      data: { status: 'Closed' }
    });

    res.json({ data: lot });
  } catch (error) {
    console.error('Close lot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.lot.delete({
      where: { id }
    });

    res.json({ message: 'Lot deleted successfully' });
  } catch (error) {
    console.error('Delete lot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
