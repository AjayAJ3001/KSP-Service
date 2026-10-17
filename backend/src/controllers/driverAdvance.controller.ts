import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

// Helper to resolve advance date preserving local time
const resolveAdvanceDate = (dateVal?: string | Date | null): string => {
  if (!dateVal) return new Date().toISOString();
  if (dateVal instanceof Date) return dateVal.toISOString();
  const clean = String(dateVal).trim();
  if (!clean) return new Date().toISOString();

  // If format is YYYY-MM-DD
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
 * GET /driver-advances
 * Admin & Managers: Retrieve all driver advances with filters & pagination
 */
export const getDriverAdvances = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const trip_id = req.query.trip_id as string;
  const driver_id = req.query.driver_id as string;
  const manager_id = req.query.manager_id as string;
  const vehicle_id = req.query.vehicle_id as string;
  const payment_mode = req.query.payment_mode as string;
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;
  const search = (req.query.search as string || '').trim();

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (trip_id) {
    conditions.push(`da.trip_id = $${paramIdx}`);
    params.push(parseInt(trip_id));
    paramIdx++;
  }

  if (driver_id) {
    conditions.push(`da.driver_id = $${paramIdx}`);
    params.push(parseInt(driver_id));
    paramIdx++;
  }

  if (manager_id) {
    conditions.push(`da.manager_id = $${paramIdx}`);
    params.push(parseInt(manager_id));
    paramIdx++;
  }

  if (vehicle_id) {
    conditions.push(`da.vehicle_id = $${paramIdx}`);
    params.push(parseInt(vehicle_id));
    paramIdx++;
  }

  if (payment_mode) {
    conditions.push(`da.payment_mode = $${paramIdx}`);
    params.push(payment_mode);
    paramIdx++;
  }

  if (from_date) {
    conditions.push(`da.advance_date >= $${paramIdx}`);
    params.push(from_date);
    paramIdx++;
  }

  if (to_date) {
    conditions.push(`da.advance_date <= $${paramIdx}::date + interval '1 day'`);
    params.push(to_date);
    paramIdx++;
  }

  if (search) {
    conditions.push(
      `(d.name ILIKE $${paramIdx} OR d.mobile_number ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR v.lorry_number ILIKE $${paramIdx} OR da.notes ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx} OR da.trip_id::text ILIKE $${paramIdx})`
    );
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.join(' AND ');

  const baseCTE = `
    WITH all_driver_advances AS (
      SELECT 
        da.id,
        da.driver_id,
        da.manager_id,
        da.vehicle_id,
        da.trip_id,
        da.amount,
        da.advance_date,
        da.payment_mode,
        da.notes,
        da.created_by,
        da.created_at,
        da.updated_at,
        'DIRECT_DRIVER_ADVANCE' as source_type
      FROM driver_advances da

      UNION ALL

      SELECT 
        ta.id,
        ta.driver_id,
        ta.manager_id,
        ta.vehicle_id,
        ta.trip_id,
        ta.amount,
        ta.advance_date,
        'CASH' as payment_mode,
        ta.notes,
        ta.created_by,
        ta.created_at,
        ta.updated_at,
        'TRIP_TRUCK_ADVANCE' as source_type
      FROM truck_advances ta
      WHERE ta.driver_id IS NOT NULL
    )
  `;

  const countResult = await query(
    `${baseCTE}
     SELECT COUNT(*) as total_count, COALESCE(SUM(da.amount), 0) as total_amount
     FROM all_driver_advances da
     JOIN drivers d ON da.driver_id = d.id
     JOIN users u ON da.manager_id = u.id
     LEFT JOIN vehicles v ON da.vehicle_id = v.id
     LEFT JOIN trips tr ON da.trip_id = tr.id
     LEFT JOIN parties p ON tr.party_id = p.id
     WHERE ${where}`,
    params
  );

  const result = await query(
    `${baseCTE}
     SELECT da.*,
            d.name as driver_name,
            d.mobile_number as driver_mobile,
            d.license_number as driver_license,
            u.name as manager_name,
            u.email as manager_email,
            COALESCE(v.lorry_number, tr_v.lorry_number, d_lt_v.lorry_number) as lorry_number,
            COALESCE(v.vehicle_type, tr_v.vehicle_type, d_lt_v.vehicle_type) as vehicle_type,
            cb.name as created_by_name,
            -- Trip details for which the driver goes
            COALESCE(tr.id, d_lt.id) as trip_id,
            COALESCE(tr.trip_date, d_lt.trip_date) as trip_date,
            COALESCE(tr.status, d_lt.status) as trip_status,
            COALESCE(p.name, d_lt_p.name) as party_name,
            COALESCE(r.from_location, d_lt_r.from_location) as from_location,
            COALESCE(r.to_location, d_lt_r.to_location) as to_location,
            COALESCE(tr.goods_weight, d_lt.goods_weight) as goods_weight,
            COALESCE(tr.freight_rate, d_lt.freight_rate) as freight_rate,
            COALESCE(tr.total_freight, d_lt.total_freight) as total_freight,
            COALESCE(tr.advance_paid, d_lt.advance_paid) as trip_advance_paid,
            COALESCE(tr_u.name, d_lt_u.name) as unit_name,
            COALESCE(tr_u.abbreviation, d_lt_u.abbreviation) as unit_abbreviation,
            COALESCE(
              (SELECT s.total_expenses FROM settlements s WHERE s.trip_id = COALESCE(tr.id, d_lt.id)),
              (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = COALESCE(tr.id, d_lt.id)),
              0
            ) as trip_driver_expenses,
            -- Live Driver Balance in Hand
            (
              (
                COALESCE((SELECT SUM(da2.amount) FROM driver_advances da2 WHERE da2.driver_id = d.id), 0) +
                COALESCE((SELECT SUM(ta2.amount) FROM truck_advances ta2 WHERE ta2.driver_id = d.id), 0) +
                COALESCE((SELECT SUM(tr2.advance_paid) FROM trips tr2 WHERE tr2.driver_id = d.id AND tr2.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr2.id)), 0) +
                COALESCE((SELECT SUM(dsp2.amount) FROM driver_settlement_payments dsp2 JOIN settlements st2 ON dsp2.settlement_id = st2.id JOIN trips tr2 ON st2.trip_id = tr2.id WHERE tr2.driver_id = d.id), 0)
              ) -
              COALESCE((
                SELECT SUM(
                  COALESCE(s2.total_expenses, (
                    SELECT SUM(de2.amount) FROM driver_expenses de2 WHERE de2.trip_id = t2.id
                  ), 0)
                )
                FROM trips t2
                LEFT JOIN settlements s2 ON s2.trip_id = t2.id
                WHERE t2.driver_id = d.id AND t2.status NOT IN ('CANCELLED', 'DRAFT')
              ), 0)
            ) as driver_balance_in_hand
     FROM all_driver_advances da
     JOIN drivers d ON da.driver_id = d.id
     JOIN users u ON da.manager_id = u.id
     LEFT JOIN vehicles v ON da.vehicle_id = v.id
     LEFT JOIN users cb ON da.created_by = cb.id
     LEFT JOIN trips tr ON da.trip_id = tr.id
     LEFT JOIN vehicles tr_v ON tr.vehicle_id = tr_v.id
     LEFT JOIN parties p ON tr.party_id = p.id
     LEFT JOIN routes r ON tr.route_id = r.id
     LEFT JOIN units tr_u ON tr.unit_id = tr_u.id
     -- Fallback to driver's active or latest trip if advance is not explicitly bound to a trip
     LEFT JOIN LATERAL (
       SELECT t.* FROM trips t
       WHERE t.driver_id = da.driver_id AND t.status NOT IN ('CANCELLED', 'DRAFT')
       ORDER BY t.trip_date DESC, t.id DESC
       LIMIT 1
     ) d_lt ON da.trip_id IS NULL
     LEFT JOIN vehicles d_lt_v ON d_lt.vehicle_id = d_lt_v.id
     LEFT JOIN parties d_lt_p ON d_lt.party_id = d_lt_p.id
     LEFT JOIN routes d_lt_r ON d_lt.route_id = d_lt_r.id
     LEFT JOIN units d_lt_u ON d_lt.unit_id = d_lt_u.id
     WHERE ${where}
     ORDER BY da.advance_date DESC, da.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    message: 'Driver advances retrieved successfully.',
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
 * GET /driver-advances/summary
 * Master Ledger summary for all drivers:
 * - Which truck the driver is driving (lorry_number)
 * - Which trip the driver is going (active/latest trip_id, party, route, status)
 * - Total Advance Given to Driver
 * - Total Advance Applied / Deducted across Trips
 * - Live Balance in Hand Details (remaining_advance_balance / balance_in_hand)
 */
export const getDriverAdvancesSummary = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const driver_id = req.query.driver_id as string;
  const search = (req.query.search as string || '').trim();
  const showAll = req.query.all === 'true';

  let driverWhere = '1=1';
  let tripWhere = "t.status NOT IN ('CANCELLED', 'DRAFT')";
  const params: any[] = [];
  let paramIdx = 1;

  if (driver_id) {
    driverWhere += ` AND d.id = $${paramIdx}`;
    tripWhere += ` AND t.driver_id = $${paramIdx}`;
    params.push(parseInt(driver_id));
    paramIdx++;
  } else if (!showAll) {
    // Show drivers who have received an advance from the manager or have trips with advances/expenses
    driverWhere += ` AND (
      EXISTS (SELECT 1 FROM driver_advances da WHERE da.driver_id = d.id AND da.amount > 0)
      OR EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.driver_id = d.id AND ta.amount > 0)
      OR EXISTS (SELECT 1 FROM trips tr WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT') AND (tr.advance_paid > 0 OR EXISTS (SELECT 1 FROM driver_expenses de WHERE de.trip_id = tr.id)))
    )`;
  }

  let searchClause = '';
  if (search) {
    searchClause = ` AND (
      comb.driver_name ILIKE $${paramIdx}
      OR comb.driver_mobile ILIKE $${paramIdx}
      OR comb.driver_license ILIKE $${paramIdx}
      OR comb.lorry_number ILIKE $${paramIdx}
      OR comb.party_name ILIKE $${paramIdx}
      OR comb.trip_id::text ILIKE $${paramIdx}
      OR comb.from_location ILIKE $${paramIdx}
      OR comb.to_location ILIKE $${paramIdx}
    )`;
    params.push(`%${search}%`);
    paramIdx++;
  }

  const sql = `
    WITH trip_expenses_agg AS (
      SELECT 
        de.trip_id,
        COALESCE(SUM(de.amount), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN de.expense_type = 'LOADING' THEN de.amount ELSE 0 END), 0) as loading_expense,
        COALESCE(SUM(CASE WHEN de.expense_type = 'DRIVER_BATA' THEN de.amount ELSE 0 END), 0) as bata_expense,
        COALESCE(SUM(CASE WHEN de.expense_type = 'CLEANING_CHARGE' THEN de.amount ELSE 0 END), 0) as cleaning_expense,
        COALESCE(SUM(CASE WHEN de.expense_type NOT IN ('LOADING', 'DRIVER_BATA', 'CLEANING_CHARGE') THEN de.amount ELSE 0 END), 0) as other_expense
      FROM driver_expenses de
      GROUP BY de.trip_id
    ),
    driver_overall AS (
      SELECT 
        d.id as driver_id,
        (
          COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.driver_id = d.id), 0) +
          COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = d.id), 0) +
          COALESCE((SELECT SUM(tr.advance_paid) FROM trips tr WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr.id)), 0)
        ) -
        COALESCE((
          SELECT SUM(
            COALESCE(s.total_expenses, (
              SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = t.id
            ), 0)
          )
          FROM trips t
          LEFT JOIN settlements s ON s.trip_id = t.id
          WHERE t.driver_id = d.id AND t.status NOT IN ('CANCELLED', 'DRAFT')
        ), 0) as overall_balance_in_hand
      FROM drivers d
    ),
    trip_rows AS (
      SELECT 
        'TRIP_' || t.id::text as row_key,
        t.id as trip_id,
        t.trip_date,
        t.status as trip_status,
        t.driver_id,
        d.name as driver_name,
        d.mobile_number as driver_mobile,
        d.license_number as driver_license,
        d.status,
        v.lorry_number,
        v.vehicle_type,
        p.name as party_name,
        r.from_location,
        r.to_location,
        t.goods_weight,
        t.freight_rate,
        t.total_freight,
        u.name as unit_name,
        u.abbreviation as unit_abbreviation,
        COALESCE(
          (SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.trip_id = t.id),
          (SELECT SUM(da.amount) FROM driver_advances da WHERE da.trip_id = t.id),
          t.advance_paid,
          0
        ) as total_advance_given,
        (
          CASE WHEN COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.trip_id = t.id), (SELECT SUM(da.amount) FROM driver_advances da WHERE da.trip_id = t.id), t.advance_paid, 0) > 0 THEN 1 ELSE 0 END
        ) as advance_count,
        COALESCE(t.advance_paid, 0) as total_trip_advance_used,
        1 as trip_count,
        COALESCE(s.total_expenses, exp.total_expenses, 0) as total_expenses_reported,
        COALESCE(exp.loading_expense, 0) as loading_expense,
        COALESCE(exp.bata_expense, 0) as bata_expense,
        COALESCE(exp.cleaning_expense, 0) as cleaning_expense,
        COALESCE(exp.other_expense, 0) as other_expense,
        (
          COALESCE(
            (SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.trip_id = t.id),
            (SELECT SUM(da.amount) FROM driver_advances da WHERE da.trip_id = t.id),
            t.advance_paid,
            0
          ) -
          COALESCE(s.total_expenses, exp.total_expenses, 0)
        ) as trip_balance,
        (
          COALESCE(
            (SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.trip_id = t.id),
            (SELECT SUM(da.amount) FROM driver_advances da WHERE da.trip_id = t.id),
            t.advance_paid,
            0
          ) -
          COALESCE(s.total_expenses, exp.total_expenses, 0)
        ) as balance_in_hand,
        (
          COALESCE(
            (SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.trip_id = t.id),
            (SELECT SUM(da.amount) FROM driver_advances da WHERE da.trip_id = t.id),
            t.advance_paid,
            0
          ) -
          COALESCE(s.total_expenses, exp.total_expenses, 0)
        ) as remaining_advance_balance,
        COALESCE(d_ov.overall_balance_in_hand, 0) as overall_balance_in_hand,
        COALESCE(s.balance_to_driver, 0) as settlement_net_balance,
        s.id as settlement_id,
        s.settlement_status,
        CASE WHEN t.status NOT IN ('SETTLED', 'CANCELLED', 'DRAFT') THEN true ELSE false END as is_active_trip,
        t.created_at as sort_time
      FROM trips t
      JOIN drivers d ON t.driver_id = d.id
      JOIN vehicles v ON t.vehicle_id = v.id
      JOIN parties p ON t.party_id = p.id
      JOIN routes r ON t.route_id = r.id
      LEFT JOIN units u ON t.unit_id = u.id
      LEFT JOIN settlements s ON s.trip_id = t.id
      LEFT JOIN trip_expenses_agg exp ON exp.trip_id = t.id
      LEFT JOIN driver_overall d_ov ON d_ov.driver_id = d.id
      WHERE ${tripWhere}
    ),
    direct_advance_rows AS (
      SELECT 
        'DIRECT_' || da.id::text as row_key,
        NULL::integer as trip_id,
        da.advance_date as trip_date,
        'DIRECT_ADVANCE' as trip_status,
        da.driver_id,
        d.name as driver_name,
        d.mobile_number as driver_mobile,
        d.license_number as driver_license,
        d.status,
        COALESCE(v.lorry_number, 'Direct Advance') as lorry_number,
        v.vehicle_type,
        'Direct Advance (No Trip)' as party_name,
        NULL::varchar as from_location,
        NULL::varchar as to_location,
        NULL::numeric as goods_weight,
        NULL::numeric as freight_rate,
        0::numeric as total_freight,
        NULL::varchar as unit_name,
        NULL::varchar as unit_abbreviation,
        da.amount as total_advance_given,
        1 as advance_count,
        0::numeric as total_trip_advance_used,
        0 as trip_count,
        0::numeric as total_expenses_reported,
        0::numeric as loading_expense,
        0::numeric as bata_expense,
        0::numeric as cleaning_expense,
        0::numeric as other_expense,
        da.amount as trip_balance,
        da.amount as balance_in_hand,
        da.amount as remaining_advance_balance,
        COALESCE(d_ov.overall_balance_in_hand, 0) as overall_balance_in_hand,
        0::numeric as settlement_net_balance,
        NULL::integer as settlement_id,
        NULL::varchar as settlement_status,
        false as is_active_trip,
        da.created_at as sort_time
      FROM driver_advances da
      JOIN drivers d ON da.driver_id = d.id
      LEFT JOIN vehicles v ON da.vehicle_id = v.id
      LEFT JOIN driver_overall d_ov ON d_ov.driver_id = d.id
      WHERE da.trip_id IS NULL AND ${driverWhere}
    )
    SELECT * FROM (
      SELECT * FROM trip_rows
      UNION ALL
      SELECT * FROM direct_advance_rows
    ) comb
    WHERE 1=1 ${searchClause}
    ORDER BY comb.sort_time DESC
  `;

  const summaryResult = await query(sql, params);

  // Group rows by driver_id to compute running cumulative balance per driver chronologically
  const rowsByDriver = new Map<number, any[]>();
  for (const row of summaryResult.rows) {
    const dId = row.driver_id;
    if (!rowsByDriver.has(dId)) {
      rowsByDriver.set(dId, []);
    }
    rowsByDriver.get(dId)!.push(row);
  }

  // For each driver, sort events chronologically (oldest first) and compute running balance
  for (const [_, driverRows] of rowsByDriver) {
    driverRows.sort((a, b) => {
      const timeA = new Date(a.sort_time || a.trip_date || 0).getTime();
      const timeB = new Date(b.sort_time || b.trip_date || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (a.trip_id || 0) - (b.trip_id || 0);
    });

    let runningBal = 0;
    for (const row of driverRows) {
      const adv = parseFloat(row.total_advance_given || 0);
      const exp = parseFloat(row.total_expenses_reported || 0);
      const balBefore = Math.max(0, runningBal);
      row.previous_balance_in_hand = balBefore;
      const rawAfter = Math.round((runningBal + adv - exp) * 100) / 100;
      const clampedBal = Math.max(0, rawAfter);
      row.balance_in_hand = clampedBal;
      row.remaining_advance_balance = clampedBal;
      row.trip_balance = clampedBal;
      row.need_to_pay = rawAfter < 0 ? Math.abs(rawAfter) : 0;
      runningBal = Math.max(0, rawAfter);
    }
  }

  // Aggregate per-driver: produce one summary row per driver for the master table
  const driverSummaryMap = new Map<number, any>();
  for (const [driverId, driverRows] of rowsByDriver) {
    // driverRows are already sorted chronologically (oldest → newest)
    const sorted = driverRows;
    const latestRow = sorted[sorted.length - 1];

    // Identify trip rows (exclude direct-advance placeholder rows)
    const tripRows = sorted.filter((r: any) => r.trip_id != null);
    const activeTrip = tripRows.find((r: any) => r.is_active_trip);
    const latestTripRow = tripRows.length > 0 ? tripRows[tripRows.length - 1] : null;
    const representativeTrip = activeTrip || latestTripRow;

    // Sum totals across all events for this driver
    const totalAdvanceGiven   = sorted.reduce((s: number, r: any) => s + (parseFloat(r.total_advance_given) || 0), 0);
    const totalTripAdvUsed    = sorted.reduce((s: number, r: any) => s + (parseFloat(r.total_trip_advance_used) || 0), 0);
    const totalExpenses       = sorted.reduce((s: number, r: any) => s + (parseFloat(r.total_expenses_reported) || 0), 0);
    const totalAdvCount       = sorted.reduce((s: number, r: any) => s + (parseInt(r.advance_count) || 0), 0);
    const totalTripCount      = tripRows.length;
    const loadingExp          = sorted.reduce((s: number, r: any) => s + (parseFloat(r.loading_expense) || 0), 0);
    const bataExp             = sorted.reduce((s: number, r: any) => s + (parseFloat(r.bata_expense) || 0), 0);
    const cleaningExp         = sorted.reduce((s: number, r: any) => s + (parseFloat(r.cleaning_expense) || 0), 0);
    const otherExp            = sorted.reduce((s: number, r: any) => s + (parseFloat(r.other_expense) || 0), 0);
    const settlementNet       = sorted.reduce((s: number, r: any) => s + (parseFloat(r.settlement_net_balance) || 0), 0);

    // Final balance = cumulative balance after last event
    const finalBalance = parseFloat(latestRow.balance_in_hand) || 0;
    const finalNeedToPay = parseFloat(latestRow.need_to_pay) || 0;
    const finalPrevInHand = parseFloat(latestRow.previous_balance_in_hand) || 0;

    // Settlement status calculation across all trips for this driver:
    let driverSettlementStatus: 'SETTLED' | 'PENDING' | 'VERIFIED' | 'CASH_IN_HAND' = 'SETTLED';
    if (tripRows.length > 0) {
      const hasPending = tripRows.some((r: any) => r.settlement_status === 'PENDING' || (!r.settlement_status && r.trip_status !== 'CANCELLED'));
      const hasVerified = tripRows.some((r: any) => r.settlement_status === 'VERIFIED');
      const allSettled = tripRows.every((r: any) => r.settlement_status === 'SETTLED');

      if (hasPending) {
        driverSettlementStatus = 'PENDING';
      } else if (hasVerified) {
        driverSettlementStatus = 'VERIFIED';
      } else if (allSettled) {
        driverSettlementStatus = 'SETTLED';
      } else {
        driverSettlementStatus = finalBalance > 0 ? 'CASH_IN_HAND' : 'SETTLED';
      }
    } else {
      driverSettlementStatus = finalBalance > 0 ? 'CASH_IN_HAND' : 'SETTLED';
    }

    driverSummaryMap.set(driverId, {
      row_key: `DRIVER_${driverId}`,
      driver_id: driverId,
      driver_name: latestRow.driver_name,
      driver_mobile: latestRow.driver_mobile,
      driver_license: latestRow.driver_license,
      status: latestRow.status,
      settlement_status: driverSettlementStatus,
      latest_settlement_status: representativeTrip?.settlement_status ?? null,
      settlement_id: representativeTrip?.settlement_id ?? null,
      // Trip info: active trip takes priority; fall back to most recent trip
      trip_id: representativeTrip?.trip_id ?? null,
      trip_date: representativeTrip?.trip_date ?? null,
      trip_status: representativeTrip?.trip_status ?? null,
      lorry_number: representativeTrip?.lorry_number ?? latestRow.lorry_number ?? null,
      vehicle_type: representativeTrip?.vehicle_type ?? null,
      party_name: representativeTrip?.party_name ?? null,
      from_location: representativeTrip?.from_location ?? null,
      to_location: representativeTrip?.to_location ?? null,
      goods_weight: representativeTrip?.goods_weight ?? null,
      freight_rate: representativeTrip?.freight_rate ?? null,
      total_freight: representativeTrip?.total_freight ?? null,
      unit_name: representativeTrip?.unit_name ?? null,
      unit_abbreviation: representativeTrip?.unit_abbreviation ?? null,
      is_active_trip: !!activeTrip,
      // Aggregated financial totals
      total_advance_given:       Math.round(totalAdvanceGiven * 100) / 100,
      advance_count:             totalAdvCount,
      total_trip_advance_used:   Math.round(totalTripAdvUsed * 100) / 100,
      trip_count:                totalTripCount,
      total_expenses_reported:   Math.round(totalExpenses * 100) / 100,
      loading_expense:           Math.round(loadingExp * 100) / 100,
      bata_expense:              Math.round(bataExp * 100) / 100,
      cleaning_expense:          Math.round(cleaningExp * 100) / 100,
      other_expense:             Math.round(otherExp * 100) / 100,
      balance_in_hand:           finalBalance,
      need_to_pay:               finalNeedToPay,
      previous_balance_in_hand:  finalPrevInHand,
      remaining_advance_balance: finalBalance,
      trip_balance:              finalBalance,
      overall_balance_in_hand:   finalBalance,
      settlement_net_balance:    Math.round(settlementNet * 100) / 100,
    });
  }

  // One aggregated row per driver, sorted alphabetically by driver name
  const aggregatedDrivers = Array.from(driverSummaryMap.values()).sort((a, b) =>
    a.driver_name.localeCompare(b.driver_name)
  );

  const grandTotals = {
    total_advance_given: 0,
    total_trip_advance_used: 0,
    total_expenses_reported: 0,
    remaining_advance_balance: 0,
    balance_in_hand: 0,
    settlement_net_balance: 0,
  };

  for (const d of aggregatedDrivers) {
    grandTotals.total_advance_given    += d.total_advance_given;
    grandTotals.total_trip_advance_used += d.total_trip_advance_used;
    grandTotals.total_expenses_reported += d.total_expenses_reported;
    grandTotals.balance_in_hand        += d.balance_in_hand;
    grandTotals.settlement_net_balance += d.settlement_net_balance;
  }
  grandTotals.balance_in_hand        = Math.round(grandTotals.balance_in_hand * 100) / 100;
  grandTotals.remaining_advance_balance = grandTotals.balance_in_hand;

  res.json({
    success: true,
    message: 'Driver advances ledger summary retrieved.',
    data: {
      drivers: aggregatedDrivers,
      grand_totals: grandTotals,
    },
  });
});

/**
 * GET /driver-advances/:id
 * Retrieve single driver advance
 */
export const getDriverAdvanceById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const result = await query(
    `SELECT da.*,
            d.name as driver_name,
            d.mobile_number as driver_mobile,
            d.license_number as driver_license,
            u.name as manager_name,
            COALESCE(v.lorry_number, tr_v.lorry_number) as lorry_number,
            COALESCE(v.vehicle_type, tr_v.vehicle_type) as vehicle_type,
            tr.id as trip_id,
            tr.trip_date,
            tr.status as trip_status,
            p.name as party_name,
            r.from_location,
            r.to_location
     FROM driver_advances da
     JOIN drivers d ON da.driver_id = d.id
     JOIN users u ON da.manager_id = u.id
     LEFT JOIN vehicles v ON da.vehicle_id = v.id
     LEFT JOIN trips tr ON da.trip_id = tr.id
     LEFT JOIN vehicles tr_v ON tr.vehicle_id = tr_v.id
     LEFT JOIN parties p ON tr.party_id = p.id
     LEFT JOIN routes r ON tr.route_id = r.id
     WHERE da.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError('Driver advance record not found.', 404);
  }

  res.json({
    success: true,
    message: 'Driver advance retrieved.',
    data: result.rows[0],
  });
});

/**
 * POST /driver-advances
 * Manager or Admin gives an advance directly to a driver
 */
export const createDriverAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { driver_id, vehicle_id, trip_id, amount, advance_date, payment_mode, notes } = req.body;
  const managerId = req.user?.role === 'ADMIN' && req.body.manager_id ? parseInt(req.body.manager_id) : req.user?.id;

  if (!driver_id || amount === undefined || amount === null) {
    throw new AppError('Driver and Advance Amount are required.', 400);
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new AppError('Advance amount must be greater than 0.', 400);
  }

  // Verify driver exists and is active
  const driverCheck = await query(`SELECT id, name FROM drivers WHERE id = $1 AND status = 'ACTIVE'`, [driver_id]);
  if (driverCheck.rows.length === 0) {
    throw new AppError('Driver not found or inactive.', 404);
  }

  let resolvedVehicleId = vehicle_id ? parseInt(vehicle_id) : null;
  let resolvedTripId = trip_id ? parseInt(trip_id) : null;

  // Auto-resolve vehicle from trip if not explicitly provided
  if (resolvedTripId) {
    const tripCheck = await query(`SELECT id, vehicle_id FROM trips WHERE id = $1`, [resolvedTripId]);
    if (tripCheck.rows.length > 0 && !resolvedVehicleId && tripCheck.rows[0].vehicle_id) {
      resolvedVehicleId = tripCheck.rows[0].vehicle_id;
    }
  }

  // If vehicle_id is provided, verify it exists
  if (resolvedVehicleId) {
    const vehicleCheck = await query(`SELECT id, lorry_number FROM vehicles WHERE id = $1 AND status = 'ACTIVE'`, [resolvedVehicleId]);
    if (vehicleCheck.rows.length === 0) {
      throw new AppError('Vehicle not found or inactive.', 404);
    }
  }

  const resolvedDate = resolveAdvanceDate(advance_date);

  const result = await query(
    `INSERT INTO driver_advances (driver_id, manager_id, vehicle_id, trip_id, amount, advance_date, payment_mode, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::timestamp, $7, $8, $9)
     RETURNING *`,
    [
      driver_id,
      managerId,
      resolvedVehicleId,
      resolvedTripId,
      numAmount,
      resolvedDate,
      payment_mode || 'CASH',
      notes?.trim() || null,
      req.user?.id,
    ]
  );

  const enriched = await query(
    `SELECT da.*,
            d.name as driver_name,
            d.mobile_number as driver_mobile,
            u.name as manager_name,
            COALESCE(v.lorry_number, tr_v.lorry_number) as lorry_number,
            tr.id as trip_id,
            tr.trip_date,
            p.name as party_name,
            r.from_location,
            r.to_location
     FROM driver_advances da
     JOIN drivers d ON da.driver_id = d.id
     JOIN users u ON da.manager_id = u.id
     LEFT JOIN vehicles v ON da.vehicle_id = v.id
     LEFT JOIN trips tr ON da.trip_id = tr.id
     LEFT JOIN vehicles tr_v ON tr.vehicle_id = tr_v.id
     LEFT JOIN parties p ON tr.party_id = p.id
     LEFT JOIN routes r ON tr.route_id = r.id
     WHERE da.id = $1`,
    [result.rows[0].id]
  );

  await createAuditLog(req.user?.id, 'CREATE_DRIVER_ADVANCE', 'DRIVER_ADVANCES', result.rows[0].id, {
    driver_id,
    manager_id: managerId,
    vehicle_id: resolvedVehicleId,
    trip_id: resolvedTripId,
    amount: numAmount,
  });

  res.status(201).json({
    success: true,
    message: 'Driver advance recorded successfully.',
    data: enriched.rows[0],
  });
});

/**
 * PUT /driver-advances/:id
 * Update driver advance record
 */
export const updateDriverAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { driver_id, vehicle_id, trip_id, amount, advance_date, payment_mode, notes } = req.body;

  const existing = await query('SELECT * FROM driver_advances WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    throw new AppError('Driver advance record not found.', 404);
  }

  const numAmount = amount !== undefined ? parseFloat(amount) : existing.rows[0].amount;
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new AppError('Advance amount must be greater than 0.', 400);
  }

  let resolvedVehicleId = vehicle_id !== undefined ? (vehicle_id ? parseInt(vehicle_id) : null) : existing.rows[0].vehicle_id;
  let resolvedTripId = trip_id !== undefined ? (trip_id ? parseInt(trip_id) : null) : existing.rows[0].trip_id;

  if (resolvedTripId && !resolvedVehicleId) {
    const tripCheck = await query(`SELECT id, vehicle_id FROM trips WHERE id = $1`, [resolvedTripId]);
    if (tripCheck.rows.length > 0 && tripCheck.rows[0].vehicle_id) {
      resolvedVehicleId = tripCheck.rows[0].vehicle_id;
    }
  }

  const resolvedDate = advance_date ? resolveAdvanceDate(advance_date) : existing.rows[0].advance_date;

  const result = await query(
    `UPDATE driver_advances
     SET driver_id = COALESCE($1, driver_id),
         vehicle_id = $2,
         trip_id = $3,
         amount = $4,
         advance_date = $5::timestamp,
         payment_mode = COALESCE($6, payment_mode),
         notes = $7,
         updated_at = NOW()
     WHERE id = $8
     RETURNING *`,
    [
      driver_id || existing.rows[0].driver_id,
      resolvedVehicleId,
      resolvedTripId,
      numAmount,
      resolvedDate,
      payment_mode || existing.rows[0].payment_mode,
      notes !== undefined ? (notes?.trim() || null) : existing.rows[0].notes,
      id,
    ]
  );

  const enriched = await query(
    `SELECT da.*,
            d.name as driver_name,
            d.mobile_number as driver_mobile,
            u.name as manager_name,
            COALESCE(v.lorry_number, tr_v.lorry_number) as lorry_number,
            tr.id as trip_id,
            tr.trip_date,
            p.name as party_name,
            r.from_location,
            r.to_location
     FROM driver_advances da
     JOIN drivers d ON da.driver_id = d.id
     JOIN users u ON da.manager_id = u.id
     LEFT JOIN vehicles v ON da.vehicle_id = v.id
     LEFT JOIN trips tr ON da.trip_id = tr.id
     LEFT JOIN vehicles tr_v ON tr.vehicle_id = tr_v.id
     LEFT JOIN parties p ON tr.party_id = p.id
     LEFT JOIN routes r ON tr.route_id = r.id
     WHERE da.id = $1`,
    [id]
  );

  await createAuditLog(req.user?.id, 'UPDATE_DRIVER_ADVANCE', 'DRIVER_ADVANCES', id, {
    old: existing.rows[0],
    new: result.rows[0],
  });

  res.json({
    success: true,
    message: 'Driver advance updated successfully.',
    data: enriched.rows[0] || result.rows[0],
  });
});

/**
 * DELETE /driver-advances/:id
 * Delete driver advance record
 */
export const deleteDriverAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const existing = await query('SELECT id, driver_id, amount FROM driver_advances WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    throw new AppError('Driver advance record not found.', 404);
  }

  await query('DELETE FROM driver_advances WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_DRIVER_ADVANCE', 'DRIVER_ADVANCES', id, existing.rows[0]);

  res.json({
    success: true,
    message: 'Driver advance deleted successfully.',
  });
});
