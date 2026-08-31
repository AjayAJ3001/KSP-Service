import { Response } from 'express';
import { query, getClient } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

export const getSettlements = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (req.user?.role === 'TRANSPORT_USER') {
    conditions.push(`t.created_by = $${paramIdx}`); params.push(req.user.id); paramIdx++;
  }
  if (status) { conditions.push(`s.settlement_status = $${paramIdx}`); params.push(status); paramIdx++; }

  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*) FROM settlements s JOIN trips t ON s.trip_id = t.id WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT s.*, t.trip_date, t.advance_paid, t.total_freight, t.goods_weight, t.freight_rate,
            v.lorry_number, d.name as driver_name, p.name as party_name,
            r.from_location, r.to_location
     FROM settlements s
     JOIN trips t ON s.trip_id = t.id
     JOIN vehicles v ON t.vehicle_id = v.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     WHERE ${where}
     ORDER BY s.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({ success: true, message: 'Settlements retrieved.', data: { items: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

export const getSettlementByTripId = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { trip_id } = req.params;

  const result = await query(
    `SELECT s.*, t.trip_date, t.advance_paid, t.total_freight, t.goods_weight, t.freight_rate,
            v.lorry_number, d.name as driver_name, d.mobile_number as driver_mobile,
            p.name as party_name, r.from_location, r.to_location,
            (SELECT json_agg(json_build_object('expense_type', de.expense_type, 'description', de.description, 'amount', de.amount))
             FROM driver_expenses de WHERE de.trip_id = t.id) as expense_items
     FROM settlements s
     JOIN trips t ON s.trip_id = t.id
     JOIN vehicles v ON t.vehicle_id = v.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     WHERE s.trip_id = $1`,
    [trip_id]
  );

  if (result.rows.length === 0) throw new AppError('Settlement not found for this trip.', 404);
  res.json({ success: true, message: 'Settlement retrieved.', data: result.rows[0] });
});

export const generateSettlement = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { trip_id } = req.params;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get trip with expense totals
    const tripResult = await client.query(
      `SELECT t.*, v.lorry_number, d.name as driver_name, p.name as party_name, r.from_location, r.to_location
       FROM trips t
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       JOIN parties p ON t.party_id = p.id
       JOIN routes r ON t.route_id = r.id
       WHERE t.id = $1 FOR UPDATE`,
      [trip_id]
    );

    if (tripResult.rows.length === 0) throw new AppError('Trip not found.', 404);
    const trip = tripResult.rows[0];

    // Check authorization
    if (req.user?.role === 'TRANSPORT_USER' && trip.created_by !== req.user.id) {
      throw new AppError('You do not have permission to settle this trip.', 403);
    }

    // Check for existing settlement
    const existingSettlement = await client.query('SELECT id FROM settlements WHERE trip_id = $1', [trip_id]);
    if (existingSettlement.rows.length > 0) throw new AppError('Settlement already exists for this trip.', 409);

    // Calculate totals — backend is source of truth
    const expenseResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM driver_expenses WHERE trip_id = $1`,
      [trip_id]
    );

    const total_expenses = parseFloat(expenseResult.rows[0].total);
    const advance_paid = parseFloat(trip.advance_paid);
    const balance_to_driver = total_expenses - advance_paid;

    // Create settlement
    const settlementResult = await client.query(
      `INSERT INTO settlements (trip_id, total_freight, total_expenses, advance_paid, balance_to_driver, settlement_status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6) RETURNING *`,
      [trip_id, trip.total_freight, total_expenses, advance_paid, balance_to_driver, req.user?.id]
    );

    // Update trip status to SETTLED
    await client.query(`UPDATE trips SET status = 'SETTLED', updated_at = NOW() WHERE id = $1`, [trip_id]);

    await client.query('COMMIT');

    await createAuditLog(req.user?.id, 'GENERATE_SETTLEMENT', 'SETTLEMENTS', settlementResult.rows[0].id, { trip_id, balance_to_driver });

    res.status(201).json({
      success: true,
      message: 'Settlement generated successfully.',
      data: { ...settlementResult.rows[0], ...trip },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const verifySettlement = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const result = await query(
    `UPDATE settlements SET settlement_status = 'VERIFIED', verified_by = $1, verified_at = NOW(), updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [req.user?.id, id]
  );

  if (result.rows.length === 0) throw new AppError('Settlement not found.', 404);

  await createAuditLog(req.user?.id, 'VERIFY_SETTLEMENT', 'SETTLEMENTS', id);
  res.json({ success: true, message: 'Settlement verified.', data: result.rows[0] });
});

export const deleteSettlement = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, trip_id FROM settlements WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Settlement not found.', 404);

  await query('DELETE FROM settlements WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_SETTLEMENT', 'SETTLEMENTS', id, existing.rows[0]);
  res.json({ success: true, message: 'Settlement deleted successfully.' });
});

