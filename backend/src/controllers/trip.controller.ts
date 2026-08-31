import { Response } from 'express';
import { query, getClient } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

export const getTrips = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status as string;
  const party_id = req.query.party_id as string;
  const driver_id = req.query.driver_id as string;
  const vehicle_id = req.query.vehicle_id as string;
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;
  const created_by = req.query.created_by as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  // TRANSPORT_USER can only see their own trips
  if (req.user?.role === 'TRANSPORT_USER') {
    conditions.push(`t.created_by = $${paramIdx}`); params.push(req.user.id); paramIdx++;
  } else if (created_by) {
    conditions.push(`t.created_by = $${paramIdx}`); params.push(created_by); paramIdx++;
  }

  if (status) { conditions.push(`t.status = $${paramIdx}`); params.push(status); paramIdx++; }
  if (party_id) { conditions.push(`t.party_id = $${paramIdx}`); params.push(party_id); paramIdx++; }
  if (driver_id) { conditions.push(`t.driver_id = $${paramIdx}`); params.push(driver_id); paramIdx++; }
  if (vehicle_id) { conditions.push(`t.vehicle_id = $${paramIdx}`); params.push(vehicle_id); paramIdx++; }
  if (from_date) { conditions.push(`t.trip_date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`t.trip_date <= $${paramIdx}`); params.push(to_date); paramIdx++; }

  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*) FROM trips t WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT t.*, 
            v.lorry_number, d.name as driver_name, p.name as party_name,
            r.from_location, r.to_location, u.name as unit_name,
            u.abbreviation as unit_abbreviation,
            (SELECT COALESCE(SUM(received_amount), 0) FROM trip_payments WHERE trip_id = t.id) as total_received,
            (t.total_freight - COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0)) as balance_due
     FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     JOIN units u ON t.unit_id = u.id
     WHERE ${where}
     ORDER BY t.trip_date DESC, t.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({ success: true, message: 'Trips retrieved.', data: { items: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

export const getTripById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT t.*, 
            v.lorry_number, d.name as driver_name, d.mobile_number as driver_mobile,
            p.name as party_name, p.mobile_number as party_mobile,
            r.from_location, r.to_location, u.name as unit_name, u.abbreviation as unit_abbreviation,
            (SELECT COALESCE(SUM(received_amount), 0) FROM trip_payments WHERE trip_id = t.id) as total_received,
            (t.total_freight - COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0)) as balance_due
     FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     JOIN units u ON t.unit_id = u.id
     WHERE t.id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) throw new AppError('Trip not found.', 404);

  // Check authorization for TRANSPORT_USER
  if (req.user?.role === 'TRANSPORT_USER' && result.rows[0].created_by !== req.user.id) {
    throw new AppError('You do not have permission to view this trip.', 403);
  }

  res.json({ success: true, message: 'Trip retrieved.', data: result.rows[0] });
});

export const createTrip = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { vehicle_id, driver_id, party_id, route_id, unit_id, freight_rate_id, freight_rate, goods_weight, advance_paid, trip_date } = req.body;

  if (!vehicle_id || !driver_id || !party_id || !route_id || !unit_id || !freight_rate || !goods_weight || !trip_date) {
    throw new AppError('Vehicle, driver, party, route, unit, freight rate, weight and date are required.', 400);
  }
  if (goods_weight <= 0) throw new AppError('Goods weight must be greater than 0.', 400);
  if (freight_rate < 0) throw new AppError('Freight rate must be >= 0.', 400);
  if ((advance_paid || 0) < 0) throw new AppError('Advance paid must be >= 0.', 400);

  // Backend calculates total freight — never trust frontend
  const total_freight = parseFloat(goods_weight) * parseFloat(freight_rate);

  const result = await query(
    `INSERT INTO trips (vehicle_id, driver_id, party_id, route_id, unit_id, freight_rate_id,
     freight_rate, goods_weight, total_freight, advance_paid, trip_date, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PAYMENT_PENDING', $12)
     RETURNING *`,
    [vehicle_id, driver_id, party_id, route_id, unit_id, freight_rate_id || null,
     freight_rate, goods_weight, total_freight, advance_paid || 0, trip_date, req.user?.id]
  );

  await createAuditLog(req.user?.id, 'CREATE_TRIP', 'TRIPS', result.rows[0].id, { trip_date, total_freight });
  res.status(201).json({ success: true, message: 'Trip created successfully.', data: result.rows[0] });
});

export const updateTripStatus = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  const validStatuses = ['NEW', 'PAYMENT_PENDING', 'PARTIALLY_PAID', 'SETTLED', 'CANCELLED'];
  if (!validStatuses.includes(status)) throw new AppError('Invalid status.', 400);

  const result = await query(
    `UPDATE trips SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Trip not found.', 404);

  await createAuditLog(req.user?.id, `UPDATE_TRIP_STATUS_${status}`, 'TRIPS', req.params.id);
  res.json({ success: true, message: 'Trip status updated.', data: result.rows[0] });
});

export const deleteTrip = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, trip_date, total_freight FROM trips WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Trip not found.', 404);

  await query('DELETE FROM trip_payments WHERE trip_id = $1', [id]);
  await query('DELETE FROM driver_expenses WHERE trip_id = $1', [id]);
  await query('DELETE FROM settlements WHERE trip_id = $1', [id]);
  await query('DELETE FROM trips WHERE id = $1', [id]);

  await createAuditLog(req.user?.id, 'DELETE_TRIP', 'TRIPS', id, existing.rows[0]);
  res.json({ success: true, message: 'Trip and associated records deleted successfully.' });
});

