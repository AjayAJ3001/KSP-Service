import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { AppError } from './errorHandler';
import { JWTPayload } from '../types';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    name: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Please login.', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new AppError('Server configuration error.', 500);

    const decoded = jwt.verify(token, secret) as JWTPayload;

    // Verify user still exists and is active
    const result = await query(
      'SELECT id, username, role, name, status FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found. Please login again.', 401);
    }

    const user = result.rows[0];
    if (user.status !== 'ACTIVE') {
      throw new AppError('Your account is inactive. Please contact the administrator.', 401);
    }

    req.user = { id: user.id, username: user.username, role: user.role, name: user.name };
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required.', 401));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError('You do not have permission to perform this action.', 403));
      return;
    }
    next();
  };
};
