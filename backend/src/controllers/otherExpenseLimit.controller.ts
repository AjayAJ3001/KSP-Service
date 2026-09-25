import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

// ===== OTHER EXPENSE LIMITS MASTER =====

export const getOtherExpenseLimits = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string;
  const party_id = req.query.party_id as string;

  let sql = `
    SELECT oel.*, p.name as party_name
    FROM other_expense_limits oel
    LEFT JOIN parties p ON oel.party_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIdx = 1;

  if (status) {
    sql += ` AND oel.status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  if (party_id !== undefined && party_id !== '') {
    if (party_id === 'null' || party_id === 'GLOBAL') {
      sql += ` AND oel.party_id IS NULL`;
    } else {
      sql += ` AND oel.party_id = $${paramIdx}`;
      params.push(parseInt(party_id));
      paramIdx++;
    }
  }

  sql += ' ORDER BY oel.party_id ASC NULLS FIRST, oel.created_at ASC';

  const result = await query(sql, params);
  res.json({ success: true, message: 'Other expense limits retrieved.', data: result.rows });
});

export const getEffectiveOtherExpenseLimit = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const party_id = req.query.party_id as string;

  // 1. Try to find active limit for specific party
  if (party_id && party_id !== '0' && party_id !== 'null') {
    const partyLimit = await query(
      `SELECT oel.*, p.name as party_name
       FROM other_expense_limits oel
       LEFT JOIN parties p ON oel.party_id = p.id
       WHERE oel.party_id = $1 AND oel.status = 'active'
       LIMIT 1`,
      [parseInt(party_id)]
    );
    if (partyLimit.rows.length > 0) {
      res.json({ success: true, message: 'Effective other expense limit retrieved.', data: partyLimit.rows[0] });
      return;
    }
  }

  // 2. Fallback to global (party_id IS NULL)
  const globalLimit = await query(
    `SELECT oel.*
     FROM other_expense_limits oel
     WHERE oel.party_id IS NULL AND oel.status = 'active'
     ORDER BY oel.created_at DESC
     LIMIT 1`
  );

  if (globalLimit.rows.length > 0) {
    res.json({ success: true, message: 'Effective other expense limit retrieved (global).', data: globalLimit.rows[0] });
    return;
  }

  // 3. No limit found — return default 200
  res.json({
    success: true,
    message: 'No limit configured, using default.',
    data: { id: 0, party_id: null, max_amount: 200, description: 'Default limit', status: 'active' },
  });
});

export const createOtherExpenseLimit = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { party_id, max_amount, description } = req.body;

  if (max_amount === undefined || max_amount === null || parseFloat(max_amount) < 0) {
    throw new AppError('Max amount is required and must be >= 0.', 400);
  }

  // Check for existing active limit for this scope
  const existingCheck = party_id
    ? await query(`SELECT id FROM other_expense_limits WHERE party_id = $1 AND status = 'active'`, [party_id])
    : await query(`SELECT id FROM other_expense_limits WHERE party_id IS NULL AND status = 'active'`);

  if (existingCheck.rows.length > 0) {
    throw new AppError(
      party_id
        ? 'An active limit already exists for this party. Edit the existing one instead.'
        : 'A global limit already exists. Edit it instead of creating a new one.',
      400
    );
  }

  const result = await query(
    `INSERT INTO other_expense_limits (party_id, max_amount, description, status)
     VALUES ($1, $2, $3, 'active') RETURNING *`,
    [party_id || null, max_amount, description || null]
  );

  await createAuditLog(req.user?.id, 'CREATE_OTHER_EXPENSE_LIMIT', 'OTHER_EXPENSE_LIMITS', result.rows[0].id, { party_id, max_amount });
  res.status(201).json({ success: true, message: 'Other expense limit created.', data: result.rows[0] });
});

export const updateOtherExpenseLimit = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { max_amount, description, status } = req.body;

  if (max_amount !== undefined && parseFloat(max_amount) < 0) {
    throw new AppError('Max amount must be >= 0.', 400);
  }

  const result = await query(
    `UPDATE other_expense_limits
     SET max_amount = COALESCE($1, max_amount),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [max_amount, description, status, id]
  );

  if (result.rows.length === 0) throw new AppError('Other expense limit not found.', 404);

  await createAuditLog(req.user?.id, 'UPDATE_OTHER_EXPENSE_LIMIT', 'OTHER_EXPENSE_LIMITS', id, req.body);
  res.json({ success: true, message: 'Other expense limit updated.', data: result.rows[0] });
});

export const deleteOtherExpenseLimit = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const result = await query(`DELETE FROM other_expense_limits WHERE id = $1 RETURNING *`, [id]);
  if (result.rows.length === 0) throw new AppError('Other expense limit not found.', 404);
  await createAuditLog(req.user?.id, 'DELETE_OTHER_EXPENSE_LIMIT', 'OTHER_EXPENSE_LIMITS', id);
  res.json({ success: true, message: 'Other expense limit deleted.' });
});
