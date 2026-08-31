import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

export const getUsers = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search as string;
  const role = req.query.role as string;
  const status = req.query.status as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(u.username ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (role) { conditions.push(`u.role = $${paramIdx}`); params.push(role); paramIdx++; }
  if (status) { conditions.push(`u.status = $${paramIdx}`); params.push(status); paramIdx++; }

  const where = conditions.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*) FROM users u WHERE ${where}`, params
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT u.id, u.username, u.name, u.email, u.mobile_number, u.role, u.status,
            u.driver_id, u.created_at, u.updated_at, u.last_login,
            d.name as driver_name
     FROM users u
     LEFT JOIN drivers d ON u.driver_id = d.id
     WHERE ${where}
     ORDER BY u.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    message: 'Users retrieved.',
    data: {
      items: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const getUserById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const result = await query(
    `SELECT u.id, u.username, u.name, u.email, u.mobile_number, u.role, u.status,
            u.driver_id, u.created_at, u.updated_at, u.last_login,
            d.name as driver_name
     FROM users u LEFT JOIN drivers d ON u.driver_id = d.id
     WHERE u.id = $1`,
    [id]
  );
  if (result.rows.length === 0) throw new AppError('User not found.', 404);
  res.json({ success: true, message: 'User retrieved.', data: result.rows[0] });
});

export const createUser = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { username, name, password, email, mobile_number, role, driver_id } = req.body;

  if (!username || !name || !password || !role) {
    throw new AppError('Username, name, password and role are required.', 400);
  }
  if (password.length < 6) throw new AppError('Password must be at least 6 characters.', 400);
  if (!['ADMIN', 'MANAGER', 'TRANSPORT_USER'].includes(role)) {
    throw new AppError('Invalid role. Must be ADMIN, MANAGER, or TRANSPORT_USER.', 400);
  }

  const existing = await query('SELECT id FROM users WHERE username = $1', [username.trim().toLowerCase()]);
  if (existing.rows.length > 0) throw new AppError('Username already exists.', 409);

  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const passwordHash = await bcrypt.hash(password, rounds);

  const result = await query(
    `INSERT INTO users (username, name, password_hash, email, mobile_number, role, driver_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
     RETURNING id, username, name, email, mobile_number, role, driver_id, status, created_at`,
    [username.trim().toLowerCase(), name.trim(), passwordHash, email || null, mobile_number || null, role, driver_id || null]
  );

  await createAuditLog(req.user?.id, 'CREATE_USER', 'USERS', result.rows[0].id, { username });

  res.status(201).json({ success: true, message: 'User created successfully.', data: result.rows[0] });
});

export const updateUser = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, email, mobile_number, role, driver_id } = req.body;

  const existing = await query('SELECT id FROM users WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('User not found.', 404);

  const result = await query(
    `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email),
     mobile_number = COALESCE($3, mobile_number), role = COALESCE($4, role),
     driver_id = $5, updated_at = NOW()
     WHERE id = $6
     RETURNING id, username, name, email, mobile_number, role, driver_id, status, updated_at`,
    [name, email, mobile_number, role, driver_id || null, id]
  );

  await createAuditLog(req.user?.id, 'UPDATE_USER', 'USERS', id, { changes: req.body });
  res.json({ success: true, message: 'User updated successfully.', data: result.rows[0] });
});

export const updateUserStatus = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    throw new AppError('Invalid status.', 400);
  }

  const result = await query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, username, status`,
    [status, id]
  );

  if (result.rows.length === 0) throw new AppError('User not found.', 404);

  await createAuditLog(req.user?.id, status === 'ACTIVE' ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'USERS', id);
  res.json({ success: true, message: `User ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully.`, data: result.rows[0] });
});

export const resetPassword = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    throw new AppError('New password must be at least 6 characters.', 400);
  }

  const existing = await query('SELECT id, username FROM users WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('User not found.', 404);

  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const passwordHash = await bcrypt.hash(new_password, rounds);

  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, id]);
  await createAuditLog(req.user?.id, 'RESET_PASSWORD', 'USERS', id, { target_user: existing.rows[0].username });

  res.json({ success: true, message: 'Password reset successfully.' });
});

export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  if (parseInt(id, 10) === req.user?.id) {
    throw new AppError('You cannot delete your own account.', 400);
  }
  const existing = await query('SELECT id, username FROM users WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('User not found.', 404);

  await query('DELETE FROM users WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_USER', 'USERS', parseInt(id, 10), { username: existing.rows[0].username });
  res.json({ success: true, message: 'User deleted successfully.' });
});


