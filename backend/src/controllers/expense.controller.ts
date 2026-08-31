import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

export const getTripExpenses = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { trip_id } = req.params;
  const result = await query(
    `SELECT de.*, u.name as created_by_name FROM driver_expenses de
     JOIN users u ON de.created_by = u.id
     WHERE de.trip_id = $1 ORDER BY de.created_at ASC`,
    [trip_id]
  );

  const totalResult = await query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM driver_expenses WHERE trip_id = $1`,
    [trip_id]
  );

  const tripResult = await query(`SELECT advance_paid FROM trips WHERE id = $1`, [trip_id]);
  if (tripResult.rows.length === 0) throw new AppError('Trip not found.', 404);

  const total_expenses = parseFloat(totalResult.rows[0].total);
  const advance_paid = parseFloat(tripResult.rows[0].advance_paid);
  const balance_to_driver = total_expenses - advance_paid;

  res.json({
    success: true,
    message: 'Expenses retrieved.',
    data: {
      expenses: result.rows,
      total_expenses,
      advance_paid,
      balance_to_driver,
    },
  });
});

export const addExpense = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { trip_id } = req.params;
  const { expense_type, description, amount } = req.body;

  if (!expense_type || amount === undefined || amount === null) {
    throw new AppError('Expense type and amount are required.', 400);
  }
  if (parseFloat(amount) < 0) throw new AppError('Amount must be >= 0.', 400);

  const validTypes = ['FREIGHT_BASED', 'LOADING', 'UNLOADING', 'TOLL', 'FOOD', 'REPAIR', 'OTHER'];
  if (!validTypes.includes(expense_type)) {
    throw new AppError('Invalid expense type.', 400);
  }

  const tripResult = await query('SELECT id, status FROM trips WHERE id = $1', [trip_id]);
  if (tripResult.rows.length === 0) throw new AppError('Trip not found.', 404);
  if (tripResult.rows[0].status === 'CANCELLED') throw new AppError('Cannot add expenses to a cancelled trip.', 400);

  const result = await query(
    `INSERT INTO driver_expenses (trip_id, expense_type, description, amount, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [trip_id, expense_type, description || null, amount, req.user?.id]
  );

  await createAuditLog(req.user?.id, 'ADD_EXPENSE', 'EXPENSES', result.rows[0].id, { trip_id, expense_type, amount });
  res.status(201).json({ success: true, message: 'Expense added.', data: result.rows[0] });
});

export const updateExpense = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { expense_type, description, amount } = req.body;

  if (amount !== undefined && parseFloat(amount) < 0) throw new AppError('Amount must be >= 0.', 400);

  const result = await query(
    `UPDATE driver_expenses SET expense_type = COALESCE($1, expense_type),
     description = COALESCE($2, description), amount = COALESCE($3, amount), updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [expense_type, description, amount, id]
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
