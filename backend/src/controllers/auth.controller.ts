import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new AppError('Username and password are required.', 400);
  }

  // Find user by username
  const result = await query(
    `SELECT id, username, name, password_hash, role, status, email, mobile_number, driver_id 
     FROM users WHERE username = $1`,
    [username.trim().toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw new AppError('Invalid username or password.', 401);
  }

  const user = result.rows[0];

  if (user.status !== 'ACTIVE') {
    throw new AppError('Your account is inactive. Please contact the administrator.', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('Invalid username or password.', 401);
  }

  // Generate JWT
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError('Server configuration error.', 500);

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
  );

  // Update last login
  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  // Audit log
  await createAuditLog(user.id, 'LOGIN', 'AUTH', user.id, { username: user.username });

  res.json({
    success: true,
    message: 'Login successful.',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
        mobile_number: user.mobile_number,
        driver_id: user.driver_id,
      },
    },
  });
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await createAuditLog(req.user?.id, 'LOGOUT', 'AUTH', req.user?.id);
  res.json({ success: true, message: 'Logged out successfully.' });
});

export const getMe = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT u.id, u.username, u.name, u.email, u.mobile_number, u.role, u.status, 
            u.driver_id, u.created_at, u.last_login,
            d.name as driver_name, d.license_number, d.mobile_number as driver_mobile
     FROM users u
     LEFT JOIN drivers d ON u.driver_id = d.id
     WHERE u.id = $1`,
    [req.user?.id]
  );

  if (result.rows.length === 0) {
    throw new AppError('User not found.', 404);
  }

  res.json({ success: true, message: 'User retrieved.', data: result.rows[0] });
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    throw new AppError('Current password and new password are required.', 400);
  }

  if (new_password.length < 6) {
    throw new AppError('New password must be at least 6 characters.', 400);
  }

  const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user?.id]);
  if (result.rows.length === 0) throw new AppError('User not found.', 404);

  const isValid = await bcrypt.compare(current_password, result.rows[0].password_hash);
  if (!isValid) throw new AppError('Current password is incorrect.', 400);

  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const newHash = await bcrypt.hash(new_password, rounds);

  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user?.id]);
  await createAuditLog(req.user?.id, 'CHANGE_PASSWORD', 'AUTH', req.user?.id);

  res.json({ success: true, message: 'Password changed successfully.' });
});
