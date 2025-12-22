import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: 'admin' | 'business' | 'bidder';
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: 'admin' | 'business' | 'bidder' };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const requireBusinessUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'business') {
    return res.status(403).json({ error: 'Business user access required' });
  }
  next();
};

export const requireBidder = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'bidder') {
    return res.status(403).json({ error: 'Bidder access required' });
  }
  next();
};
