import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../config/db';

export interface AuthRequest extends Request {
  user?: Record<string, any>;
}

// Token Verification Middleware
export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Missing token' });
    }

    const token = authHeader.split(' ')[1];
    const db = getDB();
    const sessionsCollection = db.collection('session');
    const usersCollection = db.collection('user');

    const session = await sessionsCollection.findOne({ token });
    
    if (!session || new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Session expired' });
    }

    const userId = session.userId;
    const userQuery = ObjectId.isValid(userId)
      ? { $or: [{ _id: new ObjectId(userId) }, { id: userId }] }
      : { $or: [{ _id: userId }, { id: userId }] };

    const user = await usersCollection.findOne(userQuery);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Verify token error:", error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Owner/Admin Role Check Middleware
export const verifyOwner = (req: AuthRequest, res: Response, next: NextFunction) => {
  const role = req.user?.role?.toLowerCase();
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: Equipment Owner access only' });
  }
  next();
};