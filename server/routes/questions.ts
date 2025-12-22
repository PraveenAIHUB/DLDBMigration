import express from 'express';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, requireBidder, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { lotId, carId } = req.query;
    const isAdmin = req.userRole === 'admin';
    const isBusinessUser = req.userRole === 'business';

    const where: any = {};
    if (lotId) where.lotId = lotId as string;
    if (carId) where.carId = carId as string;

    if (!isAdmin && !isBusinessUser) {
      where.askedById = req.userId;
    }

    const questions = await prisma.question.findMany({
      where,
      include: {
        askedBy: { select: { name: true, email: true } },
        lot: true,
        car: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: questions });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, requireBidder, async (req: AuthRequest, res) => {
  try {
    const { lotId, carId, questionText } = req.body;

    const question = await prisma.question.create({
      data: {
        lotId,
        carId,
        askedById: req.userId!,
        questionText
      }
    });

    res.json({ data: question });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/answer', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { answerText } = req.body;

    const question = await prisma.question.update({
      where: { id },
      data: {
        answered: true,
        answerText,
        answeredById: req.userId,
        answeredAt: new Date()
      }
    });

    res.json({ data: question });
  } catch (error) {
    console.error('Answer question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.question.delete({
      where: { id }
    });

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
