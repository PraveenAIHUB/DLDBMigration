import express from 'express';
import prisma from '../prisma';
import { authenticateToken, requireBidder, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { carId } = req.query;
    const isAdmin = req.userRole === 'admin';
    const isBusinessUser = req.userRole === 'business';

    const where: any = {};

    if (carId) where.carId = carId as string;

    if (!isAdmin && !isBusinessUser) {
      where.userId = req.userId;
    }

    const bids = await prisma.bid.findMany({
      where,
      include: {
        car: true,
        user: isAdmin || isBusinessUser ? {
          select: { name: true, email: true, phone: true }
        } : undefined
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: bids });
  } catch (error) {
    console.error('Get bids error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, requireBidder, async (req: AuthRequest, res) => {
  try {
    const { carId, amount } = req.body;
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.approved) {
      return res.status(403).json({ error: 'User not approved to bid' });
    }

    const existingBid = await prisma.bid.findUnique({
      where: {
        carId_userId: {
          carId,
          userId
        }
      }
    });

    let bid;
    if (existingBid) {
      bid = await prisma.bid.update({
        where: { id: existingBid.id },
        data: { amount }
      });
    } else {
      bid = await prisma.bid.create({
        data: {
          carId,
          userId,
          amount
        }
      });
    }

    res.json({ data: bid });
  } catch (error) {
    console.error('Create/update bid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, requireBidder, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const userId = req.userId!;

    const bid = await prisma.bid.findUnique({
      where: { id }
    });

    if (!bid || bid.userId !== userId) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const updatedBid = await prisma.bid.update({
      where: { id },
      data: { amount }
    });

    res.json({ data: updatedBid });
  } catch (error) {
    console.error('Update bid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, requireBidder, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const bid = await prisma.bid.findUnique({
      where: { id }
    });

    if (!bid || bid.userId !== userId) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    await prisma.bid.delete({
      where: { id }
    });

    res.json({ message: 'Bid deleted successfully' });
  } catch (error) {
    console.error('Delete bid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/winner', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== 'admin' && req.userRole !== 'business') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const bid = await prisma.bid.findUnique({
      where: { id },
      include: { car: true }
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    await prisma.bid.updateMany({
      where: { carId: bid.carId },
      data: { isWinner: false }
    });

    const updatedBid = await prisma.bid.update({
      where: { id },
      data: { isWinner: true }
    });

    res.json({ data: updatedBid });
  } catch (error) {
    console.error('Mark winner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
