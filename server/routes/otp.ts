import express from 'express';
import prisma from '../prisma';

const router = express.Router();

router.post('/send', async (req, res) => {
  try {
    const { email, phone, method } = req.body;

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const otp = await prisma.otpStorage.create({
      data: {
        email: method === 'email' ? email : null,
        phone: method === 'mobile' ? phone : null,
        otpCode,
        otpMethod: method,
        expiresAt
      }
    });

    console.log(`OTP for ${email || phone}: ${otpCode}`);

    res.json({ message: 'OTP sent successfully', otpId: otp.id });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { email, phone, otpCode } = req.body;

    const otp = await prisma.otpStorage.findFirst({
      where: {
        OR: [
          { email, otpCode },
          { phone, otpCode }
        ],
        verified: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    await prisma.otpStorage.update({
      where: { id: otp.id },
      data: { verified: true }
    });

    res.json({ message: 'OTP verified successfully', verified: true });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/cleanup', async (req, res) => {
  try {
    await prisma.otpStorage.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { verified: true }
        ]
      }
    });

    res.json({ message: 'Expired OTPs cleaned up' });
  } catch (error) {
    console.error('Cleanup OTPs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
