import { Response } from 'express';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getTripReport = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { from_date, to_date, party_id, driver_id, vehicle_id, status } = req.query;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (from_date) { conditions.push(`t.trip_date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`t.trip_date <= $${paramIdx}`); params.push(to_date); paramIdx++; }
  if (party_id) { conditions.push(`t.party_id = $${paramIdx}`); params.push(party_id); paramIdx++; }
  if (driver_id) { conditions.push(`t.driver_id = $${paramIdx}`); params.push(driver_id); paramIdx++; }
  if (vehicle_id) { conditions.push(`t.vehicle_id = $${paramIdx}`); params.push(vehicle_id); paramIdx++; }
  if (status) { conditions.push(`t.status = $${paramIdx}`); params.push(status); paramIdx++; }

  const where = conditions.join(' AND ');
  const result = await query(
    `SELECT t.id, t.trip_date, t.goods_weight, t.freight_rate, t.total_freight, t.advance_paid, t.status,
            v.lorry_number, d.name as driver_name, p.name as party_name,
            r.from_location, r.to_location, u.name as unit_name,
            COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0) as total_received,
            (t.total_freight - COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0)) as balance_due
     FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     JOIN units u ON t.unit_id = u.id
     WHERE ${where}
     ORDER BY t.trip_date DESC`,
    params
  );

  const summaryResult = await query(
    `SELECT COUNT(*) as total_trips, 
            COALESCE(SUM(t.total_freight), 0) as total_freight,
            COALESCE(SUM((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id)), 0) as total_received,
            COALESCE(SUM(t.total_freight) - SUM((SELECT COALESCE(SUM(received_amount), 0) FROM trip_payments WHERE trip_id = t.id)), 0) as total_balance
     FROM trips t WHERE ${where}`,
    params
  );

  res.json({
    success: true,
    message: 'Trip report retrieved.',
    data: { trips: result.rows, summary: summaryResult.rows[0] },
  });
});

export const getPaymentReport = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { from_date, to_date, party_id } = req.query;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (from_date) { conditions.push(`tp.payment_date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`tp.payment_date <= $${paramIdx}`); params.push(to_date); paramIdx++; }
  if (party_id) { conditions.push(`t.party_id = $${paramIdx}`); params.push(party_id); paramIdx++; }

  const result = await query(
    `SELECT tp.id, tp.payment_date, tp.received_amount, tp.balance_due, tp.payment_status, tp.notes,
            t.trip_date, t.total_freight, p.name as party_name, r.from_location, r.to_location,
            v.lorry_number, u.name as created_by_name
     FROM trip_payments tp
     JOIN trips t ON tp.trip_id = t.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     JOIN vehicles v ON t.vehicle_id = v.id
     JOIN users u ON tp.created_by = u.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY tp.payment_date DESC`,
    params
  );

  res.json({ success: true, message: 'Payment report retrieved.', data: result.rows });
});

export const getSettlementReport = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { from_date, to_date, status } = req.query;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (from_date) { conditions.push(`s.created_at::date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`s.created_at::date <= $${paramIdx}`); params.push(to_date); paramIdx++; }
  if (status) { conditions.push(`s.settlement_status = $${paramIdx}`); params.push(status); paramIdx++; }

  const result = await query(
    `SELECT s.*, t.trip_date, t.advance_paid, v.lorry_number, d.name as driver_name,
            p.name as party_name, r.from_location, r.to_location
     FROM settlements s
     JOIN trips t ON s.trip_id = t.id
     JOIN vehicles v ON t.vehicle_id = v.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.created_at DESC`,
    params
  );

  res.json({ success: true, message: 'Settlement report retrieved.', data: result.rows });
});

export const getAuditLogs = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  const module = req.query.module as string;
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (module) { conditions.push(`al.module = $${paramIdx}`); params.push(module); paramIdx++; }
  if (from_date) { conditions.push(`al.created_at::date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`al.created_at::date <= $${paramIdx}`); params.push(to_date); paramIdx++; }

  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*) FROM audit_logs al WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT al.*, u.username, u.name as user_name
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE ${where}
     ORDER BY al.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    message: 'Audit logs retrieved.',
    data: { items: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});
