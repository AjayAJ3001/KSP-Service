import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { AppError } from './errorHandler';
import { JWTPayload } from '../types';
import { loadOwnerScope } from '../utils/ownerScope';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    name: string;
    ownerIds?: number[];
    vehicleIds?: number[];
  };
}

type CachedAuth = { user: NonNullable<AuthRequest['user']>; expires: number };
const authCache = new Map<number, CachedAuth>();
const AUTH_CACHE_MS = 20000;

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

    const cached = authCache.get(decoded.userId);
    if (cached && cached.expires > Date.now()) {
      req.user = cached.user;
      next();
      return;
    }

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

    const scope = await loadOwnerScope(user.id, user.role);
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      ownerIds: scope.ownerIds,
      vehicleIds: scope.vehicleIds,
    };
    authCache.set(user.id, { user: req.user, expires: Date.now() + AUTH_CACHE_MS });
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
