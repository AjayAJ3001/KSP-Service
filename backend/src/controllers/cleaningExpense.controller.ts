import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

// ===== CLEANING EXPENSE RATES =====

export const getCleaningExpenseRates = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string;

  let sql = 'SELECT * FROM cleaning_expense_rates';
  const params: any[] = [];

  if (status) {
    sql += ' WHERE status = $1';
    params.push(status);
  }

  sql += ' ORDER BY loading_expense ASC';

  const result = await query(sql, params);
  res.json({ success: true, message: 'Cleaning expense rates retrieved.', data: result.rows });
});

export const getCleaningExpenseRateById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query('SELECT * FROM cleaning_expense_rates WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) throw new AppError('Cleaning expense rate not found.', 404);
  res.json({ success: true, message: 'Cleaning expense rate retrieved.', data: result.rows[0] });
});

export const createCleaningExpenseRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { loading_expense, cleaning_charge, description } = req.body;

  if (loading_expense === undefined || loading_expense === null) {
    throw new AppError('Loading expense amount is required.', 400);
  }
  if (cleaning_charge === undefined || cleaning_charge === null) {
    throw new AppError('Cleaning charge is required.', 400);
  }
  if (parseFloat(loading_expense) < 0) throw new AppError('Loading expense must be >= 0.', 400);
  if (parseFloat(cleaning_charge) < 0) throw new AppError('Cleaning charge must be >= 0.', 400);

  // Check for duplicate loading_expense
  const existing = await query(
    'SELECT id FROM cleaning_expense_rates WHERE loading_expense = $1',
    [parseFloat(loading_expense)]
  );
  if (existing.rows.length > 0) {
    throw new AppError(`A cleaning expense rate for loading expense Rs.${loading_expense} already exists.`, 409);
  }

  const result = await query(
    `INSERT INTO cleaning_expense_rates (loading_expense, cleaning_charge, description)
     VALUES ($1, $2, $3) RETURNING *`,
    [parseFloat(loading_expense), parseFloat(cleaning_charge), description?.trim() || null]
  );

  await createAuditLog(req.user?.id, 'CREATE_CLEANING_EXPENSE_RATE', 'CLEANING_EXPENSE_RATES', result.rows[0].id, {
    loading_expense,
    cleaning_charge,
  });

  res.status(201).json({ success: true, message: 'Cleaning expense rate created.', data: result.rows[0] });
});

export const updateCleaningExpenseRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { loading_expense, cleaning_charge, description, status } = req.body;
  const { id } = req.params;

  const existing = await query('SELECT id FROM cleaning_expense_rates WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Cleaning expense rate not found.', 404);

  // Check duplicate loading_expense (excluding current record)
  if (loading_expense !== undefined) {
    const dup = await query(
      'SELECT id FROM cleaning_expense_rates WHERE loading_expense = $1 AND id != $2',
      [parseFloat(loading_expense), id]
    );
    if (dup.rows.length > 0) {
      throw new AppError(`A cleaning expense rate for loading expense Rs.${loading_expense} already exists.`, 409);
    }
  }

  const result = await query(
    `UPDATE cleaning_expense_rates
     SET loading_expense  = COALESCE($1, loading_expense),
         cleaning_charge  = COALESCE($2, cleaning_charge),
         description      = COALESCE($3, description),
         status           = COALESCE($4, status),
         updated_at       = NOW()
     WHERE id = $5 RETURNING *`,
    [
      loading_expense !== undefined ? parseFloat(loading_expense) : null,
      cleaning_charge !== undefined ? parseFloat(cleaning_charge) : null,
      description !== undefined ? description?.trim() : null,
      status || null,
      id,
    ]
  );

  if (result.rows.length === 0) throw new AppError('Cleaning expense rate not found.', 404);
  await createAuditLog(req.user?.id, 'UPDATE_CLEANING_EXPENSE_RATE', 'CLEANING_EXPENSE_RATES', id, req.body);
  res.json({ success: true, message: 'Cleaning expense rate updated.', data: result.rows[0] });
});

export const deleteCleaningExpenseRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id FROM cleaning_expense_rates WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Cleaning expense rate not found.', 404);

  await query('DELETE FROM cleaning_expense_rates WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_CLEANING_EXPENSE_RATE', 'CLEANING_EXPENSE_RATES', id);
  res.json({ success: true, message: 'Cleaning expense rate deleted.' });
});
