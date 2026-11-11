import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';
import { assertTripInOwnerScope } from '../utils/ownerScope';
import { applyTripExpenseDefaults, buildTripExpenseDefaults, getTripExpensePayload } from '../utils/tripExpenseDefaults';

export const getTripExpenses = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { trip_id } = req.params;
  await assertTripInOwnerScope(req, trip_id);
  try {
    const data = await getTripExpensePayload(Number(trip_id));
    res.json({ success: true, message: 'Expenses retrieved.', data });
  } catch (err: any) {
    if (String(err.message || '').includes('Trip not found')) throw new AppError('Trip not found.', 404);
    throw err;
  }
});

export const applyDefaultTripExpenses = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { trip_id } = req.params;
  await assertTripInOwnerScope(req, trip_id);
  if (!req.user?.id) throw new AppError('Unauthorized.', 401);
  try {
    const { defaults, applied } = await applyTripExpenseDefaults(Number(trip_id), req.user.id);
    const data = await getTripExpensePayload(Number(trip_id), defaults);
    if (applied.length) {
      await createAuditLog(req.user.id, 'ADD_EXPENSE', 'EXPENSES', trip_id, {
        trip_id,
        auto_applied: applied,
      });
    }
    res.json({
      success: true,
      message: applied.length ? 'Default expenses applied.' : 'Expenses retrieved.',
      data: { ...data, applied },
    });
  } catch (err: any) {
    if (String(err.message || '').includes('Trip not found')) throw new AppError('Trip not found.', 404);
    throw err;
  }
});

export const addExpense = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { trip_id } = req.params;
  await assertTripInOwnerScope(req, trip_id);
  const { expense_type, description, amount } = req.body;

  if (!expense_type || amount === undefined || amount === null) {
    throw new AppError('Expense type and amount are required.', 400);
  }
  if (parseFloat(amount) < 0) throw new AppError('Amount must be >= 0.', 400);

  const validTypes = ['FREIGHT_BASED', 'LOADING', 'UNLOADING', 'TOLL', 'FOOD', 'REPAIR', 'CLEANING', 'CLEANING_CHARGE', 'DRIVER_BETA', 'DRIVER_BATA', 'OTHER'];
  if (!validTypes.includes(expense_type)) {
    throw new AppError('Invalid expense type.', 400);
  }

  const tripResult = await query('SELECT id, status FROM trips WHERE id = $1', [trip_id]);
  if (tripResult.rows.length === 0) throw new AppError('Trip not found.', 404);
  if (tripResult.rows[0].status === 'CANCELLED') throw new AppError('Cannot add expenses to a cancelled trip.', 400);

  const roundedAmount = Math.round(parseFloat(amount));

  const otherTypes = ['OTHER', 'TOLL', 'FOOD', 'REPAIR', 'FREIGHT_BASED'];
  if (otherTypes.includes(expense_type)) {
    const defaults = await buildTripExpenseDefaults(Number(trip_id));
    if (roundedAmount > defaults.other_limit) {
      throw new AppError(`Other expense cannot exceed ₹${defaults.other_limit}. Contact admin to increase the limit.`, 400);
    }
  }

  const result = await query(
    `INSERT INTO driver_expenses (trip_id, expense_type, description, amount, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [trip_id, expense_type, description || null, roundedAmount, req.user?.id]
  );

  await createAuditLog(req.user?.id, 'ADD_EXPENSE', 'EXPENSES', result.rows[0].id, { trip_id, expense_type, amount: roundedAmount });
  res.status(201).json({ success: true, message: 'Expense added.', data: result.rows[0] });
});

export const updateExpense = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { expense_type, description, amount } = req.body;

  if (amount !== undefined && parseFloat(amount) < 0) throw new AppError('Amount must be >= 0.', 400);
  const roundedAmount = amount !== undefined ? Math.round(parseFloat(amount)) : undefined;

  const result = await query(
    `UPDATE driver_expenses SET expense_type = COALESCE($1, expense_type),
     description = COALESCE($2, description), amount = COALESCE($3, amount), updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [expense_type, description, roundedAmount, id]
  );
  if (result.rows.length === 0) throw new AppError('Expense not found.', 404);

  await createAuditLog(req.user?.id, 'UPDATE_EXPENSE', 'EXPENSES', id, req.body);
  res.json({ success: true, message: 'Expense updated.', data: result.rows[0] });
});

export const deleteExpense = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const result = await query(`DELETE FROM driver_expenses WHERE id = $1 RETURNING *`, [id]);
  if (result.rows.length === 0) throw new AppError('Expense not found.', 404);
  await createAuditLog(req.user?.id, 'DELETE_EXPENSE', 'EXPENSES', id);
  res.json({ success: true, message: 'Expense deleted.' });
});
