import { Response } from 'express';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getDashboard = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];

  const [
    usersResult, driversResult, vehiclesResult, partiesResult,
    todayTripsResult, pendingPaymentsResult, settledTripsResult,
    pendingSettlementsResult, recentTripsResult, totalFreightResult
  ] = await Promise.all([
    query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'ACTIVE') as active FROM users`),
    query(`SELECT COUNT(*) as total FROM drivers WHERE status = 'ACTIVE'`),
    query(`SELECT COUNT(*) as total FROM vehicles WHERE status = 'ACTIVE'`),
    query(`SELECT COUNT(*) as total FROM parties WHERE status = 'ACTIVE'`),
    query(`SELECT COUNT(*) as total FROM trips WHERE trip_date = $1`, [today]),
    query(`SELECT COUNT(*) as total FROM trips WHERE status IN ('PAYMENT_PENDING', 'PARTIALLY_PAID')`),
    query(`SELECT COUNT(*) as total FROM trips WHERE status = 'SETTLED'`),
    query(`SELECT COUNT(*) as total FROM settlements WHERE settlement_status = 'PENDING'`),
    query(
      `SELECT t.id, t.trip_date, t.total_freight, t.status, t.advance_paid,
              v.lorry_number, d.name as driver_name, p.name as party_name,
              r.from_location, r.to_location
       FROM trips t
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       JOIN parties p ON t.party_id = p.id
       JOIN routes r ON t.route_id = r.id
       ORDER BY t.created_at DESC LIMIT 10`
    ),
    query(
      `SELECT COALESCE(SUM(t.total_freight), 0) as total_freight,
              COALESCE(SUM(tp.received), 0) as total_received,
              COALESCE(SUM(t.total_freight) - SUM(tp.received), 0) as total_balance
       FROM trips t
       LEFT JOIN (SELECT trip_id, SUM(received_amount) as received FROM trip_payments GROUP BY trip_id) tp
       ON t.id = tp.trip_id
       WHERE t.status NOT IN ('CANCELLED')`
    ),
  ]);

  res.json({
    success: true,
    message: 'Dashboard data retrieved.',
    data: {
      stats: {
        total_users: parseInt(usersResult.rows[0].total),
        active_users: parseInt(usersResult.rows[0].active),
        total_drivers: parseInt(driversResult.rows[0].total),
        total_vehicles: parseInt(vehiclesResult.rows[0].total),
        total_parties: parseInt(partiesResult.rows[0].total),
        trips_today: parseInt(todayTripsResult.rows[0].total),
        pending_payments: parseInt(pendingPaymentsResult.rows[0].total),
        settled_trips: parseInt(settledTripsResult.rows[0].total),
        pending_settlements: parseInt(pendingSettlementsResult.rows[0].total),
      },
      financials: totalFreightResult.rows[0],
      recent_trips: recentTripsResult.rows,
    },
  });
});

export const getMobileDashboard = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user?.id;

  const [todayTripsResult, balanceDueResult, recentTripsResult] = await Promise.all([
    query(
      `SELECT COUNT(*) as total FROM trips WHERE created_by = $1 AND trip_date = $2`,
      [userId, today]
    ),
    query(
      `SELECT COALESCE(SUM(t.total_freight - COALESCE(tp.received, 0)), 0) as balance_due
       FROM trips t
       LEFT JOIN (SELECT trip_id, SUM(received_amount) as received FROM trip_payments GROUP BY trip_id) tp
       ON t.id = tp.trip_id
       WHERE t.created_by = $1 AND t.status NOT IN ('SETTLED', 'CANCELLED')`,
      [userId]
    ),
    query(
      `SELECT t.id, t.trip_date, t.total_freight, t.status, t.advance_paid,
              v.lorry_number, d.name as driver_name, p.name as party_name,
              r.from_location, r.to_location,
              COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0) as total_received,
              (t.total_freight - COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0)) as balance_due
       FROM trips t
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       JOIN parties p ON t.party_id = p.id
       JOIN routes r ON t.route_id = r.id
       WHERE t.created_by = $1
       ORDER BY t.created_at DESC LIMIT 10`,
      [userId]
    ),
  ]);

  res.json({
    success: true,
    message: 'Mobile dashboard data retrieved.',
    data: {
      trips_today: parseInt(todayTripsResult.rows[0].total),
      balance_due: parseFloat(balanceDueResult.rows[0].balance_due),
      recent_trips: recentTripsResult.rows,
    },
  });
});
