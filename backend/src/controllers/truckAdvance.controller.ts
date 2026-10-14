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
            u.name as manager_name,
            d.name as driver_name,
            d.mobile_number as driver_mobile,
            t.id as trip_id,
            t.trip_date,
            t.goods_weight,
            t.total_freight,
            COALESCE(
              (SELECT s.total_expenses FROM settlements s WHERE s.trip_id = t.id LIMIT 1),
              (SELECT COALESCE(SUM(de.amount), 0) FROM driver_expenses de WHERE de.trip_id = t.id),
              0
            ) as driver_expenses,
            p.id as party_id,
            p.name as party_name,
            un.name as unit_name,
            un.abbreviation as unit_abbreviation
     FROM truck_advances ta
     JOIN vehicles v ON ta.vehicle_id = v.id
     JOIN users u ON ta.manager_id = u.id
     LEFT JOIN drivers d ON ta.driver_id = d.id
     LEFT JOIN trips t ON ta.trip_id = t.id AND t.status NOT IN ('CANCELLED', 'DRAFT')
     LEFT JOIN parties p ON t.party_id = p.id
     LEFT JOIN units un ON t.unit_id = un.id
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
  const driver_id = req.query.driver_id as string;
  const manager_id = req.query.manager_id as string;
  const party_id = req.query.party_id as string;
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;
  const search = (req.query.search as string || '').trim();

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (vehicle_id) {
    conditions.push(`ta.vehicle_id = $${paramIdx}`);
    params.push(vehicle_id);
    paramIdx++;
  }
  if (driver_id) {
    conditions.push(`ta.driver_id = $${paramIdx}`);
    params.push(driver_id);
    paramIdx++;
  }
  if (manager_id) {
    conditions.push(`ta.manager_id = $${paramIdx}`);
    params.push(manager_id);
    paramIdx++;
  }
  if (party_id) {
    conditions.push(`t.party_id = $${paramIdx}`);
    params.push(party_id);
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
  if (search) {
    conditions.push(`(v.lorry_number ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR d.name ILIKE $${paramIdx} OR ta.notes ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*) as total_count, COALESCE(SUM(ta.amount), 0) as total_amount
     FROM truck_advances ta
     JOIN vehicles v ON ta.vehicle_id = v.id
     JOIN users u ON ta.manager_id = u.id
     LEFT JOIN drivers d ON ta.driver_id = d.id
     LEFT JOIN trips t ON ta.trip_id = t.id
     LEFT JOIN parties p ON t.party_id = p.id
     WHERE ${where}`,
    params
  );

  const result = await query(
    `SELECT ta.*,
            v.lorry_number, v.vehicle_type,
            u.name as manager_name,
            d.name as driver_name, d.mobile_number as driver_mobile,
            cb.name as created_by_name,
            t.id as trip_id,
            t.trip_date,
            t.goods_weight,
            t.total_freight,
            t.freight_rate,
            t.status as trip_status,
            COALESCE(
              (SELECT s.total_expenses FROM settlements s WHERE s.trip_id = t.id LIMIT 1),
              (SELECT COALESCE(SUM(de.amount), 0) FROM driver_expenses de WHERE de.trip_id = t.id),
              0
            ) as driver_expenses,
            p.id as party_id,
            p.name as party_name,
            un.name as unit_name,
            un.abbreviation as unit_abbreviation,
            r.from_location,
            r.to_location
     FROM truck_advances ta
     JOIN vehicles v ON ta.vehicle_id = v.id
     JOIN users u ON ta.manager_id = u.id
     LEFT JOIN drivers d ON ta.driver_id = d.id
     LEFT JOIN users cb ON ta.created_by = cb.id
     LEFT JOIN trips t ON ta.trip_id = t.id AND t.status NOT IN ('CANCELLED', 'DRAFT')
     LEFT JOIN parties p ON t.party_id = p.id
     LEFT JOIN units un ON t.unit_id = un.id
     LEFT JOIN routes r ON t.route_id = r.id
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

/**
 * GET /truck-advances/manager-summary
 * Returns overview of advances for all managers (or filtered manager):
 * - Total received from owners
 * - Total given to trucks/drivers
 * - Available balance in hand
 */
export const getManagerAdvancesSummary = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const manager_id = req.query.manager_id as string;
  const showAll = req.query.all === 'true';
  let userCondition = "u.status = 'ACTIVE'";
  const params: any[] = [];
  let paramIdx = 1;

  if (manager_id) {
    userCondition += ` AND u.id = $${paramIdx}`;
    params.push(parseInt(manager_id));
    paramIdx++;
  } else if (!showAll) {
    // Only show managers who get advance (received advances from owners or disbursed advances)
    userCondition += ` AND (
      EXISTS (SELECT 1 FROM owner_advances oa WHERE oa.manager_id = u.id AND oa.amount > 0)
      OR EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.manager_id = u.id AND ta.amount > 0)
      OR EXISTS (SELECT 1 FROM driver_advances da WHERE da.manager_id = u.id AND da.amount > 0)
    )`;
  }

  const summaryResult = await query(
    `SELECT 
       u.id as manager_id,
       u.name as manager_name,
       u.email as manager_email,
       u.mobile_number as manager_mobile,
       u.role,
       COALESCE((SELECT SUM(oa.amount) FROM owner_advances oa WHERE oa.manager_id = u.id), 0) as total_received,
       COALESCE((SELECT COUNT(oa.id) FROM owner_advances oa WHERE oa.manager_id = u.id), 0) as received_count,
       (
         COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.manager_id = u.id), 0) +
         COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.manager_id = u.id), 0)
       ) as total_given,
       (
         COALESCE((SELECT COUNT(ta.id) FROM truck_advances ta WHERE ta.manager_id = u.id), 0) +
         COALESCE((SELECT COUNT(da.id) FROM driver_advances da WHERE da.manager_id = u.id), 0)
       ) as given_count,
       (
         COALESCE((SELECT SUM(oa.amount) FROM owner_advances oa WHERE oa.manager_id = u.id), 0) -
         (
           COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.manager_id = u.id), 0) +
           COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.manager_id = u.id), 0)
         )
       ) as available_balance
     FROM users u
     WHERE ${userCondition}
     ORDER BY u.name ASC`,
    params
  );

  const grandTotals = summaryResult.rows.reduce(
    (acc: any, row: any) => {
      acc.total_received += parseFloat(row.total_received || 0);
      acc.total_given += parseFloat(row.total_given || 0);
      acc.total_available += parseFloat(row.available_balance || 0);
      return acc;
    },
    { total_received: 0, total_given: 0, total_available: 0 }
  );

  res.json({
    success: true,
    message: 'Manager advances summary retrieved.',
    data: {
      managers: summaryResult.rows,
      grand_totals: grandTotals,
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
    const istOffset = (5 * 60 + 30) * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    const todayIST = nowIST.toISOString().split('T')[0];
    if (clean === todayIST) {
      return now.toISOString();
    }
    const [y, m, d] = clean.split('-').map(Number);
    // Combine date with current IST hours/minutes/seconds
    const dtIST = new Date(Date.UTC(y, m - 1, d, nowIST.getUTCHours(), nowIST.getUTCMinutes(), nowIST.getUTCSeconds()));
    const finalUtc = new Date(dtIST.getTime() - istOffset);
    return finalUtc.toISOString();
  }

  return clean;
};

/**
 * POST /truck-advances
 * Manager gives an advance to a specific vehicle/truck and driver.
 */
export const createTruckAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { vehicle_id, driver_id, amount, advance_date, notes, trip_id } = req.body;
  // If admin creates on behalf of a manager, accept manager_id; otherwise current user
  const managerId = req.user?.role === 'ADMIN' && req.body.manager_id ? parseInt(req.body.manager_id) : req.user?.id;

  if (!vehicle_id || amount === undefined || amount === null) {
    throw new AppError('Vehicle and Amount are required.', 400);
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new AppError('Advance amount must be greater than 0.', 400);
  }

  // Verify vehicle exists and is active
  const vehicleCheck = await query(`SELECT id, lorry_number FROM vehicles WHERE id = $1 AND status = 'ACTIVE'`, [vehicle_id]);
  if (vehicleCheck.rows.length === 0) {
    throw new AppError('Vehicle not found or inactive.', 404);
  }

  // If driver_id provided, verify driver exists
  if (driver_id) {
    const driverCheck = await query(`SELECT id, name FROM drivers WHERE id = $1 AND status = 'ACTIVE'`, [driver_id]);
    if (driverCheck.rows.length === 0) {
      throw new AppError('Driver not found or inactive.', 404);
    }
  }

  const resolvedDate = resolveAdvanceDate(advance_date);

  const result = await query(
    `INSERT INTO truck_advances (vehicle_id, driver_id, manager_id, amount, advance_date, notes, created_by, trip_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [vehicle_id, driver_id || null, managerId, numAmount, resolvedDate, notes?.trim() || null, req.user?.id, trip_id || null]
  );

  // Fetch enriched result with vehicle and driver info
  const enriched = await query(
    `SELECT ta.*, v.lorry_number, v.vehicle_type, u.name as manager_name,
            d.name as driver_name, d.mobile_number as driver_mobile,
            t.id as trip_id, t.goods_weight, t.total_freight,
            COALESCE(
              (SELECT s.total_expenses FROM settlements s WHERE s.trip_id = t.id LIMIT 1),
              (SELECT COALESCE(SUM(de.amount), 0) FROM driver_expenses de WHERE de.trip_id = t.id),
              0
            ) as driver_expenses,
            p.name as party_name, un.name as unit_name, un.abbreviation as unit_abbreviation
     FROM truck_advances ta
     JOIN vehicles v ON ta.vehicle_id = v.id
     JOIN users u ON ta.manager_id = u.id
     LEFT JOIN drivers d ON ta.driver_id = d.id
     LEFT JOIN trips t ON ta.trip_id = t.id
     LEFT JOIN parties p ON t.party_id = p.id
     LEFT JOIN units un ON t.unit_id = un.id
     WHERE ta.id = $1`,
    [result.rows[0].id]
  );

  await createAuditLog(req.user?.id, 'CREATE_TRUCK_ADVANCE', 'TRUCK_ADVANCES', result.rows[0].id, {
    vehicle_id,
    driver_id,
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
