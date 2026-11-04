import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';
import { applyOwnerScope, assertOwnerOwner, assertOwnerVehicle, assertTripInOwnerScope, hasFleetWideAccess, isFleetScoped, isLinkedManager, isOwnerUser } from '../utils/ownerScope';
import { reconcileDriverPendingSettlements } from './settlement.controller';

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
  const owner_id = req.query.owner_id as string;
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
    conditions.push(`(
      da.vehicle_id = $${paramIdx}
      OR tr.vehicle_id = $${paramIdx}
      OR (da.trip_id IS NULL AND d_lt.vehicle_id = $${paramIdx})
    )`);
    params.push(parseInt(vehicle_id));
    paramIdx++;
  }

  if (owner_id) {
    conditions.push(`(
      v.owner_id = $${paramIdx}
      OR tr_v.owner_id = $${paramIdx}
      OR (da.trip_id IS NULL AND d_lt_v.owner_id = $${paramIdx})
    )`);
    params.push(parseInt(owner_id));
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
      `(d.name ILIKE $${paramIdx} OR d.mobile_number ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR v.lorry_number ILIKE $${paramIdx} OR o.name ILIKE $${paramIdx} OR da.notes ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx} OR da.trip_id::text ILIKE $${paramIdx})`
    );
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (isLinkedManager(req) && req.user?.id) {
    conditions.push(`(
      da.manager_id = $${paramIdx}
      OR (
        da.given_by_role = 'OWNER'
        AND COALESCE(da.direct_owner_id, v.owner_id, tr_v.owner_id, d_lt_v.owner_id) = ANY($${paramIdx + 1}::int[])
      )
      OR COALESCE(v.owner_id, tr_v.owner_id, d_lt_v.owner_id) = ANY($${paramIdx + 1}::int[])
    )`);
    params.push(req.user.id);
    params.push(req.user.ownerIds?.length ? req.user.ownerIds : [0]);
    paramIdx += 2;
  } else {
    paramIdx = applyOwnerScope(
      req,
      conditions,
      params,
      paramIdx,
      'COALESCE(da.direct_owner_id, v.owner_id, tr_v.owner_id, d_lt_v.owner_id)'
    );

    if (!hasFleetWideAccess(req) && req.user?.id && !manager_id) {
      conditions.push(`(da.given_by_role = 'OWNER' OR da.manager_id = $${paramIdx})`);
      params.push(req.user.id);
      paramIdx++;
    }
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
        'DIRECT_DRIVER_ADVANCE' as source_type,
        'MANAGER' as given_by_role,
        NULL::integer as direct_owner_id
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
        'TRIP_TRUCK_ADVANCE' as source_type,
        'MANAGER' as given_by_role,
        NULL::integer as direct_owner_id
      FROM truck_advances ta
      WHERE ta.driver_id IS NOT NULL

      UNION ALL

      SELECT 
        oa.id,
        oa.driver_id,
        oa.manager_id,
        oa.vehicle_id,
        NULL as trip_id,
        oa.amount,
        oa.advance_date,
        oa.payment_mode,
        oa.notes,
        oa.created_by,
        oa.created_at,
        oa.updated_at,
        'OWNER_DIRECT_ADVANCE' as source_type,
        'OWNER' as given_by_role,
        oa.owner_id as direct_owner_id
      FROM owner_advances oa
      WHERE oa.driver_id IS NOT NULL
    )
  `;

  const countResult = await query(
    `${baseCTE}
     SELECT COUNT(*) as total_count, COALESCE(SUM(da.amount), 0) as total_amount
     FROM all_driver_advances da
     JOIN drivers d ON da.driver_id = d.id
     LEFT JOIN users u ON da.manager_id = u.id
     LEFT JOIN vehicles v ON da.vehicle_id = v.id
     LEFT JOIN trips tr ON da.trip_id = tr.id
     LEFT JOIN vehicles tr_v ON tr.vehicle_id = tr_v.id
     LEFT JOIN parties p ON tr.party_id = p.id
     LEFT JOIN LATERAL (
       SELECT t.* FROM trips t
       WHERE t.driver_id = da.driver_id AND t.status NOT IN ('CANCELLED', 'DRAFT')
       ORDER BY t.trip_date DESC, t.id DESC
       LIMIT 1
     ) d_lt ON da.trip_id IS NULL
     LEFT JOIN vehicles d_lt_v ON d_lt.vehicle_id = d_lt_v.id
     LEFT JOIN owners o ON COALESCE(da.direct_owner_id, v.owner_id, tr_v.owner_id, d_lt_v.owner_id) = o.id
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
            COALESCE(v.owner_id, tr_v.owner_id, d_lt_v.owner_id) as owner_id,
            o.name as owner_name,
            o.mobile_number as owner_mobile,
            cb.name as created_by_name,
            CASE WHEN da.given_by_role = 'OWNER' THEN 'Owner: ' || COALESCE(giver_o.name, o.name, 'Owner') ELSE 'Manager: ' || COALESCE(u.name, 'Manager') END as given_by,
            CASE WHEN da.given_by_role = 'OWNER' THEN COALESCE(giver_o.name, o.name, 'Owner') ELSE COALESCE(u.name, 'Manager') END as given_by_name,
            CASE WHEN da.trip_id IS NOT NULL THEN false ELSE true END as is_without_trip,
            CASE 
              WHEN da.trip_id IS NOT NULL THEN 'Trip #' || da.trip_id || ' Advance'
              ELSE 'Without Trip · ' || COALESCE(da.notes, 'Direct Advance')
            END as given_for,
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
            COALESCE(
              (SELECT s.advance_paid FROM settlements s WHERE s.trip_id = COALESCE(tr.id, d_lt.id)),
              tr.advance_paid,
              d_lt.advance_paid
            ) as trip_advance_paid,
            COALESCE(tr.advance_paid, d_lt.advance_paid) as initial_trip_advance,
            GREATEST(0, COALESCE((SELECT s.advance_paid FROM settlements s WHERE s.trip_id = COALESCE(tr.id, d_lt.id)), tr.advance_paid, d_lt.advance_paid, 0) - COALESCE(tr.advance_paid, d_lt.advance_paid, 0)) as additional_advance_paid,
            (SELECT s.id FROM settlements s WHERE s.trip_id = COALESCE(tr.id, d_lt.id)) as settlement_id,
            (SELECT s.settlement_status FROM settlements s WHERE s.trip_id = COALESCE(tr.id, d_lt.id)) as settlement_status,
            (SELECT s.payment_mode FROM settlements s WHERE s.trip_id = COALESCE(tr.id, d_lt.id)) as settlement_payment_mode,
            (SELECT s.paid_amount FROM settlements s WHERE s.trip_id = COALESCE(tr.id, d_lt.id)) as settlement_paid_amount,
            (SELECT s.balance_to_driver FROM settlements s WHERE s.trip_id = COALESCE(tr.id, d_lt.id)) as balance_to_driver,
            (SELECT s.net_balance_to_driver FROM settlements s WHERE s.trip_id = COALESCE(tr.id, d_lt.id)) as net_balance_to_driver,
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
                COALESCE((
                  SELECT SUM(da2.amount) FROM driver_advances da2
                  WHERE da2.driver_id = d.id
                    AND (da2.trip_id IS NULL OR NOT EXISTS (SELECT 1 FROM truck_advances ta_x WHERE ta_x.trip_id = da2.trip_id))
                ), 0) +
                COALESCE((SELECT SUM(oa2.amount) FROM owner_advances oa2 WHERE oa2.driver_id = d.id), 0) +
                COALESCE((SELECT SUM(ta2.amount) FROM truck_advances ta2 WHERE ta2.driver_id = d.id), 0) +
                COALESCE((SELECT SUM(tr2.advance_paid) FROM trips tr2 WHERE tr2.driver_id = d.id AND tr2.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr2.id) AND NOT EXISTS (SELECT 1 FROM driver_advances da3 WHERE da3.trip_id = tr2.id)), 0) +
                COALESCE((SELECT SUM(dsp2.amount) FROM driver_settlement_payments dsp2 JOIN settlements st2 ON dsp2.settlement_id = st2.id JOIN trips tr2 ON st2.trip_id = tr2.id WHERE tr2.driver_id = d.id AND dsp2.payment_mode != 'ADJUSTED_ADVANCE'), 0)
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
     LEFT JOIN users u ON da.manager_id = u.id
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
     LEFT JOIN owners o ON COALESCE(v.owner_id, tr_v.owner_id, d_lt_v.owner_id) = o.id
     LEFT JOIN owners giver_o ON giver_o.id = da.direct_owner_id
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
  const owner_id = req.query.owner_id as string;
  const vehicle_id = req.query.vehicle_id as string;
  const search = (req.query.search as string || '').trim();
  const showAll = req.query.all === 'true';

  let driverWhere = '1=1';
  let tripWhere = "t.status NOT IN ('CANCELLED', 'DRAFT')";
  let directAdvanceWhere = '1=1';
  const params: any[] = [];
  let paramIdx = 1;

  if (driver_id) {
    driverWhere += ` AND d.id = $${paramIdx}`;
    tripWhere += ` AND t.driver_id = $${paramIdx}`;
    params.push(parseInt(driver_id));
    paramIdx++;
  } else if (!showAll) {
    driverWhere += ` AND (
      EXISTS (SELECT 1 FROM trips tr WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT'))
      OR EXISTS (SELECT 1 FROM driver_advances da0 WHERE da0.driver_id = d.id)
      OR EXISTS (SELECT 1 FROM owner_advances oa0 WHERE oa0.driver_id = d.id)
      OR EXISTS (SELECT 1 FROM truck_advances ta0 WHERE ta0.driver_id = d.id)
    )`;
  }

  if (isLinkedManager(req) && req.user?.id) {
    const mgrIdx = paramIdx;
    const ownIdx = paramIdx + 1;
    driverWhere += ` AND (
      EXISTS (SELECT 1 FROM driver_advances da0 WHERE da0.driver_id = d.id AND da0.manager_id = $${mgrIdx})
      OR EXISTS (SELECT 1 FROM truck_advances ta0 WHERE ta0.driver_id = d.id AND ta0.manager_id = $${mgrIdx})
      OR EXISTS (
        SELECT 1 FROM trips tr0
        JOIN vehicles vv0 ON tr0.vehicle_id = vv0.id
        WHERE tr0.driver_id = d.id
          AND tr0.status NOT IN ('CANCELLED', 'DRAFT')
          AND vv0.owner_id = ANY($${ownIdx}::int[])
      )
      OR EXISTS (
        SELECT 1 FROM owner_advances oa0
        WHERE oa0.driver_id = d.id AND oa0.owner_id = ANY($${ownIdx}::int[])
      )
    )`;
    params.push(req.user.id);
    params.push(req.user.ownerIds?.length ? req.user.ownerIds : [0]);
    paramIdx += 2;
  } else if (!hasFleetWideAccess(req) && req.user?.id) {
    driverWhere += ` AND (
      EXISTS (SELECT 1 FROM driver_advances da0 WHERE da0.driver_id = d.id AND da0.manager_id = $${paramIdx})
      OR EXISTS (SELECT 1 FROM truck_advances ta0 WHERE ta0.driver_id = d.id AND ta0.manager_id = $${paramIdx})
      OR EXISTS (SELECT 1 FROM trips tr0 WHERE tr0.driver_id = d.id AND tr0.created_by = $${paramIdx} AND tr0.status NOT IN ('CANCELLED', 'DRAFT'))
    )`;
    params.push(req.user.id);
    paramIdx++;
  }

  let vehicleParamIdx: number | null = null;
  let ownerParamIdx: number | null = null;

  if (vehicle_id) {
    vehicleParamIdx = paramIdx;
    tripWhere += ` AND t.vehicle_id = $${paramIdx}`;
    directAdvanceWhere += ` AND (
      da.vehicle_id = $${paramIdx}
      OR EXISTS (
        SELECT 1 FROM trips t3
        WHERE t3.driver_id = da.driver_id
          AND t3.vehicle_id = $${paramIdx}
          AND t3.status NOT IN ('CANCELLED', 'DRAFT')
      )
    )`;
    params.push(parseInt(vehicle_id));
    paramIdx++;
  }

  if (vehicle_id) assertOwnerVehicle(req, vehicle_id);
  if (owner_id) assertOwnerOwner(req, owner_id);

  if (isFleetScoped(req) && !owner_id) {
    ownerParamIdx = paramIdx;
    tripWhere += ` AND v.owner_id = ANY($${paramIdx}::int[])`;
    directAdvanceWhere += ` AND (
      v.owner_id = ANY($${paramIdx}::int[])
      OR EXISTS (
        SELECT 1 FROM trips t2
        JOIN vehicles v2 ON t2.vehicle_id = v2.id
        WHERE t2.driver_id = da.driver_id
          AND v2.owner_id = ANY($${paramIdx}::int[])
          AND t2.status NOT IN ('CANCELLED', 'DRAFT')
      )
    )`;
    params.push(req.user?.ownerIds?.length ? req.user.ownerIds : [0]);
    paramIdx++;
  }

  if (owner_id) {
    ownerParamIdx = paramIdx;
    tripWhere += ` AND v.owner_id = $${paramIdx}`;
    // For direct advances: match by direct vehicle owner OR by any trip vehicle owner for this driver
    directAdvanceWhere += ` AND (
      v.owner_id = $${paramIdx}
      OR EXISTS (
        SELECT 1 FROM trips t2
        JOIN vehicles v2 ON t2.vehicle_id = v2.id
        WHERE t2.driver_id = da.driver_id
          AND v2.owner_id = $${paramIdx}
          AND t2.status NOT IN ('CANCELLED', 'DRAFT')
      )
    )`;
    params.push(parseInt(owner_id));
    paramIdx++;
  }

  let ownerDirectAdvanceWhere = '1=1';
  if (vehicleParamIdx) {
    ownerDirectAdvanceWhere += ` AND (
      oa.vehicle_id = $${vehicleParamIdx}
      OR EXISTS (
        SELECT 1 FROM trips t3
        WHERE t3.driver_id = oa.driver_id
          AND t3.vehicle_id = $${vehicleParamIdx}
          AND t3.status NOT IN ('CANCELLED', 'DRAFT')
      )
    )`;
  }
  if (ownerParamIdx) {
    ownerDirectAdvanceWhere += isFleetScoped(req) && !owner_id
      ? ` AND oa.owner_id = ANY($${ownerParamIdx}::int[])`
      : ` AND oa.owner_id = $${ownerParamIdx}`;
  }

  if (isFleetScoped(req) && !driver_id && ownerParamIdx) {
    const ownerMatch = !owner_id ? `ANY($${ownerParamIdx}::int[])` : `$${ownerParamIdx}`;
    const mgrMatch = isLinkedManager(req) && req.user?.id
      ? ` OR EXISTS (SELECT 1 FROM driver_advances da3 WHERE da3.driver_id = d.id AND da3.manager_id = ${req.user.id})
          OR EXISTS (SELECT 1 FROM truck_advances ta3 WHERE ta3.driver_id = d.id AND ta3.manager_id = ${req.user.id})`
      : '';
    driverWhere += ` AND (
      EXISTS (
        SELECT 1 FROM trips tr JOIN vehicles vv ON tr.vehicle_id = vv.id
        WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT')
          AND vv.owner_id = ${ownerMatch}
      )
      OR EXISTS (
        SELECT 1 FROM owner_advances oa2
        WHERE oa2.driver_id = d.id AND oa2.owner_id = ${ownerMatch}
      )
      ${mgrMatch}
    )`;
  }

  let searchClause = '';
  if (search) {
    searchClause = ` AND (
      comb.driver_name ILIKE $${paramIdx}
      OR comb.driver_mobile ILIKE $${paramIdx}
      OR comb.driver_license ILIKE $${paramIdx}
      OR comb.lorry_number ILIKE $${paramIdx}
      OR comb.owner_name ILIKE $${paramIdx}
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
        COALESCE(adv.total_adv, 0) as unique_advance_total,
        COALESCE(exp.total_exp, 0) as expense_total,
        COALESCE(pay.total_paid, 0) as settled_paid_total,
        (
          COALESCE(adv.total_adv, 0)
          - COALESCE(exp.total_exp, 0)
          + COALESCE(pay.total_paid, 0)
        ) as overall_balance_in_hand
      FROM drivers d
      LEFT JOIN LATERAL (
        SELECT
          COALESCE((
            SELECT SUM(da.amount) FROM driver_advances da
            WHERE da.driver_id = d.id
              AND (da.trip_id IS NULL OR NOT EXISTS (SELECT 1 FROM truck_advances ta2 WHERE ta2.trip_id = da.trip_id))
          ), 0) +
          COALESCE((SELECT SUM(oa.amount) FROM owner_advances oa WHERE oa.driver_id = d.id), 0) +
          COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = d.id), 0) +
          COALESCE((
            SELECT SUM(tr.advance_paid) FROM trips tr
            WHERE tr.driver_id = d.id
              AND tr.status NOT IN ('CANCELLED', 'DRAFT')
              AND COALESCE(tr.advance_paid, 0) > 0
              AND NOT EXISTS (SELECT 1 FROM truck_advances ta2 WHERE ta2.trip_id = tr.id)
              AND NOT EXISTS (SELECT 1 FROM driver_advances da2 WHERE da2.trip_id = tr.id)
          ), 0) as total_adv
      ) adv ON TRUE
      LEFT JOIN LATERAL (
        SELECT SUM(
          COALESCE(s.total_expenses, (
            SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = t.id
          ), 0)
        ) as total_exp
        FROM trips t
        LEFT JOIN settlements s ON s.trip_id = t.id
        WHERE t.driver_id = d.id AND t.status NOT IN ('CANCELLED', 'DRAFT')
      ) exp ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COALESCE((
            SELECT SUM(dsp.amount)
            FROM driver_settlement_payments dsp
            JOIN settlements s ON dsp.settlement_id = s.id
            JOIN trips t ON s.trip_id = t.id
            WHERE t.driver_id = d.id
              AND t.status NOT IN ('CANCELLED', 'DRAFT')
              AND COALESCE(dsp.payment_mode, '') <> 'ADJUSTED_ADVANCE'
          ), 0)
          +
          COALESCE((
            SELECT SUM(s.paid_amount)
            FROM settlements s
            JOIN trips t ON s.trip_id = t.id
            WHERE t.driver_id = d.id
              AND t.status NOT IN ('CANCELLED', 'DRAFT')
              AND s.settlement_status = 'SETTLED'
              AND COALESCE(s.paid_amount, 0) > 0
              AND NOT EXISTS (SELECT 1 FROM driver_settlement_payments dsp WHERE dsp.settlement_id = s.id)
          ), 0) as total_paid
      ) pay ON TRUE
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
        v.owner_id,
        o.name as owner_name,
        o.mobile_number as owner_mobile,
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
        0 as trip_balance,
        0 as balance_in_hand,
        0 as remaining_advance_balance,
        COALESCE(d_ov.overall_balance_in_hand, 0) as overall_balance_in_hand,
        COALESCE(d_ov.unique_advance_total, 0) as unique_advance_total,
        COALESCE(d_ov.expense_total, 0) as overall_expense_total,
        COALESCE(d_ov.settled_paid_total, 0) as settled_paid_total,
        COALESCE(s.net_balance_to_driver, s.balance_to_driver, 0) as settlement_net_balance,
        COALESCE(s.prior_deficit_deduction, t.prior_deficit_deduction, 0) as prior_deficit_deduction,
        COALESCE(s.paid_amount, 0) as paid_amount,
        COALESCE(s.net_balance_to_driver, s.balance_to_driver, 0) as net_balance_to_driver,
        s.id as settlement_id,
        s.settlement_status,
        CASE WHEN t.status NOT IN ('SETTLED', 'CANCELLED', 'DRAFT') THEN true ELSE false END as is_active_trip,
        t.created_at as sort_time
      FROM trips t
      JOIN drivers d ON t.driver_id = d.id
      JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN owners o ON v.owner_id = o.id
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
        COALESCE(v.lorry_number, lt_v.lorry_number, 'Direct Advance') as lorry_number,
        COALESCE(v.vehicle_type, lt_v.vehicle_type) as vehicle_type,
        COALESCE(v.owner_id, lt_v.owner_id) as owner_id,
        COALESCE(o.name, lt_o.name) as owner_name,
        COALESCE(o.mobile_number, lt_o.mobile_number) as owner_mobile,
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
        0::numeric as trip_balance,
        0::numeric as balance_in_hand,
        0::numeric as remaining_advance_balance,
        COALESCE(d_ov.overall_balance_in_hand, 0) as overall_balance_in_hand,
        COALESCE(d_ov.unique_advance_total, 0) as unique_advance_total,
        COALESCE(d_ov.expense_total, 0) as overall_expense_total,
        COALESCE(d_ov.settled_paid_total, 0) as settled_paid_total,
        0::numeric as settlement_net_balance,
        0::numeric as prior_deficit_deduction,
        0::numeric as paid_amount,
        0::numeric as net_balance_to_driver,
        NULL::integer as settlement_id,
        NULL::varchar as settlement_status,
        false as is_active_trip,
        da.created_at as sort_time
      FROM driver_advances da
      JOIN drivers d ON da.driver_id = d.id
      LEFT JOIN vehicles v ON da.vehicle_id = v.id
      LEFT JOIN owners o ON v.owner_id = o.id
      LEFT JOIN LATERAL (
        SELECT t.* FROM trips t
        WHERE t.driver_id = da.driver_id AND t.status NOT IN ('CANCELLED', 'DRAFT')
        ORDER BY t.trip_date DESC, t.id DESC
        LIMIT 1
      ) lt ON da.vehicle_id IS NULL
      LEFT JOIN vehicles lt_v ON lt.vehicle_id = lt_v.id
      LEFT JOIN owners lt_o ON lt_v.owner_id = lt_o.id
      LEFT JOIN driver_overall d_ov ON d_ov.driver_id = d.id
      WHERE da.trip_id IS NULL AND ${driverWhere} AND ${directAdvanceWhere}
    ),
    owner_direct_advance_rows AS (
      SELECT 
        'OWNER_DIRECT_' || oa.id::text as row_key,
        NULL::integer as trip_id,
        oa.advance_date as trip_date,
        'DIRECT_ADVANCE' as trip_status,
        oa.driver_id,
        d.name as driver_name,
        d.mobile_number as driver_mobile,
        d.license_number as driver_license,
        d.status,
        COALESCE(v.lorry_number, lt_v.lorry_number, 'Direct Owner Advance') as lorry_number,
        COALESCE(v.vehicle_type, lt_v.vehicle_type) as vehicle_type,
        oa.owner_id,
        o.name as owner_name,
        o.mobile_number as owner_mobile,
        'Direct Owner Advance (No Trip)' as party_name,
        NULL::varchar as from_location,
        NULL::varchar as to_location,
        NULL::numeric as goods_weight,
        NULL::numeric as freight_rate,
        0::numeric as total_freight,
        NULL::varchar as unit_name,
        NULL::varchar as unit_abbreviation,
        oa.amount as total_advance_given,
        1 as advance_count,
        0::numeric as total_trip_advance_used,
        0 as trip_count,
        0::numeric as total_expenses_reported,
        0::numeric as loading_expense,
        0::numeric as bata_expense,
        0::numeric as cleaning_expense,
        0::numeric as other_expense,
        0::numeric as trip_balance,
        0::numeric as balance_in_hand,
        0::numeric as remaining_advance_balance,
        COALESCE(d_ov.overall_balance_in_hand, 0) as overall_balance_in_hand,
        COALESCE(d_ov.unique_advance_total, 0) as unique_advance_total,
        COALESCE(d_ov.expense_total, 0) as overall_expense_total,
        COALESCE(d_ov.settled_paid_total, 0) as settled_paid_total,
        0::numeric as settlement_net_balance,
        0::numeric as prior_deficit_deduction,
        0::numeric as paid_amount,
        0::numeric as net_balance_to_driver,
        NULL::integer as settlement_id,
        NULL::varchar as settlement_status,
        false as is_active_trip,
        oa.created_at as sort_time
      FROM owner_advances oa
      JOIN drivers d ON oa.driver_id = d.id
      JOIN owners o ON oa.owner_id = o.id
      LEFT JOIN vehicles v ON oa.vehicle_id = v.id
      LEFT JOIN LATERAL (
        SELECT t.* FROM trips t
        WHERE t.driver_id = oa.driver_id AND t.status NOT IN ('CANCELLED', 'DRAFT')
        ORDER BY t.trip_date DESC, t.id DESC
        LIMIT 1
      ) lt ON oa.vehicle_id IS NULL
      LEFT JOIN vehicles lt_v ON lt.vehicle_id = lt_v.id
      LEFT JOIN driver_overall d_ov ON d_ov.driver_id = d.id
      WHERE oa.driver_id IS NOT NULL AND ${driverWhere} AND ${ownerDirectAdvanceWhere}
    )
    SELECT * FROM (
      SELECT * FROM trip_rows
      UNION ALL
      SELECT * FROM direct_advance_rows
      UNION ALL
      SELECT * FROM owner_direct_advance_rows
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

  // For each driver, sort events chronologically (oldest first) and compute a single running net balance.
  // The authoritative final balance is taken from the DB's driver_overall CTE (overall_balance_in_hand)
  // which correctly sums all advances − all expenses globally.
  // Per-row running net is used only for display context on individual rows.
  for (const [_, driverRows] of rowsByDriver) {
    driverRows.sort((a, b) => {
      const timeA = new Date(a.sort_time || a.trip_date || 0).getTime();
      const timeB = new Date(b.sort_time || b.trip_date || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (a.trip_id || 0) - (b.trip_id || 0);
    });

    // Compute a simple running cumulative net (advances in − expenses out) for each row's display.
    // For trips with settlements, we still use raw advance/expense to avoid double-counting
    // the previous_driver_balance already baked into net_balance_to_driver.
    let runningNet = 0;
    for (const row of driverRows) {
      const adv = parseFloat(row.total_advance_given || 0);
      const exp = parseFloat(row.total_expenses_reported || 0);
      const priorDeduction = parseFloat(row.prior_deficit_deduction || 0);

      let rowNetContribution = 0;
      if (row.trip_id) {
        // Trip row: effective advance for this trip minus expenses
        const effectiveAdv = Math.max(0, adv - priorDeduction);
        rowNetContribution = effectiveAdv - exp;
      } else {
        // Direct advance (manager or owner → driver directly, not linked to a trip)
        rowNetContribution = adv;
      }

      runningNet += rowNetContribution;
      const cumulativeNet = Math.round(runningNet * 100) / 100;

      row.balance_in_hand = cumulativeNet > 0 ? cumulativeNet : 0;
      row.need_to_pay = cumulativeNet < 0 ? Math.abs(cumulativeNet) : 0;
      row.remaining_advance_balance = row.balance_in_hand;
      row.trip_balance = row.balance_in_hand;
      row.previous_balance_in_hand = 0;
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
    const uniqueAdvanceTotal  = parseFloat(sorted[0]?.unique_advance_total || 0);
    const uniqueExpenseTotal  = parseFloat(sorted[0]?.overall_expense_total || 0);
    const totalAdvanceGiven   = uniqueAdvanceTotal || sorted.reduce((s: number, r: any) => s + (parseFloat(r.total_advance_given) || 0), 0);
    const totalTripAdvUsed    = sorted.reduce((s: number, r: any) => s + (parseFloat(r.total_trip_advance_used) || 0), 0);
    const totalExpenses       = uniqueExpenseTotal || sorted.reduce((s: number, r: any) => s + (parseFloat(r.total_expenses_reported) || 0), 0);
    const totalAdvCount       = sorted.reduce((s: number, r: any) => s + (parseInt(r.advance_count) || 0), 0);
    const totalTripCount      = tripRows.length;
    const loadingExp          = sorted.reduce((s: number, r: any) => s + (parseFloat(r.loading_expense) || 0), 0);
    const bataExp             = sorted.reduce((s: number, r: any) => s + (parseFloat(r.bata_expense) || 0), 0);
    const cleaningExp         = sorted.reduce((s: number, r: any) => s + (parseFloat(r.cleaning_expense) || 0), 0);
    const otherExp            = sorted.reduce((s: number, r: any) => s + (parseFloat(r.other_expense) || 0), 0);
    const settlementNet       = sorted.reduce((s: number, r: any) => s + (parseFloat(r.settlement_net_balance) || 0), 0);

    // Unique advances − expenses + settlement payments. Positive = cash with driver, negative = office owes driver.
    const dbOverallBalance = parseFloat(sorted[0]?.overall_balance_in_hand || 0);
    const finalNetBalInHand = Math.max(0, Math.round(dbOverallBalance * 100) / 100);
    const finalNetNeedToPay = Math.max(0, Math.round(-dbOverallBalance * 100) / 100);
    const finalPrevInHand = 0;

    // Overall driver payment status follows live cash, not a missing settlement row.
    let driverSettlementStatus: 'SETTLED' | 'PENDING' | 'VERIFIED' | 'CASH_IN_HAND' | 'NEED_TO_PAY' = 'SETTLED';
    if (finalNetNeedToPay > 0.5) {
      driverSettlementStatus = 'NEED_TO_PAY';
    } else if (finalNetBalInHand > 0.5) {
      driverSettlementStatus = 'CASH_IN_HAND';
    } else if (tripRows.some((r: any) => r.settlement_status === 'VERIFIED')) {
      driverSettlementStatus = 'VERIFIED';
    } else {
      driverSettlementStatus = 'SETTLED';
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
      vehicle_type: representativeTrip?.vehicle_type ?? latestRow.vehicle_type ?? null,
      owner_id: representativeTrip?.owner_id ?? latestRow.owner_id ?? null,
      owner_name: representativeTrip?.owner_name ?? latestRow.owner_name ?? null,
      owner_mobile: representativeTrip?.owner_mobile ?? latestRow.owner_mobile ?? null,
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
      manager_advance_given:     Math.round(sorted.filter((r: any) => !r.row_key?.startsWith('OWNER_DIRECT_')).reduce((s: number, r: any) => s + (parseFloat(r.total_advance_given) || 0), 0) * 100) / 100,
      owner_advance_given:       Math.round(sorted.filter((r: any) => r.row_key?.startsWith('OWNER_DIRECT_')).reduce((s: number, r: any) => s + (parseFloat(r.total_advance_given) || 0), 0) * 100) / 100,
      trip_advance_given:        Math.round(sorted.filter((r: any) => r.row_key?.startsWith('TRIP_')).reduce((s: number, r: any) => s + (parseFloat(r.total_advance_given) || 0), 0) * 100) / 100,
      without_trip_advance_given:Math.round(sorted.filter((r: any) => r.row_key?.startsWith('DIRECT_')).reduce((s: number, r: any) => s + (parseFloat(r.total_advance_given) || 0), 0) * 100) / 100,
      advance_count:             totalAdvCount,
      total_trip_advance_used:   Math.round(totalTripAdvUsed * 100) / 100,
      trip_count:                totalTripCount,
      total_expenses_reported:   Math.round(totalExpenses * 100) / 100,
      loading_expense:           Math.round(loadingExp * 100) / 100,
      bata_expense:              Math.round(bataExp * 100) / 100,
      cleaning_expense:          Math.round(cleaningExp * 100) / 100,
      balance_in_hand:           Math.max(0, finalNetBalInHand),
      need_to_pay:               Math.max(0, finalNetNeedToPay),
      previous_balance_in_hand:  0,
      remaining_advance_balance: Math.max(0, finalNetBalInHand),
      trip_balance:              Math.max(0, finalNetBalInHand),
      overall_balance_in_hand:   Math.max(0, finalNetBalInHand),
      settlement_net_balance:    Math.round(settlementNet * 100) / 100,
    });
  }

  // One aggregated row per driver who has gone for trips, sorted alphabetically by driver name
  const aggregatedDrivers = Array.from(driverSummaryMap.values())
    .filter((d) => (d.trip_count || 0) > 0 || (d.advance_count || 0) > 0 || d.balance_in_hand > 0 || d.need_to_pay > 0)
    .sort((a, b) => (a.driver_name || '').localeCompare(b.driver_name || ''));

  const grandTotals = {
    total_advance_given: 0,
    manager_advance_given: 0,
    owner_advance_given: 0,
    trip_advance_given: 0,
    without_trip_advance_given: 0,
    total_trip_advance_used: 0,
    total_expenses_reported: 0,
    remaining_advance_balance: 0,
    balance_in_hand: 0,
    settlement_net_balance: 0,
  };

  let grandTotalNeedToPay = 0;
  for (const d of aggregatedDrivers) {
    grandTotals.total_advance_given        += d.total_advance_given;
    grandTotals.manager_advance_given      += d.manager_advance_given || 0;
    grandTotals.owner_advance_given        += d.owner_advance_given || 0;
    grandTotals.trip_advance_given         += d.trip_advance_given || 0;
    grandTotals.without_trip_advance_given += d.without_trip_advance_given || 0;
    grandTotals.total_trip_advance_used    += d.total_trip_advance_used;
    grandTotals.total_expenses_reported    += d.total_expenses_reported;
    grandTotals.balance_in_hand            += d.balance_in_hand;
    grandTotals.settlement_net_balance     += d.settlement_net_balance;
    grandTotalNeedToPay                    += d.need_to_pay || 0;
  }
  grandTotals.total_advance_given        = Math.round(grandTotals.total_advance_given * 100) / 100;
  grandTotals.manager_advance_given      = Math.round(grandTotals.manager_advance_given * 100) / 100;
  grandTotals.owner_advance_given        = Math.round(grandTotals.owner_advance_given * 100) / 100;
  grandTotals.trip_advance_given         = Math.round(grandTotals.trip_advance_given * 100) / 100;
  grandTotals.without_trip_advance_given = Math.round(grandTotals.without_trip_advance_given * 100) / 100;
  grandTotals.balance_in_hand            = Math.round(grandTotals.balance_in_hand * 100) / 100;
  grandTotals.remaining_advance_balance  = grandTotals.balance_in_hand;
  (grandTotals as any).total_need_to_pay = Math.round(grandTotalNeedToPay * 100) / 100;

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
            COALESCE(v.owner_id, tr_v.owner_id) as owner_id,
            o.name as owner_name,
            o.mobile_number as owner_mobile,
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
     LEFT JOIN owners o ON COALESCE(v.owner_id, tr_v.owner_id) = o.id
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
  if (vehicle_id) assertOwnerVehicle(req, vehicle_id);
  if (trip_id) await assertTripInOwnerScope(req, trip_id);

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

  if (driver_id) {
    await reconcileDriverPendingSettlements(driver_id, null, req.user?.id);
  }

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

/**
 * GET /driver-advances/driver/:driverId/statement
 * Detailed statement for a specific driver including advances, trip expenses, and settlement payments
 */
export const getDriverStatement = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const driverId = parseInt(req.params.driverId as string, 10);
  if (isNaN(driverId)) {
    throw new AppError('Invalid driver ID.', 400);
  }

  const driverRes = await query(
    `SELECT id, name, mobile_number, license_number, status FROM drivers WHERE id = $1`,
    [driverId]
  );
  if (driverRes.rows.length === 0) {
    throw new AppError('Driver not found.', 404);
  }
  const driver = driverRes.rows[0];
  const linked = isLinkedManager(req);
  const scopeToManager = !hasFleetWideAccess(req) && !linked;
  const statementParams: any[] = linked
    ? [
        driverId,
        req.user?.id,
        req.user?.ownerIds?.length ? req.user.ownerIds : [0],
        req.user?.vehicleIds?.length ? req.user.vehicleIds : [0],
      ]
    : scopeToManager
      ? [driverId, req.user?.id]
      : [driverId];
  const mgrDa = linked
    ? `AND (da.manager_id = $2::int OR EXISTS (SELECT 1 FROM vehicles dav WHERE dav.id = da.vehicle_id AND dav.owner_id = ANY($3::int[])))`
    : scopeToManager
      ? 'AND da.manager_id = $2::int'
      : '';
  const mgrTa = linked
    ? 'AND (ta.manager_id = $2::int OR ta.vehicle_id = ANY($4::int[]))'
    : scopeToManager
      ? 'AND ta.manager_id = $2::int'
      : '';
  const mgrTr = linked
    ? 'AND (tr.created_by = $2::int OR tr.vehicle_id = ANY($4::int[]))'
    : scopeToManager
      ? 'AND tr.created_by = $2::int'
      : '';
  const mgrTrip = linked
    ? 'AND t.vehicle_id = ANY($2::int[])'
    : scopeToManager
      ? `AND (
         t.created_by = $2::int
         OR EXISTS (SELECT 1 FROM driver_advances x WHERE x.trip_id = t.id AND x.manager_id = $2::int)
         OR EXISTS (SELECT 1 FROM truck_advances x WHERE x.trip_id = t.id AND x.manager_id = $2::int)
       )`
      : '';
  const oaFilter = linked
    ? 'AND oa.owner_id = ANY($3::int[])'
    : scopeToManager
      ? `AND (
           EXISTS (SELECT 1 FROM driver_advances x WHERE x.driver_id = oa.driver_id AND x.manager_id = $2::int)
           OR EXISTS (SELECT 1 FROM truck_advances x WHERE x.driver_id = oa.driver_id AND x.manager_id = $2::int)
           OR EXISTS (
             SELECT 1 FROM trips x
             WHERE x.driver_id = oa.driver_id
               AND x.created_by = $2::int
               AND x.status NOT IN ('CANCELLED', 'DRAFT')
           )
         )`
      : '';
  const tripStatementParams: any[] = linked
    ? [driverId, req.user?.vehicleIds?.length ? req.user.vehicleIds : [0]]
    : scopeToManager
      ? [driverId, req.user?.id]
      : [driverId];

  // 1. All advances given to driver
  const advancesRes = await query(
    `WITH all_advances AS (
       SELECT 
         da.id,
         da.driver_id,
         da.amount,
         da.advance_date,
         da.payment_mode,
         da.notes,
         da.trip_id,
         da.vehicle_id,
         'DIRECT_ADVANCE' as source_type,
         'MANAGER' as given_by_role,
         u.name as given_by_name,
         da.created_at,
         u.name as manager_name,
         NULL::varchar as owner_name
       FROM driver_advances da
       LEFT JOIN users u ON da.manager_id = u.id
       WHERE da.driver_id = $1 ${mgrDa}

       UNION ALL

       SELECT 
         ta.id,
         ta.driver_id,
         ta.amount,
         ta.advance_date,
         'CASH' as payment_mode,
         ta.notes,
         ta.trip_id,
         ta.vehicle_id,
         'TRUCK_ADVANCE' as source_type,
         'MANAGER' as given_by_role,
         u.name as given_by_name,
         ta.created_at,
         u.name as manager_name,
         NULL::varchar as owner_name
       FROM truck_advances ta
       LEFT JOIN users u ON ta.manager_id = u.id
       WHERE ta.driver_id = $1 ${mgrTa}

       UNION ALL

       SELECT 
         tr.id,
         tr.driver_id,
         tr.advance_paid as amount,
         tr.trip_date as advance_date,
         'CASH' as payment_mode,
         'Trip Advance' as notes,
         tr.id as trip_id,
         tr.vehicle_id,
         'TRIP_ADVANCE' as source_type,
         'MANAGER' as given_by_role,
         u.name as given_by_name,
         tr.created_at,
         u.name as manager_name,
         NULL::varchar as owner_name
       FROM trips tr
       LEFT JOIN users u ON tr.created_by = u.id
       WHERE tr.driver_id = $1
         AND tr.status NOT IN ('CANCELLED', 'DRAFT')
         AND tr.advance_paid > 0
         AND NOT EXISTS (SELECT 1 FROM truck_advances ta2 WHERE ta2.trip_id = tr.id)
         AND NOT EXISTS (SELECT 1 FROM driver_advances da2 WHERE da2.trip_id = tr.id)
         ${mgrTr}

        UNION ALL

        SELECT 
          oa.id,
          oa.driver_id,
          oa.amount,
          oa.advance_date,
          oa.payment_mode,
          COALESCE(oa.notes, 'Direct Owner Advance') as notes,
          NULL::integer as trip_id,
          oa.vehicle_id,
          'OWNER_ADVANCE' as source_type,
          'OWNER' as given_by_role,
          o.name as given_by_name,
          oa.created_at,
          NULL::varchar as manager_name,
          o.name as owner_name
        FROM owner_advances oa
        LEFT JOIN owners o ON oa.owner_id = o.id
        WHERE oa.driver_id = $1
          ${oaFilter}
     )
     SELECT aa.*, 
            COALESCE(v.lorry_number, tr_v.lorry_number) as lorry_number,
            COALESCE(aa.owner_name, vo.name) as vehicle_owner_name,
            r.from_location,
            r.to_location,
            p.name as party_name
     FROM all_advances aa
     LEFT JOIN vehicles v ON aa.vehicle_id = v.id
     LEFT JOIN owners vo ON v.owner_id = vo.id
     LEFT JOIN trips tr ON aa.trip_id = tr.id
     LEFT JOIN routes r ON tr.route_id = r.id
     LEFT JOIN vehicles tr_v ON tr.vehicle_id = tr_v.id
     LEFT JOIN parties p ON tr.party_id = p.id
     ORDER BY aa.advance_date DESC, aa.created_at DESC`,
    statementParams
  );

  // 2. Trips and expenses for this driver
  const tripsRes = await query(
    `SELECT 
       t.id as trip_id,
       t.trip_date,
       t.status as trip_status,
       COALESCE(s.advance_paid, t.advance_paid) as advance_paid,
       t.advance_paid as initial_trip_advance,
       GREATEST(0, COALESCE(s.advance_paid, t.advance_paid) - COALESCE(t.advance_paid, 0)) as additional_advance_paid,
       t.prior_deficit_deduction,
       v.lorry_number,
       o.name as owner_name,
       mgr.name as manager_name,
       p.name as party_name,
       r.from_location,
       r.to_location,
       COALESCE(s.total_expenses, (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = t.id), 0) as total_expenses,
       s.id as settlement_id,
       COALESCE(s.settlement_status, 'PENDING') as settlement_status,
       s.balance_to_driver,
       s.net_balance_to_driver,
       s.payment_mode as settlement_payment_mode,
       s.payment_date as settlement_date,
       s.paid_amount as settlement_paid_amount
     FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     LEFT JOIN users mgr ON t.created_by = mgr.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     LEFT JOIN settlements s ON s.trip_id = t.id
     WHERE t.driver_id = $1
       AND t.status NOT IN ('CANCELLED', 'DRAFT')
       ${mgrTrip}
     ORDER BY t.trip_date DESC, t.id DESC`,
    tripStatementParams
  );

  // 3. Driver settlement payments
  const settlementPaymentsRes = await query(
    `SELECT 
       dsp.id,
       dsp.settlement_id,
       dsp.trip_id,
       dsp.amount,
       dsp.payment_mode,
       dsp.payment_date,
       dsp.reference_no,
       dsp.notes,
       dsp.created_at,
       u.name as created_by_name,
       v.lorry_number,
       o.name as owner_name,
       p.name as party_name
     FROM driver_settlement_payments dsp
     JOIN settlements s ON dsp.settlement_id = s.id
     JOIN trips t ON s.trip_id = t.id
     LEFT JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     LEFT JOIN parties p ON t.party_id = p.id
     LEFT JOIN users u ON dsp.created_by = u.id
     WHERE t.driver_id = $1
       ${mgrTrip}
     ORDER BY dsp.payment_date DESC, dsp.created_at DESC`,
    tripStatementParams
  );

  // Totals
  const totalAdvanceGiven = advancesRes.rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const totalExpenses = tripsRes.rows.reduce((sum, r) => sum + parseFloat(r.total_expenses || 0), 0);
  const totalSettledPaid = settlementPaymentsRes.rows
    .filter((r) => r.payment_mode !== 'ADJUSTED_ADVANCE')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  const balanceInManagerHand = (totalAdvanceGiven + totalSettledPaid) - totalExpenses;

  // Advance breakdown by who given (Manager vs Owner)
  const managerAdvanceTotal = advancesRes.rows
    .filter((r) => r.given_by_role === 'MANAGER' || r.source_type === 'DIRECT_ADVANCE' || r.source_type === 'TRUCK_ADVANCE' || r.source_type === 'TRIP_ADVANCE')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const ownerAdvanceTotal = advancesRes.rows
    .filter((r) => r.given_by_role === 'OWNER' || r.source_type === 'OWNER_ADVANCE')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  // Advance breakdown by purpose (Trip Linked vs Without Trip)
  const tripAdvanceTotal = advancesRes.rows
    .filter((r) => r.trip_id != null || r.source_type === 'TRIP_ADVANCE' || r.source_type === 'TRUCK_ADVANCE')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const withoutTripAdvanceTotal = advancesRes.rows
    .filter((r) =>
      r.trip_id == null &&
      r.source_type !== 'TRIP_ADVANCE' &&
      r.source_type !== 'TRUCK_ADVANCE' &&
      r.source_type !== 'OWNER_ADVANCE' &&
      r.given_by_role !== 'OWNER'
    )
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  const truckAdvanceTotal = advancesRes.rows
    .filter((r) => r.source_type === 'TRUCK_ADVANCE')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  // Build unified chronological activity timeline with running balance & carry-forward explanation
  const rawEvents: any[] = [];

  for (const adv of advancesRes.rows) {
    const isOwner = adv.given_by_role === 'OWNER' || adv.source_type === 'OWNER_ADVANCE';
    const giverName = isOwner ? (adv.given_by_name || adv.owner_name || 'Owner') : (adv.manager_name || adv.given_by_name || 'Manager');
    const isWithoutTrip = !adv.trip_id && adv.source_type !== 'TRIP_ADVANCE';
    
    let forWhat = '';
    if (adv.trip_id) {
      forWhat = `Trip #${adv.trip_id} Advance${adv.lorry_number ? ` (${adv.lorry_number})` : ''}${adv.from_location ? ` · ${adv.from_location} → ${adv.to_location}` : ''}`;
    } else {
      forWhat = `Without Trip · ${adv.notes || (isOwner ? 'Direct Owner Advance' : 'Direct Advance')}`;
    }

    rawEvents.push({
      id: `adv-${adv.source_type || 'UNKNOWN'}-${adv.id}`,
      type: 'ADVANCE',
      date: adv.advance_date || adv.created_at,
      created_at: adv.created_at,
      title: `Advance Given (${adv.payment_mode || 'CASH'})`,
      subtitle: forWhat,
      amount: parseFloat(adv.amount || 0),
      effect: '+',
      notes: adv.notes,
      ref_id: adv.trip_id ? `Trip #${adv.trip_id}` : undefined,
      lorry_number: adv.lorry_number,
      owner_name: isOwner ? (adv.owner_name || adv.given_by_name || null) : (adv.vehicle_owner_name || null),
      party_name: adv.party_name || null,
      source_type: adv.source_type,
      given_by: isOwner ? `Owner: ${giverName}` : `Manager: ${giverName}`,
      given_by_role: isOwner ? 'Owner' : 'Manager',
      given_by_name: giverName,
      given_for: forWhat,
      is_without_trip: isWithoutTrip,
      trip_id: adv.trip_id || null,
    });
  }

  for (const tr of tripsRes.rows) {
    const exp = parseFloat(tr.total_expenses || 0);
    if (exp > 0) {
      const netDue = tr.net_balance_to_driver != null
        ? parseFloat(tr.net_balance_to_driver)
        : Math.max(0, exp - parseFloat(tr.advance_paid || 0));
      const priorDed = parseFloat(tr.prior_deficit_deduction || 0);
      const advPaid = parseFloat(tr.advance_paid || 0);
      const paidAmt = parseFloat(tr.settlement_paid_amount || 0);
      const additionalAdv = parseFloat(tr.additional_advance_paid || 0);
      const initialAdv = parseFloat(tr.initial_trip_advance || 0);

      let subNote = `Advance: ₹${Math.round(advPaid).toLocaleString('en-IN')}`;
      if (additionalAdv > 0) {
        subNote += ` (Mgr: ₹${Math.round(initialAdv).toLocaleString('en-IN')} + Own: ₹${Math.round(additionalAdv).toLocaleString('en-IN')})`;
      }
      if (priorDed > 0) {
        subNote += ` (₹${Math.round(priorDed).toLocaleString('en-IN')} adjusted to prior dues)`;
      }
      if (paidAmt > 0 && tr.settlement_payment_mode !== 'ADJUSTED_ADVANCE') {
        subNote += ` · Settled: ₹${Math.round(paidAmt).toLocaleString('en-IN')}`;
      }
      subNote += ` · Balance Due: ₹${Math.round(netDue).toLocaleString('en-IN')}`;

      rawEvents.push({
        id: `trip-exp-${tr.trip_id}`,
        type: 'EXPENSE',
        date: tr.trip_date,
        created_at: tr.trip_date,
        title: `Trip #${tr.trip_id} Expenses`,
        subtitle: `${tr.lorry_number || ''} · ${tr.from_location || ''} → ${tr.to_location || ''}`,
        amount: exp,
        effect: '-',
        balance_due: netDue > 0 ? netDue : 0,
        prior_deficit_deduction: priorDed,
        settlement_paid_amount: paidAmt,
        notes: subNote,
        ref_id: `Trip #${tr.trip_id}`,
        lorry_number: tr.lorry_number,
        owner_name: tr.owner_name || null,
        party_name: tr.party_name || null,
        settlement_status: tr.settlement_status,
        given_by: `Driver: ${driver.name}`,
        given_by_role: 'Driver',
        given_by_name: driver.name,
        given_for: `Trip #${tr.trip_id} Expenses (${tr.lorry_number || 'Lorry'}${tr.from_location ? ` · ${tr.from_location} → ${tr.to_location}` : ''})`,
        is_without_trip: false,
        trip_id: tr.trip_id,
        from_location: tr.from_location,
        to_location: tr.to_location,
      });
    }
  }

  for (const sp of settlementPaymentsRes.rows) {
    const isAdjusted = sp.payment_mode === 'ADJUSTED_ADVANCE';
    const srcMatch = String(sp.notes || '').match(/from\s+Trip\s*#(\d+)/i)
      || String(sp.notes || '').match(/Trip\s*#(\d+)\s+advance/i);
    const sourceTripId = srcMatch && Number(srcMatch[1]) !== Number(sp.trip_id) ? Number(srcMatch[1]) : null;
    let adjustedAmt = parseFloat(sp.amount || 0) || 0;
    if (isAdjusted && adjustedAmt <= 0 && sp.notes) {
      const noteAmt = String(sp.notes).match(/adjusted by\s*₹\s*([\d,]+)/i)
        || String(sp.notes).match(/Adjusted\s*₹\s*([\d,]+)/i)
        || String(sp.notes).match(/via\s*₹\s*([\d,]+)\s*(?:deduction|advance adjustment)/i)
        || String(sp.notes).match(/₹\s*([\d,]+)\s*(?:adjusted|deduction)/i)
        || String(sp.notes).match(/Partially settled:\s*₹\s*([\d,]+)/i);
      if (noteAmt) adjustedAmt = parseFloat(noteAmt[1].replace(/,/g, '')) || 0;
    }
    rawEvents.push({
      id: `sp-${sp.id}`,
      type: 'SETTLEMENT',
      date: sp.payment_date || sp.created_at,
      created_at: sp.created_at,
      title: isAdjusted ? `Advance Adjusted to Prior Dues` : `Balance Settlement Paid (${sp.payment_mode || 'CASH'})`,
      subtitle: sp.notes || `Settlement for Trip #${sp.trip_id}`,
      amount: isAdjusted ? adjustedAmt : parseFloat(sp.amount || 0),
      adjusted_amount: isAdjusted ? adjustedAmt : 0,
      effect: isAdjusted ? '•' : '+',
      notes: sp.notes || (sp.reference_no ? `Ref: ${sp.reference_no}` : 'Balance paid to driver'),
      ref_id: `Trip #${sp.trip_id}`,
      lorry_number: sp.lorry_number,
      owner_name: sp.owner_name || null,
      party_name: sp.party_name || null,
      given_by: `Accounts (${sp.created_by_name || 'Admin'})`,
      given_by_role: 'Accounts',
      given_by_name: sp.created_by_name || 'Admin',
      given_for: isAdjusted ? `Advance Adjustment for Trip #${sp.trip_id}` : `Settlement Paid for Trip #${sp.trip_id}`,
      is_without_trip: false,
      is_adjusted: isAdjusted,
      trip_id: sp.trip_id || null,
      source_trip_id: sourceTripId,
    });
  }

  // Sort events chronologically (oldest first) to compute accurate running balance
  rawEvents.sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeA - timeB;
    const priority: Record<string, number> = { ADVANCE: 1, EXPENSE: 2, SETTLEMENT: 3 };
    return (priority[a.type] || 0) - (priority[b.type] || 0);
  });

  let runningBalance = 0;
  for (const ev of rawEvents) {
    const prevBal = runningBalance;
    if (ev.type === 'ADVANCE') {
      runningBalance += ev.amount;
      if (prevBal < 0) {
        // Prior deficit was reduced by this advance
        if (runningBalance < 0) {
          ev.carry_forward_note = `Reduces prior deficit from ₹${Math.abs(prevBal).toLocaleString('en-IN')} to ₹${Math.abs(runningBalance).toLocaleString('en-IN')}`;
        } else if (runningBalance === 0) {
          ev.carry_forward_note = `Fully cleared prior deficit of ₹${Math.abs(prevBal).toLocaleString('en-IN')} (All Settled)`;
        } else {
          ev.carry_forward_note = `Cleared prior deficit of ₹${Math.abs(prevBal).toLocaleString('en-IN')} · ₹${runningBalance.toLocaleString('en-IN')} Cash in Hand`;
        }
      } else {
        ev.carry_forward_note = `Advance added to cash in hand`;
      }
    } else if (ev.type === 'EXPENSE') {
      runningBalance -= ev.amount;
      if (runningBalance < 0) {
        ev.carry_forward_note = `Expenses exceeded advance; office owes driver ₹${Math.abs(runningBalance).toLocaleString('en-IN')} (Deficit)`;
      } else {
        ev.carry_forward_note = `Remaining cash in hand: ₹${runningBalance.toLocaleString('en-IN')}`;
      }
    } else if (ev.type === 'SETTLEMENT') {
      if (!ev.is_adjusted) {
        runningBalance += ev.amount;
        ev.carry_forward_note = `Settlement paid to driver; balance cleared`;
      } else {
        ev.carry_forward_note = `Non-cash advance adjustment against deficit`;
      }
    }

    ev.running_balance = Math.round(runningBalance * 100) / 100;
    ev.balance_state = runningBalance > 0 ? 'IN_HAND' : runningBalance < 0 ? 'DEFICIT_DUE' : 'SETTLED';
  }

  // Format timeline for display (newest first for timeline view, with running balances preserved)
  const timeline = [...rawEvents].reverse();

  res.json({
    success: true,
    message: 'Driver statement retrieved.',
    data: {
      driver,
      summary: {
        total_advance_given: totalAdvanceGiven,
        total_expenses: totalExpenses,
        total_settled_cash_paid: totalSettledPaid,
        balance_in_manager_hand: Math.max(0, balanceInManagerHand),
        is_deficit: balanceInManagerHand < 0,
        is_surplus: balanceInManagerHand > 0,
        is_settled: Math.abs(balanceInManagerHand) < 1,
        deficit_amount: balanceInManagerHand < 0 ? Math.abs(balanceInManagerHand) : 0,
        surplus_amount: balanceInManagerHand > 0 ? balanceInManagerHand : 0,
        // Advance breakdown by who given
        manager_advance_total: managerAdvanceTotal,
        owner_advance_total: ownerAdvanceTotal,
        // Advance breakdown by purpose
        trip_advance_total: tripAdvanceTotal,
        without_trip_advance_total: withoutTripAdvanceTotal,
        truck_advance_total: truckAdvanceTotal,
      },
      advances: advancesRes.rows,
      trips_and_expenses: tripsRes.rows,
      settlement_payments: settlementPaymentsRes.rows,
      timeline,
      chronological_timeline: rawEvents,
    },
  });
});

