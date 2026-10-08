import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

// ===== TRUCK ADVANCES =====

/**
 * GET /truck-advances/mine
 * Returns all truck advances given by the currently logged-in manager.
 */
export const getMyTruckAdvances = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const managerId = req.user?.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const countResult = await query(
    `SELECT COUNT(*) as total_count, COALESCE(SUM(amount), 0) as total_amount
     FROM truck_advances
     WHERE manager_id = $1`,
    [managerId]
  );

  const result = await query(
    `SELECT ta.*,
            v.lorry_number,
            v.vehicle_type,
            u.name as manager_name
     FROM truck_advances ta
     JOIN vehicles v ON ta.vehicle_id = v.id
     JOIN users u ON ta.manager_id = u.id
     WHERE ta.manager_id = $1
     ORDER BY ta.advance_date DESC, ta.created_at DESC
     LIMIT $2 OFFSET $3`,
    [managerId, limit, offset]
  );

  res.json({
    success: true,
    message: 'Your truck advance records retrieved.',
    data: {
      items: result.rows,
      total: parseInt(countResult.rows[0].total_count),
      totalAmount: parseFloat(countResult.rows[0].total_amount),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countResult.rows[0].total_count) / limit),
    },
  });
});

/**
 * GET /truck-advances/
 * Admin: get all truck advances with filters.
 */
export const getTruckAdvances = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const vehicle_id = req.query.vehicle_id as string;
  const manager_id = req.query.manager_id as string;
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (vehicle_id) {
    conditions.push(`ta.vehicle_id = $${paramIdx}`);
    params.push(vehicle_id);
    paramIdx++;
  }
  if (manager_id) {
    conditions.push(`ta.manager_id = $${paramIdx}`);
    params.push(manager_id);
    paramIdx++;
  }
  if (from_date) {
    conditions.push(`ta.advance_date >= $${paramIdx}`);
    params.push(from_date);
    paramIdx++;
  }
  if (to_date) {
    conditions.push(`ta.advance_date <= $${paramIdx}::date + interval '1 day'`);
    params.push(to_date);
    paramIdx++;
  }

  const where = conditions.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*) as total_count, COALESCE(SUM(ta.amount), 0) as total_amount
     FROM truck_advances ta WHERE ${where}`,
    params
  );

  const result = await query(
    `SELECT ta.*,
            v.lorry_number, v.vehicle_type,
            u.name as manager_name,
            cb.name as created_by_name
     FROM truck_advances ta
     JOIN vehicles v ON ta.vehicle_id = v.id
     JOIN users u ON ta.manager_id = u.id
     LEFT JOIN users cb ON ta.created_by = cb.id
     WHERE ${where}
     ORDER BY ta.advance_date DESC, ta.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    message: 'Truck advances retrieved.',
    data: {
      items: result.rows,
      total: parseInt(countResult.rows[0].total_count),
      totalAmount: parseFloat(countResult.rows[0].total_amount),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countResult.rows[0].total_count) / limit),
    },
  });
});

const resolveAdvanceDate = (dateVal?: string | Date | null): string => {
  if (!dateVal) return new Date().toISOString();
  if (dateVal instanceof Date) return dateVal.toISOString();
  const clean = String(dateVal).trim();
  if (!clean) return new Date().toISOString();

  // If date only: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayUTC = now.toISOString().split('T')[0];
    if (clean === todayLocal || clean === todayUTC) {
      return now.toISOString();
    }
    const [y, m, d] = clean.split('-').map(Number);
    const combined = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return combined.toISOString();
  }

  return clean;
};

/**
 * POST /truck-advances
 * Manager gives an advance to a specific vehicle/truck.
 */
export const createTruckAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { vehicle_id, amount, advance_date, notes } = req.body;
  const managerId = req.user?.id;

  if (!vehicle_id || amount === undefined || amount === null) {
    throw new AppError('Vehicle and Amount are required.', 400);
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new AppError('Advance amount must be greater than 0.', 400);
  }

  // Verify vehicle exists and is active
  const vehicleCheck = await query(`SELECT id FROM vehicles WHERE id = $1 AND status = 'ACTIVE'`, [vehicle_id]);
  if (vehicleCheck.rows.length === 0) {
    throw new AppError('Vehicle not found or inactive.', 404);
  }

  const resolvedDate = resolveAdvanceDate(advance_date);

  const result = await query(
    `INSERT INTO truck_advances (vehicle_id, manager_id, amount, advance_date, notes, created_by)
     VALUES ($1, $2, $3, $4::timestamp, $5, $6)
     RETURNING *`,
    [vehicle_id, managerId, numAmount, resolvedDate, notes?.trim() || null, managerId]
  );

  // Fetch enriched result with vehicle info
  const enriched = await query(
    `SELECT ta.*, v.lorry_number, v.vehicle_type, u.name as manager_name
     FROM truck_advances ta
     JOIN vehicles v ON ta.vehicle_id = v.id
     JOIN users u ON ta.manager_id = u.id
     WHERE ta.id = $1`,
    [result.rows[0].id]
  );

  await createAuditLog(managerId, 'CREATE_TRUCK_ADVANCE', 'TRUCK_ADVANCES', result.rows[0].id, {
    vehicle_id,
    manager_id: managerId,
    amount: numAmount,
  });

  res.status(201).json({
    success: true,
    message: 'Truck advance recorded successfully.',
    data: enriched.rows[0],
  });
});

/**
 * DELETE /truck-advances/:id
 * Admin can delete a truck advance record.
 */
export const deleteTruckAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, amount FROM truck_advances WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Truck advance record not found.', 404);

  await query('DELETE FROM truck_advances WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_TRUCK_ADVANCE', 'TRUCK_ADVANCES', id, existing.rows[0]);
  res.json({ success: true, message: 'Truck advance deleted successfully.' });
});
