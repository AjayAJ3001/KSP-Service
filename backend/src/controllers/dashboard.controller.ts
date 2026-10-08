import { Response } from 'express';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getDashboard = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];

  const [
    usersResult, driversResult, vehiclesResult, partiesResult,
    todayTripsResult, pendingPaymentsResult, settledTripsResult,
    pendingSettlementsResult, recentTripsResult, totalFreightResult,
    complianceAlertsResult
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
              t.goods_weight, t.freight_rate,
              v.lorry_number, d.name as driver_name, p.name as party_name,
              r.from_location, r.to_location,
              u.name as unit_name, u.abbreviation as unit_abbreviation,
              COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0) as total_received,
              (t.total_freight - COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0)) as balance_due
       FROM trips t
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       JOIN parties p ON t.party_id = p.id
       JOIN routes r ON t.route_id = r.id
       LEFT JOIN units u ON t.unit_id = u.id
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
    // Vehicles with any document expiring within 30 days (or already expired)
    query(
      `SELECT lorry_number,
              fc_expiry_date, insurance_expiry_date, permit_expiry_date, tax_expiry_date
       FROM vehicles
       WHERE status = 'ACTIVE'
         AND (
           (fc_expiry_date IS NOT NULL AND fc_expiry_date <= CURRENT_DATE + INTERVAL '30 days')
           OR (insurance_expiry_date IS NOT NULL AND insurance_expiry_date <= CURRENT_DATE + INTERVAL '30 days')
           OR (permit_expiry_date IS NOT NULL AND permit_expiry_date <= CURRENT_DATE + INTERVAL '30 days')
           OR (tax_expiry_date IS NOT NULL AND tax_expiry_date <= CURRENT_DATE + INTERVAL '30 days')
         )
       ORDER BY LEAST(
         COALESCE(fc_expiry_date, '9999-12-31'::date),
         COALESCE(insurance_expiry_date, '9999-12-31'::date),
         COALESCE(permit_expiry_date, '9999-12-31'::date),
         COALESCE(tax_expiry_date, '9999-12-31'::date)
       ) ASC`
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
      compliance_alerts: complianceAlertsResult.rows,
    },
  });
});

export const getMobileDashboard = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user?.id;
  const isTransportUser = req.user?.role === 'TRANSPORT_USER';

  const [todayTripsResult, balanceDueResult, recentTripsResult, advanceCreditSummaryResult, truckAdvanceUsedResult, advanceCreditResult] = await Promise.all([
    query(
      isTransportUser
        ? `SELECT COUNT(*) as total FROM trips WHERE created_by = $1 AND trip_date = $2`
        : `SELECT COUNT(*) as total FROM trips WHERE trip_date = $1`,
      isTransportUser ? [userId, today] : [today]
    ),
    query(
      isTransportUser
        ? `SELECT COALESCE(SUM(t.total_freight - COALESCE(tp.received, 0)), 0) as balance_due
           FROM trips t
           LEFT JOIN (SELECT trip_id, SUM(received_amount) as received FROM trip_payments GROUP BY trip_id) tp
           ON t.id = tp.trip_id
           WHERE t.created_by = $1 AND t.status NOT IN ('SETTLED', 'CANCELLED')`
        : `SELECT COALESCE(SUM(t.total_freight - COALESCE(tp.received, 0)), 0) as balance_due
           FROM trips t
           LEFT JOIN (SELECT trip_id, SUM(received_amount) as received FROM trip_payments GROUP BY trip_id) tp
           ON t.id = tp.trip_id
           WHERE t.status NOT IN ('SETTLED', 'CANCELLED')`,
      isTransportUser ? [userId] : []
    ),
    query(
      `SELECT t.id, t.trip_date, t.total_freight, t.status, t.advance_paid,
              t.goods_weight, t.freight_rate,
              v.lorry_number, d.name as driver_name, p.name as party_name,
              r.from_location, r.to_location,
              u.name as unit_name, u.abbreviation as unit_abbreviation,
              COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0) as total_received,
              (t.total_freight - COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0)) as balance_due
       FROM trips t
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       JOIN parties p ON t.party_id = p.id
       JOIN routes r ON t.route_id = r.id
       LEFT JOIN units u ON t.unit_id = u.id
       ${isTransportUser ? 'WHERE t.created_by = $1' : ''}
       ORDER BY t.created_at DESC LIMIT 10`,
      isTransportUser ? [userId] : []
    ),
    // Total owner advance credit received by this manager
    query(
      `SELECT COALESCE(SUM(amount), 0) as total_credit,
              COUNT(*) as total_entries
       FROM owner_advances
       WHERE manager_id = $1`,
      [userId]
    ),
    // Total advances finalized/used from developed settlement statements by this manager
    query(
      `SELECT COALESCE(SUM(s.advance_paid), 0) as total_used
       FROM settlements s
       JOIN trips t ON s.trip_id = t.id
       WHERE t.created_by = $1`,
      [userId]
    ),
    // Per-owner breakdown of advances received by this manager
    query(
      `SELECT oa.id, oa.amount, oa.advance_date, oa.payment_mode, oa.notes,
              COALESCE(o.name, 'Owner') as owner_name
       FROM owner_advances oa
       LEFT JOIN owners o ON oa.owner_id = o.id
       WHERE oa.manager_id = $1
       ORDER BY oa.advance_date DESC, oa.created_at DESC`,
      [userId]
    ),
  ]);

  const ownerAdvanceBreakdown = advanceCreditResult.rows;

  res.json({
    success: true,
    message: 'Mobile dashboard data retrieved.',
    data: {
      trips_today: parseInt(todayTripsResult.rows[0].total),
      balance_due: parseFloat(balanceDueResult.rows[0].balance_due),
      recent_trips: recentTripsResult.rows,
      owner_advance_credit: parseFloat(advanceCreditSummaryResult.rows[0].total_credit),
      owner_advance_entries: parseInt(advanceCreditSummaryResult.rows[0].total_entries),
      truck_advance_used: parseFloat(truckAdvanceUsedResult.rows[0].total_used),
      manager_available_balance:
        parseFloat(advanceCreditSummaryResult.rows[0].total_credit) -
        parseFloat(truckAdvanceUsedResult.rows[0].total_used),
      owner_advance_breakdown: ownerAdvanceBreakdown,
    },
  });
});
