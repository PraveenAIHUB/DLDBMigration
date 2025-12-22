import express from 'express';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const terms = await prisma.termsAndCondition.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: terms });
  } catch (error) {
    console.error('Get terms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/latest', async (req, res) => {
  try {
    const terms = await prisma.termsAndCondition.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: terms });
  } catch (error) {
    console.error('Get latest terms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { version, content } = req.body;

    await prisma.termsAndCondition.updateMany({
      where: { active: true },
      data: { active: false }
    });

    const terms = await prisma.termsAndCondition.create({
      data: {
        version,
        content,
        active: true,
        createdById: req.userId
      }
    });

    res.json({ data: terms });
  } catch (error) {
    console.error('Create terms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
