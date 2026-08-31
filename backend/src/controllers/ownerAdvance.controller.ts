import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

// ===== OWNER ADVANCES =====

export const getOwnerAdvances = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const owner_id = req.query.owner_id as string;
  const manager_id = req.query.manager_id as string;
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;
  const search = req.query.search as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (owner_id) {
    conditions.push(`oa.owner_id = $${paramIdx}`);
    params.push(owner_id);
    paramIdx++;
  }

  if (manager_id) {
    conditions.push(`oa.manager_id = $${paramIdx}`);
    params.push(manager_id);
    paramIdx++;
  }

  if (from_date) {
    conditions.push(`oa.advance_date >= $${paramIdx}`);
    params.push(from_date);
    paramIdx++;
  }

  if (to_date) {
    conditions.push(`oa.advance_date <= $${paramIdx}::date + interval '1 day'`);
    params.push(to_date);
    paramIdx++;
  }

  if (search) {
    conditions.push(`(o.name ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR oa.notes ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*) as total_count, COALESCE(SUM(oa.amount), 0) as total_amount
     FROM owner_advances oa
     JOIN owners o ON oa.owner_id = o.id
     JOIN users u ON oa.manager_id = u.id
     WHERE ${where}`,
    params
  );

  const total = parseInt(countResult.rows[0].total_count);
  const totalAmount = parseFloat(countResult.rows[0].total_amount);

  const result = await query(
    `SELECT oa.*,
            o.name as owner_name,
            u.name as manager_name,
            cb.name as created_by_name
     FROM owner_advances oa
     JOIN owners o ON oa.owner_id = o.id
     JOIN users u ON oa.manager_id = u.id
     LEFT JOIN users cb ON oa.created_by = cb.id
     WHERE ${where}
     ORDER BY oa.advance_date DESC, oa.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    message: 'Owner advances retrieved.',
    data: {
      items: result.rows,
      total,
      totalAmount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const getOwnerAdvanceById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT oa.*,
            o.name as owner_name,
            u.name as manager_name,
            cb.name as created_by_name
     FROM owner_advances oa
     JOIN owners o ON oa.owner_id = o.id
     JOIN users u ON oa.manager_id = u.id
     LEFT JOIN users cb ON oa.created_by = cb.id
     WHERE oa.id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) throw new AppError('Owner advance record not found.', 404);
  res.json({ success: true, message: 'Owner advance retrieved.', data: result.rows[0] });
});

export const createOwnerAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { owner_id, manager_id, amount, advance_date, payment_mode, notes, screenshot_url } = req.body;

  if (!owner_id || !manager_id || amount === undefined || amount === null) {
    throw new AppError('Owner, Manager and Amount are required.', 400);
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new AppError('Advance amount must be greater than 0.', 400);
  }

  const result = await query(
    `INSERT INTO owner_advances (owner_id, manager_id, amount, advance_date, payment_mode, notes, screenshot_url, created_by)
     VALUES ($1, $2, $3, COALESCE($4::timestamp, NOW()), $5, $6, $7, $8)
     RETURNING *`,
    [
      owner_id,
      manager_id,
      numAmount,
      advance_date || null,
      payment_mode || 'CASH',
      notes?.trim() || null,
      screenshot_url || null,
      req.user?.id,
    ]
  );

  await createAuditLog(req.user?.id, 'CREATE_OWNER_ADVANCE', 'OWNER_ADVANCES', result.rows[0].id, {
    owner_id,
    manager_id,
    amount: numAmount,
  });

  res.status(201).json({ success: true, message: 'Owner advance recorded successfully.', data: result.rows[0] });
});

export const updateOwnerAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { owner_id, manager_id, amount, advance_date, payment_mode, notes, screenshot_url } = req.body;
  const { id } = req.params;

  const existing = await query('SELECT id FROM owner_advances WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Owner advance record not found.', 404);

  if (amount !== undefined && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
    throw new AppError('Advance amount must be greater than 0.', 400);
  }

  const result = await query(
    `UPDATE owner_advances
     SET owner_id = COALESCE($1, owner_id),
         manager_id = COALESCE($2, manager_id),
         amount = COALESCE($3, amount),
         advance_date = COALESCE($4::timestamp, advance_date),
         payment_mode = COALESCE($5, payment_mode),
         notes = COALESCE($6, notes),
         screenshot_url = COALESCE($7, screenshot_url),
         updated_at = NOW()
     WHERE id = $8
     RETURNING *`,
    [
      owner_id || null,
      manager_id || null,
      amount !== undefined ? parseFloat(amount) : null,
      advance_date || null,
      payment_mode || null,
      notes !== undefined ? notes?.trim() : null,
      screenshot_url !== undefined ? screenshot_url : null,
      id,
    ]
  );

  await createAuditLog(req.user?.id, 'UPDATE_OWNER_ADVANCE', 'OWNER_ADVANCES', id, req.body);
  res.json({ success: true, message: 'Owner advance updated.', data: result.rows[0] });
});

export const deleteOwnerAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, amount FROM owner_advances WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Owner advance record not found.', 404);

  await query('DELETE FROM owner_advances WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_OWNER_ADVANCE', 'OWNER_ADVANCES', id, existing.rows[0]);
  res.json({ success: true, message: 'Owner advance deleted successfully.' });
});
