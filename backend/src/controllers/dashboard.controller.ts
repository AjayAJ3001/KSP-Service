import { Response } from 'express';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { isFleetScoped, isLinkedManager } from '../utils/ownerScope';

export const getDashboard = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];
  const ownerFleet = isFleetScoped(req);
  const vids = req.user?.vehicleIds?.length ? req.user.vehicleIds : [0];
  const tripScope = ownerFleet ? 'AND t.vehicle_id = ANY($2::int[])' : '';
  const tripScope1 = ownerFleet ? 'AND t.vehicle_id = ANY($1::int[])' : '';
  const vehScope = ownerFleet ? 'AND id = ANY($1::int[])' : '';
  const tripParams1 = ownerFleet ? [vids] : [];
  const tripParamsToday = ownerFleet ? [today, vids] : [today];

  const [
    usersResult, driversResult, vehiclesResult, partiesResult,
    todayTripsResult, pendingPaymentsResult, settledTripsResult,
    pendingSettlementsResult, recentTripsResult, totalFreightResult,
    complianceAlertsResult
  ] = await Promise.all([
    ownerFleet
      ? query(`SELECT 0 as total, 0 as active`)
      : query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'ACTIVE') as active FROM users`),
    ownerFleet
      ? query(
          `SELECT COUNT(DISTINCT t.driver_id) as total FROM trips t
           WHERE t.status NOT IN ('CANCELLED', 'DRAFT') AND t.vehicle_id = ANY($1::int[])`,
          [vids]
        )
      : query(`SELECT COUNT(*) as total FROM drivers WHERE status = 'ACTIVE'`),
    query(
      `SELECT COUNT(*) as total FROM vehicles WHERE status = 'ACTIVE' ${vehScope}`,
      tripParams1
    ),
    ownerFleet
      ? query(
          `SELECT COUNT(DISTINCT t.party_id) as total FROM trips t
           WHERE t.status NOT IN ('CANCELLED', 'DRAFT') AND t.vehicle_id = ANY($1::int[])`,
          [vids]
        )
      : query(`SELECT COUNT(*) as total FROM parties WHERE status = 'ACTIVE'`),
    query(
      `SELECT COUNT(*) as total FROM trips t WHERE t.trip_date = $1 AND t.status != 'DRAFT' ${tripScope}`,
      tripParamsToday
    ),
    query(
      `SELECT COUNT(*) as total FROM trips t WHERE t.status IN ('PAYMENT_PENDING', 'PARTIALLY_PAID') ${tripScope1}`,
      tripParams1
    ),
    query(
      `SELECT COUNT(*) as total FROM trips t WHERE t.status = 'SETTLED' ${tripScope1}`,
      tripParams1
    ),
    query(
      `SELECT COUNT(*) as total FROM settlements s
       JOIN trips t ON s.trip_id = t.id
       WHERE s.settlement_status = 'PENDING' ${tripScope1}`,
      tripParams1
    ),
    query(
      `SELECT t.id, t.trip_date, t.total_freight, t.status, t.advance_paid,
              t.goods_weight, t.freight_rate,
              v.lorry_number, d.name as driver_name, p.name as party_name,
              r.from_location, r.to_location,
              u.name as unit_name, u.abbreviation as unit_abbreviation,
              COALESCE(pay.total_received, 0) as total_received,
              (t.total_freight - COALESCE(pay.total_received, 0)) as balance_due
       FROM trips t
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       JOIN parties p ON t.party_id = p.id
       JOIN routes r ON t.route_id = r.id
       LEFT JOIN units u ON t.unit_id = u.id
       LEFT JOIN (
         SELECT trip_id, SUM(received_amount) as total_received
         FROM trip_payments
         GROUP BY trip_id
       ) pay ON pay.trip_id = t.id
       WHERE t.status != 'DRAFT' ${tripScope1}
        ORDER BY t.created_at DESC LIMIT 10`,
      tripParams1
    ),
    query(
      `SELECT COALESCE(SUM(t.total_freight), 0) as total_freight,
              COALESCE(SUM(tp.received), 0) as total_received,
              COALESCE(SUM(t.total_freight) - SUM(tp.received), 0) as total_balance
       FROM trips t
       LEFT JOIN (SELECT trip_id, SUM(received_amount) as received FROM trip_payments GROUP BY trip_id) tp
       ON t.id = tp.trip_id
       WHERE t.status NOT IN ('CANCELLED', 'DRAFT') ${tripScope1}`,
      tripParams1
    ),
    query(
      `SELECT lorry_number,
              fc_expiry_date, insurance_expiry_date, permit_expiry_date, tax_expiry_date
       FROM vehicles
       WHERE status = 'ACTIVE' ${vehScope}
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
       ) ASC`,
      tripParams1
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
  const isNonAdmin = req.user?.role !== 'ADMIN' && req.user?.role !== 'OWNER';
  const isOwner = req.user?.role === 'OWNER';
  const linked = isLinkedManager(req);
  const managerOnly = isNonAdmin && !linked;
  const fleet = isOwner || linked;
  const vids = req.user?.vehicleIds?.length ? req.user.vehicleIds : [0];
  const oids = req.user?.ownerIds?.length ? req.user.ownerIds : [0];
  const fleetParams = [userId, oids, vids];
  const tripCountSql = managerOnly
    ? `SELECT COUNT(*) as total FROM trips WHERE created_by = $1 AND trip_date = $2`
    : fleet
      ? `SELECT COUNT(*) as total FROM trips WHERE trip_date = $1 AND vehicle_id = ANY($2::int[])`
      : `SELECT COUNT(*) as total FROM trips WHERE trip_date = $1`;
  const tripCountParams = managerOnly ? [userId, today] : fleet ? [today, vids] : [today];
  const recentTripFilter = managerOnly
    ? 'AND t.created_by = $1'
    : fleet
      ? 'AND t.vehicle_id = ANY($1::int[])'
      : '';
  const recentTripParams = managerOnly ? [userId] : fleet ? [vids] : [];
  const daFilter = managerOnly
    ? 'da.manager_id = $1'
    : fleet
      ? `(da.manager_id = $1 OR EXISTS (SELECT 1 FROM vehicles dav WHERE dav.id = da.vehicle_id AND dav.owner_id = ANY($2::int[])))`
      : '1=1';
  const taFilter = managerOnly
    ? 'AND ta.manager_id = $1'
    : fleet
      ? 'AND (ta.manager_id = $1 OR ta.vehicle_id = ANY($3::int[]))'
      : '';
  const tripAdvFilter = managerOnly
    ? 'AND tr.created_by = $1'
    : fleet
      ? 'AND tr.vehicle_id = ANY($3::int[])'
      : '';
  const oaFilter = managerOnly
    ? `AND (
         EXISTS (SELECT 1 FROM driver_advances x WHERE x.driver_id = oa.driver_id AND x.manager_id = $1)
         OR EXISTS (SELECT 1 FROM truck_advances x WHERE x.driver_id = oa.driver_id AND x.manager_id = $1)
         OR EXISTS (
           SELECT 1 FROM trips x
           WHERE x.driver_id = oa.driver_id
             AND x.created_by = $1
             AND x.status NOT IN ('CANCELLED', 'DRAFT')
         )
       )`
    : fleet
      ? 'AND oa.owner_id = ANY($2::int[])'
      : '';
  const expenseFilter = managerOnly
    ? `AND (
                 t.created_by = $1
                 OR EXISTS (SELECT 1 FROM manager_driver_advances mda WHERE mda.trip_id = t.id)
               )`
    : fleet
      ? 'AND t.vehicle_id = ANY($3::int[])'
      : '';
  const driverExists = managerOnly
    ? `AND EXISTS (SELECT 1 FROM manager_driver_advances mda WHERE mda.driver_id = d.id)`
    : '';
  const balanceParams = managerOnly ? [userId] : fleet ? fleetParams : [userId];

  const [todayTripsResult, balanceDueResult, recentTripsResult, advanceCreditSummaryResult, truckAdvanceUsedResult, advanceCreditResult, driverBalancesResult] = await Promise.all([
    query(tripCountSql, tripCountParams),
    query(
      isNonAdmin
        ? `SELECT 0::numeric as balance_due`
        : `SELECT COALESCE(SUM(t.total_freight - COALESCE(tp.received, 0)), 0) as balance_due
           FROM trips t
           LEFT JOIN (SELECT trip_id, SUM(received_amount) as received FROM trip_payments GROUP BY trip_id) tp
           ON t.id = tp.trip_id
           WHERE t.status NOT IN ('SETTLED', 'CANCELLED')
             ${isOwner ? 'AND t.vehicle_id = ANY($1::int[])' : ''}`,
      isOwner ? [vids] : []
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
       WHERE t.status != 'DRAFT' ${recentTripFilter}
       ORDER BY t.created_at DESC LIMIT 10`,
      recentTripParams
    ),
    // Total owner advance credit received by this manager
    query(
      `SELECT COALESCE(SUM(amount), 0) as total_credit,
              COUNT(*) as total_entries
       FROM owner_advances
       WHERE manager_id = $1`,
      [userId]
    ),
    // Total advances given to trucks/drivers by this manager
    query(
      `SELECT (
         COALESCE((SELECT SUM(amount) FROM truck_advances WHERE manager_id = $1), 0) +
         COALESCE((SELECT SUM(amount) FROM driver_advances WHERE manager_id = $1), 0)
       ) as total_used`,
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
    // Per-driver advance balance for this manager:
    // balance_in_manager_hand = total advance given + total settled cash paid - total driver expenses
    // Positive: manager still has money in hand (expenses were less than advance)
    // Negative: expenses exceeded advance -> manager/office needs to pay balance amount to driver
    query(
      `WITH manager_driver_advances AS (
         SELECT da.driver_id, da.amount, da.trip_id
         FROM driver_advances da
         WHERE ${daFilter}

         UNION ALL

         SELECT ta.driver_id, ta.amount, ta.trip_id
         FROM truck_advances ta
         WHERE ta.driver_id IS NOT NULL ${taFilter}

         UNION ALL

         SELECT tr.driver_id, COALESCE(tr.advance_paid, 0) as amount, tr.id as trip_id
         FROM trips tr
         WHERE tr.driver_id IS NOT NULL 
           AND tr.status NOT IN ('CANCELLED', 'DRAFT')
           ${managerOnly ? '' : 'AND tr.advance_paid > 0'}
           AND NOT EXISTS (SELECT 1 FROM truck_advances ta2 WHERE ta2.trip_id = tr.id)
           AND NOT EXISTS (SELECT 1 FROM driver_advances da2 WHERE da2.trip_id = tr.id)
           ${tripAdvFilter}

         UNION ALL

         SELECT oa.driver_id, oa.amount, NULL::integer as trip_id
         FROM owner_advances oa
         WHERE oa.driver_id IS NOT NULL
           ${oaFilter}
       ),
       driver_totals AS (
         SELECT
           d.id as driver_id,
           d.name as driver_name,
           d.mobile_number as driver_mobile,
           COALESCE((
             SELECT SUM(mda.amount)
             FROM manager_driver_advances mda
             WHERE mda.driver_id = d.id
           ), 0) as total_advance_given,
           COALESCE((
             SELECT SUM(
               COALESCE(s.total_expenses, (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = t.id), 0)
             )
             FROM trips t
             LEFT JOIN settlements s ON s.trip_id = t.id
             WHERE t.driver_id = d.id
               AND t.status NOT IN ('CANCELLED', 'DRAFT')
               ${expenseFilter}
           ), 0) as total_expenses,
           COALESCE((
             SELECT SUM(dsp.amount)
             FROM driver_settlement_payments dsp
             JOIN settlements s ON dsp.settlement_id = s.id
             JOIN trips t ON s.trip_id = t.id
             WHERE t.driver_id = d.id
               AND dsp.payment_mode != 'ADJUSTED_ADVANCE'
               ${expenseFilter}
           ), 0) as total_settled_cash_paid
         FROM drivers d
         WHERE d.status = 'ACTIVE'
           ${driverExists}
       )
       SELECT
         driver_id,
         driver_name,
         driver_mobile,
         total_advance_given,
         total_expenses,
         total_settled_cash_paid,
         (total_advance_given + total_settled_cash_paid - total_expenses) as balance_in_manager_hand
       FROM driver_totals
       ${isNonAdmin ? `WHERE (
         total_advance_given > 0
         OR total_expenses > 0
         OR EXISTS (SELECT 1 FROM manager_driver_advances mda WHERE mda.driver_id = driver_totals.driver_id)
       )` : ''}
       ORDER BY 
         CASE WHEN (total_advance_given > 0 OR total_expenses > 0) THEN 0 ELSE 1 END,
         driver_name ASC`,
      balanceParams
    ),
  ]);

  const ownerAdvanceBreakdown = advanceCreditResult.rows;
  const driverBalances = driverBalancesResult.rows.map((r: any) => ({
    driver_id: parseInt(r.driver_id),
    driver_name: r.driver_name,
    driver_mobile: r.driver_mobile,
    total_advance_given: parseFloat(r.total_advance_given),
    total_expenses: parseFloat(r.total_expenses),
    balance_in_manager_hand: parseFloat(r.balance_in_manager_hand),
  }));

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
      driver_advance_balances: driverBalances,
    },
  });
});
