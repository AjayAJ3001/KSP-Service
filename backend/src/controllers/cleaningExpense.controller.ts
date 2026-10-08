import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

// ===== CLEANING EXPENSE RATES (Destination-Based) =====

export const getCleaningExpenseRates = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string;

  let sql = 'SELECT * FROM cleaning_expense_rates WHERE 1=1';
  const params: any[] = [];
  let paramIdx = 1;

  if (status) {
    sql += ` AND status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  sql += ' ORDER BY id ASC';

  const result = await query(sql, params);
  res.json({ success: true, message: 'Cleaning expense rates retrieved.', data: result.rows });
});

export const getCleaningExpenseRateById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query('SELECT * FROM cleaning_expense_rates WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) throw new AppError('Cleaning expense rate not found.', 404);
  res.json({ success: true, message: 'Cleaning expense rate retrieved.', data: result.rows[0] });
});

export const createCleaningExpenseRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { unit_name, loading_expense, cleaning_charge, description } = req.body;

  if (!unit_name || !unit_name.trim()) {
    throw new AppError('Destination / Unit Name is required.', 400);
  }
  if (cleaning_charge === undefined || cleaning_charge === null) {
    throw new AppError('Cleaning charge is required.', 400);
  }
  if (parseFloat(cleaning_charge) < 0) throw new AppError('Cleaning charge must be >= 0.', 400);

  // Check for duplicate unit_name
  const existing = await query(
    'SELECT id FROM cleaning_expense_rates WHERE LOWER(unit_name) = LOWER($1)',
    [unit_name.trim()]
  );
  if (existing.rows.length > 0) {
    throw new AppError(`A cleaning expense rate for "${unit_name}" already exists.`, 409);
  }

  const result = await query(
    `INSERT INTO cleaning_expense_rates (unit_name, loading_expense, cleaning_charge, description)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [
      unit_name.trim(),
      loading_expense !== undefined && loading_expense !== '' ? parseFloat(loading_expense) : null,
      parseFloat(cleaning_charge),
      description?.trim() || null,
    ]
  );

  await createAuditLog(req.user?.id, 'CREATE_CLEANING_EXPENSE_RATE', 'CLEANING_EXPENSE_RATES', result.rows[0].id, {
    unit_name,
    cleaning_charge,
  });

  res.status(201).json({ success: true, message: 'Cleaning expense rate created.', data: result.rows[0] });
});

export const updateCleaningExpenseRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { unit_name, loading_expense, cleaning_charge, description, status } = req.body;
  const { id } = req.params;

  const existing = await query('SELECT * FROM cleaning_expense_rates WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Cleaning expense rate not found.', 404);

  const effectiveUnitName = unit_name !== undefined ? unit_name.trim() : existing.rows[0].unit_name;

  // Check duplicate unit_name (excluding current record)
  if (unit_name !== undefined) {
    const dup = await query(
      'SELECT id FROM cleaning_expense_rates WHERE LOWER(unit_name) = LOWER($1) AND id != $2',
      [effectiveUnitName, id]
    );
    if (dup.rows.length > 0) {
      throw new AppError(`A cleaning expense rate for "${effectiveUnitName}" already exists.`, 409);
    }
  }

  const result = await query(
    `UPDATE cleaning_expense_rates
     SET unit_name       = COALESCE($1, unit_name),
         loading_expense = $2,
         cleaning_charge = COALESCE($3, cleaning_charge),
         description     = COALESCE($4, description),
         status          = COALESCE($5, status),
         updated_at      = NOW()
     WHERE id = $6 RETURNING *`,
    [
      unit_name !== undefined ? unit_name.trim() : null,
      loading_expense !== undefined ? (loading_expense !== '' ? parseFloat(loading_expense) : null) : existing.rows[0].loading_expense,
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
