import { Response } from 'express';
import { query, getClient } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { applyVehicleScope, assertOwnerOwner, assertOwnerVehicle, hasFleetWideAccess, isFleetScoped } from '../utils/ownerScope';
import { createAuditLog } from '../utils/auditLog';

/**
 * Auto-reconcile PENDING settlements for a driver when subsequent advances have covered the deficit.
 * If driver's total advances cover all trip expenses (net overall >= 0 or prior deficit is reduced),
 * pending settlements are marked SETTLED via ADJUSTED_ADVANCE with net_balance_to_driver = 0.
 */
export const reconcileDriverPendingSettlements = async (
  driverId: number,
  clientOrPool?: any,
  userId?: number
): Promise<{ settledCount: number; adjustedCount: number }> => {
  const db = clientOrPool || (await getClient());
  const isDedicatedClient = !clientOrPool;

  try {
    if (isDedicatedClient) await db.query('BEGIN');

    // 1. Get all PENDING settlements for this driver with positive deficit, oldest first
    const pendingRes = await db.query(
      `SELECT s.id, s.trip_id, s.total_expenses, s.advance_paid,
              s.balance_to_driver, s.net_balance_to_driver, s.paid_amount, s.notes,
              t.trip_date
       FROM settlements s
       JOIN trips t ON s.trip_id = t.id
       WHERE t.driver_id = $1 
         AND s.settlement_status = 'PENDING'
         AND COALESCE(s.net_balance_to_driver, s.balance_to_driver, 0) > 0
       ORDER BY t.trip_date ASC, t.id ASC, s.created_at ASC, s.id ASC FOR UPDATE`,
      [driverId]
    );

    if (pendingRes.rows.length === 0) {
      if (isDedicatedClient) await db.query('COMMIT');
      return { settledCount: 0, adjustedCount: 0 };
    }

    // 2. Calculate driver's overall net balance across all advances, cash disbursements, and trip expenses
    const overallRes = await db.query(
      `SELECT
         (
           COALESCE((
             SELECT SUM(da.amount) FROM driver_advances da
             WHERE da.driver_id = $1
               AND (da.trip_id IS NULL OR NOT EXISTS (SELECT 1 FROM truck_advances ta2 WHERE ta2.trip_id = da.trip_id))
           ), 0) +
           COALESCE((SELECT SUM(oa.amount) FROM owner_advances oa WHERE oa.driver_id = $1), 0) +
           COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = $1), 0) +
           COALESCE((SELECT SUM(tr.advance_paid) FROM trips tr WHERE tr.driver_id = $1 AND tr.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr.id) AND NOT EXISTS (SELECT 1 FROM driver_advances da3 WHERE da3.trip_id = tr.id)), 0) +
           COALESCE((
             SELECT SUM(dsp.amount)
             FROM driver_settlement_payments dsp
             JOIN settlements st ON dsp.settlement_id = st.id
             JOIN trips tr ON st.trip_id = tr.id
             WHERE tr.driver_id = $1 AND dsp.payment_mode IN ('CASH', 'UPI', 'BANK_TRANSFER')
           ), 0)
         ) -
         COALESCE((
           SELECT SUM(
             COALESCE(st.total_expenses, (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = tr.id), 0)
           )
           FROM trips tr
           LEFT JOIN settlements st ON st.trip_id = tr.id
           WHERE tr.driver_id = $1 AND tr.status NOT IN ('CANCELLED', 'DRAFT')
         ), 0) as net_overall
      `,
      [driverId]
    );

    const netOverall = parseFloat(overallRes.rows[0]?.net_overall || 0);

    let totalPendingDeficit = 0;
    for (const r of pendingRes.rows) {
      totalPendingDeficit += Math.max(0, parseFloat(r.net_balance_to_driver ?? r.balance_to_driver ?? 0));
    }

    let availableAdvanceToApply = Math.max(0, Math.round(totalPendingDeficit + netOverall));

    if (availableAdvanceToApply <= 0) {
      if (isDedicatedClient) await db.query('COMMIT');
      return { settledCount: 0, adjustedCount: 0 };
    }

    let settledCount = 0;
    let adjustedCount = 0;

    for (const row of pendingRes.rows) {
      if (availableAdvanceToApply <= 0) break;

      const owed = Math.max(0, Math.round(parseFloat(row.net_balance_to_driver ?? row.balance_to_driver ?? 0)));
      if (owed <= 0) continue;

      const settleAmt = Math.min(availableAdvanceToApply, owed);
      const remainingOwed = owed - settleAmt;
      const newPaidAmount = Math.round((parseFloat(row.paid_amount || 0) + settleAmt) * 100) / 100;
      const isFullySettled = remainingOwed <= 0;
      availableAdvanceToApply -= settleAmt;

      const noteAddition = isFullySettled
        ? `Fully settled via ₹${settleAmt.toLocaleString('en-IN')} advance adjustment (Driver surplus in hand: ₹${Math.max(0, Math.round(netOverall)).toLocaleString('en-IN')})`
        : `Partially settled: ₹${settleAmt.toLocaleString('en-IN')} adjusted from driver advance (Remaining balance: ₹${remainingOwed.toLocaleString('en-IN')})`;

      if (isFullySettled) {
        await db.query(
          `UPDATE settlements
           SET settlement_status = 'SETTLED',
               payment_mode = 'ADJUSTED_ADVANCE',
               payment_date = CURRENT_DATE,
               paid_amount = 0,
               balance_to_driver = 0,
               net_balance_to_driver = 0,
               notes = CASE WHEN notes IS NULL OR notes = '' THEN $1::text ELSE notes || ' | ' || $1::text END,
               settled_by = COALESCE($2, settled_by),
               settled_at = NOW(),
               updated_at = NOW()
           WHERE id = $3`,
          [noteAddition, userId || null, row.id]
        );

        await db.query(
          `INSERT INTO driver_settlement_payments (settlement_id, trip_id, amount, payment_mode, payment_date, notes, created_by)
           VALUES ($1, $2, $3, 'ADJUSTED_ADVANCE', CURRENT_DATE, $4, $5)`,
          [row.id, row.trip_id, settleAmt, noteAddition, userId || null]
        );

        const tripFreightRes = await db.query(
          `SELECT t.total_freight, COALESCE(SUM(tp.received_amount), 0) as total_received
           FROM trips t
           LEFT JOIN trip_payments tp ON tp.trip_id = t.id
           WHERE t.id = $1
           GROUP BY t.id, t.total_freight`,
          [row.trip_id]
        );
        if (tripFreightRes.rows.length > 0) {
          const fr = parseFloat(tripFreightRes.rows[0].total_freight || 0);
          const recv = parseFloat(tripFreightRes.rows[0].total_received || 0);
          if (recv >= fr) {
            await db.query(`UPDATE trips SET status = 'SETTLED', updated_at = NOW() WHERE id = $1`, [row.trip_id]);
          }
        }

        settledCount++;
      } else {
        await db.query(
          `UPDATE settlements
           SET balance_to_driver = $1,
               net_balance_to_driver = $1,
               notes = CASE WHEN notes IS NULL OR notes = '' THEN $2::text ELSE notes || ' | ' || $2::text END,
               updated_at = NOW()
           WHERE id = $3`,
          [remainingOwed, noteAddition, row.id]
        );
        adjustedCount++;
      }
    }

    if (isDedicatedClient) await db.query('COMMIT');
    return { settledCount, adjustedCount };
  } catch (err) {
    if (isDedicatedClient) await db.query('ROLLBACK');
    console.error('Error in reconcileDriverPendingSettlements:', err);
    return { settledCount: 0, adjustedCount: 0 };
  } finally {
    if (isDedicatedClient) db.release();
  }
};

export const reconcileAllPendingSettlements = async (userId?: number): Promise<void> => {
  try {
    const res = await query(
      `SELECT DISTINCT t.driver_id 
       FROM settlements s 
       JOIN trips t ON s.trip_id = t.id 
       WHERE s.settlement_status = 'PENDING' AND t.driver_id IS NOT NULL`
    );
    for (const row of res.rows) {
      await reconcileDriverPendingSettlements(row.driver_id, null, userId);
    }
  } catch (err) {
    console.error('Error reconciling all pending settlements:', err);
  }
};

const numAmt = (val: any) => Math.round(parseFloat(String(val || 0)) || 0);

export const attachAdvanceBreakdown = async (rows: any[]): Promise<any[]> => {
  if (!rows.length) return rows;
  const driverIds = [...new Set(rows.map((r) => Number(r.driver_id)).filter((id) => id > 0))];
  if (!driverIds.length) return rows;

  const tripsRes = await query(
    `SELECT t.id, t.driver_id, t.trip_date, t.created_at,
            COALESCE(t.advance_paid, 0) as trip_advance,
            COALESCE(s.total_expenses, (SELECT COALESCE(SUM(de.amount), 0) FROM driver_expenses de WHERE de.trip_id = t.id), 0) as expenses
     FROM trips t
     LEFT JOIN settlements s ON s.trip_id = t.id
     WHERE t.driver_id = ANY($1::int[])
       AND t.status NOT IN ('CANCELLED', 'DRAFT')
     ORDER BY t.driver_id, t.trip_date ASC, t.id ASC`,
    [driverIds]
  );

  const ownerRes = await query(
    `SELECT oa.driver_id, oa.amount, oa.advance_date, oa.created_at, oa.owner_id, o.name as owner_name
     FROM owner_advances oa
     LEFT JOIN owners o ON o.id = oa.owner_id
     WHERE oa.driver_id = ANY($1::int[])
     ORDER BY oa.driver_id, oa.advance_date ASC, oa.created_at ASC, oa.id ASC`,
    [driverIds]
  );

  type Rec = {
    manager_advance: number;
    effective_manager_advance: number;
    owner_applied: number;
    owner_balance: number;
    owner_leftover_used: number;
    owner_given: number;
    expenses: number;
    ownerNames: string[];
  };
  const byTrip = new Map<number, Rec>();
  const addOwnerName = (rec: Rec, name?: string) => {
    const n = String(name || '').trim();
    if (n && !rec.ownerNames.includes(n)) rec.ownerNames.push(n);
  };
  const ensure = (tripId: number): Rec => {
    if (!byTrip.has(tripId)) {
      byTrip.set(tripId, {
        manager_advance: 0,
        effective_manager_advance: 0,
        owner_applied: 0,
        owner_balance: 0,
        owner_leftover_used: 0,
        owner_given: 0,
        expenses: 0,
        ownerNames: [],
      });
    }
    return byTrip.get(tripId)!;
  };

  for (const driverId of driverIds) {
    const trips = tripsRes.rows.filter((r: any) => Number(r.driver_id) === driverId);
    const events: { date: number; created: number; kind: 'TRIP' | 'OWNER'; trip?: any; ownerAmt?: number; ownerName?: string }[] = [];
    for (const t of trips) {
      events.push({
        date: new Date(t.trip_date || t.created_at || 0).getTime(),
        created: new Date(t.created_at || t.trip_date || 0).getTime(),
        kind: 'TRIP',
        trip: t,
      });
    }
    for (const o of ownerRes.rows.filter((r: any) => Number(r.driver_id) === driverId)) {
      events.push({
        date: new Date(o.advance_date || o.created_at || 0).getTime(),
        created: new Date(o.created_at || o.advance_date || 0).getTime(),
        kind: 'OWNER',
        ownerAmt: numAmt(o.amount),
        ownerName: o.owner_name || '',
      });
    }
    events.sort((a, b) => {
      if (a.date !== b.date) return a.date - b.date;
      if (a.created !== b.created) return a.created - b.created;
      if (a.kind === b.kind) return 0;
      return a.kind === 'TRIP' ? -1 : 1;
    });

    let currentTripId: number | null = null;
    const pendingOwners: { amt: number; name: string }[] = [];
    const applyOwner = (amt: number, name: string) => {
      if (amt <= 0) return;
      if (currentTripId == null) {
        pendingOwners.push({ amt, name });
        return;
      }
      const rec = ensure(currentTripId);
      rec.owner_given += amt;
      addOwnerName(rec, name);
    };

    for (const ev of events) {
      if (ev.kind === 'OWNER') {
        applyOwner(ev.ownerAmt || 0, ev.ownerName || '');
        continue;
      }
      const trip = ev.trip;
      currentTripId = Number(trip.id);
      const rec = ensure(currentTripId);
      rec.manager_advance = numAmt(trip.trip_advance);
      rec.expenses = numAmt(trip.expenses);
      if (pendingOwners.length) {
        pendingOwners.forEach((p) => {
          rec.owner_given += p.amt;
          addOwnerName(rec, p.name);
        });
        pendingOwners.length = 0;
      }
    }

    // Signed running cash: positive = in hand, negative = office still owes from earlier trips.
    // A new trip advance first clears that prior deficit, then only leftover cash covers this trip.
    let carry = 0;
    for (const t of trips) {
      const rec = ensure(Number(t.id));
      const manager = rec.manager_advance;
      const ownerAmt = rec.owner_given;
      const expenses = rec.expenses;
      const priorSurplus = Math.max(0, carry);
      const priorDeficit = Math.max(0, -carry);
      const appliedToPrior = Math.min(manager, priorDeficit);
      const effectiveManager = Math.max(0, manager - appliedToPrior);
      const available = priorSurplus + effectiveManager + ownerAmt;
      const remaining = available - expenses;
      rec.effective_manager_advance = effectiveManager;
      rec.owner_applied = Math.min(ownerAmt, Math.max(0, expenses - priorSurplus - effectiveManager));
      rec.owner_leftover_used = Math.min(priorSurplus, expenses);
      rec.owner_balance = Math.max(0, remaining);
      rec.owner_given = ownerAmt;
      carry = remaining;
    }
  }

  return rows.map((row) => {
    const rec = byTrip.get(Number(row.trip_id)) || {
      manager_advance: numAmt(row.initial_trip_advance),
      effective_manager_advance: numAmt(row.initial_trip_advance),
      owner_applied: 0,
      owner_balance: 0,
      owner_leftover_used: 0,
      owner_given: 0,
      expenses: 0,
      ownerNames: [] as string[],
    };
    const { ownerNames, expenses: _expenses, ...rest } = rec;
    return {
      ...row,
      ...rest,
      owner_given: rec.owner_given,
      advance_owner_name: ownerNames.filter(Boolean).join(' + '),
    };
  });
};

export const getSettlements = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status as string;
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;
  const driver_id = req.query.driver_id as string;
  const vehicle_id = req.query.vehicle_id as string;
  const owner_id = req.query.owner_id as string;
  const party_id = req.query.party_id as string;
  const search = (req.query.search as string || '').trim();

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (isFleetScoped(req)) {
    paramIdx = applyVehicleScope(req, conditions, params, paramIdx, 't.vehicle_id');
  } else if (!hasFleetWideAccess(req) && req.user?.id) {
    conditions.push(`t.created_by = $${paramIdx}`); params.push(req.user.id); paramIdx++;
  }
  if (status) { conditions.push(`s.settlement_status = $${paramIdx}`); params.push(status); paramIdx++; }
  if (from_date) { conditions.push(`t.trip_date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`t.trip_date <= $${paramIdx}`); params.push(to_date); paramIdx++; }
  if (driver_id) { conditions.push(`t.driver_id = $${paramIdx}`); params.push(parseInt(driver_id)); paramIdx++; }
  if (vehicle_id) { conditions.push(`t.vehicle_id = $${paramIdx}`); params.push(parseInt(vehicle_id)); paramIdx++; }
  if (owner_id) { conditions.push(`v.owner_id = $${paramIdx}`); params.push(parseInt(owner_id)); paramIdx++; }
  if (party_id) { conditions.push(`t.party_id = $${paramIdx}`); params.push(parseInt(party_id)); paramIdx++; }
  if (search) {
    conditions.push(`(v.lorry_number ILIKE $${paramIdx} OR d.name ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx} OR o.name ILIKE $${paramIdx} OR s.id::text ILIKE $${paramIdx} OR t.id::text ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const countResult = await query(
    `SELECT COUNT(*) FROM settlements s
     JOIN trips t ON s.trip_id = t.id
     JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     WHERE ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT s.*, 
            t.trip_date,
            t.driver_id,
            t.advance_paid as initial_trip_advance,
            s.advance_paid as advance_paid,
            GREATEST(0, s.advance_paid - COALESCE(t.advance_paid, 0)) as additional_advance_paid,
            t.total_freight, t.goods_weight, t.freight_rate,
            COALESCE(s.prior_deficit_deduction, t.prior_deficit_deduction, 0) as prior_deficit_deduction,
            v.lorry_number, v.owner_id, o.name as owner_name, o.mobile_number as owner_mobile,
            d.name as driver_name, d.mobile_number as driver_mobile,
            p.name as party_name, r.from_location, r.to_location,
            u.name as settled_by_name,
            (
              COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(oa.amount) FROM owner_advances oa WHERE oa.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(tr.advance_paid) FROM trips tr WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr.id)), 0) -
              COALESCE((
                SELECT SUM(
                  COALESCE(st.total_expenses, (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = tr.id), 0)
                )
                FROM trips tr
                LEFT JOIN settlements st ON st.trip_id = tr.id
                WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT')
              ), 0)
            ) as driver_current_balance
     FROM settlements s
     JOIN trips t ON s.trip_id = t.id
     JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     LEFT JOIN users u ON s.settled_by = u.id
     WHERE ${where}
     ORDER BY s.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  const items = await attachAdvanceBreakdown(result.rows);
  res.json({ success: true, message: 'Settlements retrieved.', data: { items, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

export const getSettlementByTripId = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { trip_id } = req.params;

  // Reconcile pending settlements for this trip's driver first
  const tripCheck = await query('SELECT driver_id FROM trips WHERE id = $1', [trip_id]);
  if (tripCheck.rows.length > 0 && tripCheck.rows[0].driver_id) {
    await reconcileDriverPendingSettlements(tripCheck.rows[0].driver_id, null, req.user?.id);
  }

  const result = await query(
    `SELECT s.*, 
            t.trip_date,
            t.driver_id,
            t.advance_paid as initial_trip_advance,
            s.advance_paid as advance_paid,
            GREATEST(0, s.advance_paid - COALESCE(t.advance_paid, 0)) as additional_advance_paid,
            t.total_freight, t.goods_weight, t.freight_rate,
            COALESCE(s.prior_deficit_deduction, t.prior_deficit_deduction, 0) as prior_deficit_deduction,
            v.lorry_number, v.owner_id, o.name as owner_name, o.mobile_number as owner_mobile,
            d.name as driver_name, d.mobile_number as driver_mobile,
            p.name as party_name, r.from_location, r.to_location,
            u.name as settled_by_name,
            (
              COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(oa.amount) FROM owner_advances oa WHERE oa.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(tr.advance_paid) FROM trips tr WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr.id)), 0) -
              COALESCE((
                SELECT SUM(
                  COALESCE(st.total_expenses, (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = tr.id), 0)
                )
                FROM trips tr
                LEFT JOIN settlements st ON st.trip_id = tr.id
                WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT')
              ), 0)
            ) as driver_current_balance,
            (SELECT json_agg(json_build_object('expense_type', de.expense_type, 'description', de.description, 'amount', de.amount))
             FROM driver_expenses de WHERE de.trip_id = t.id) as expense_items,
            (SELECT json_agg(json_build_object('id', dsp.id, 'amount', dsp.amount, 'payment_mode', dsp.payment_mode, 'payment_date', dsp.payment_date, 'reference_no', dsp.reference_no, 'notes', dsp.notes, 'created_at', dsp.created_at))
             FROM driver_settlement_payments dsp WHERE dsp.settlement_id = s.id) as payment_history
     FROM settlements s
     JOIN trips t ON s.trip_id = t.id
     JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     LEFT JOIN users u ON s.settled_by = u.id
     WHERE s.trip_id = $1`,
    [trip_id]
  );

  if (result.rows.length === 0) throw new AppError('Settlement not found for this trip.', 404);
  assertOwnerOwner(req, result.rows[0].owner_id);
  const [tripSettlement] = await attachAdvanceBreakdown(result.rows);
  res.json({ success: true, message: 'Settlement retrieved.', data: tripSettlement });
});

export const getSettlementById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const sCheck = await query('SELECT t.driver_id FROM settlements s JOIN trips t ON s.trip_id = t.id WHERE s.id = $1', [id]);
  if (sCheck.rows.length > 0 && sCheck.rows[0].driver_id) {
    await reconcileDriverPendingSettlements(sCheck.rows[0].driver_id, null, req.user?.id);
  }

  const result = await query(
    `SELECT s.*, 
            t.trip_date,
            t.driver_id,
            t.advance_paid as initial_trip_advance,
            s.advance_paid as advance_paid,
            GREATEST(0, s.advance_paid - COALESCE(t.advance_paid, 0)) as additional_advance_paid,
            t.total_freight, t.goods_weight, t.freight_rate,
            COALESCE(s.prior_deficit_deduction, t.prior_deficit_deduction, 0) as prior_deficit_deduction,
            v.lorry_number, v.owner_id, o.name as owner_name, o.mobile_number as owner_mobile,
            d.name as driver_name, d.mobile_number as driver_mobile,
            p.name as party_name, r.from_location, r.to_location,
            u.name as settled_by_name,
            (
              COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(oa.amount) FROM owner_advances oa WHERE oa.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(tr.advance_paid) FROM trips tr WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr.id)), 0) -
              COALESCE((
                SELECT SUM(
                  COALESCE(st.total_expenses, (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = tr.id), 0)
                )
                FROM trips tr
                LEFT JOIN settlements st ON st.trip_id = tr.id
                WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT')
              ), 0)
            ) as driver_current_balance,
            (SELECT json_agg(json_build_object('expense_type', de.expense_type, 'description', de.description, 'amount', de.amount))
             FROM driver_expenses de WHERE de.trip_id = t.id) as expense_items,
            (SELECT json_agg(json_build_object('id', dsp.id, 'amount', dsp.amount, 'payment_mode', dsp.payment_mode, 'payment_date', dsp.payment_date, 'reference_no', dsp.reference_no, 'notes', dsp.notes, 'created_at', dsp.created_at))
             FROM driver_settlement_payments dsp WHERE dsp.settlement_id = s.id) as payment_history
     FROM settlements s
     JOIN trips t ON s.trip_id = t.id
     JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     LEFT JOIN users u ON s.settled_by = u.id
     WHERE s.id = $1`,
    [id]
  );

  if (result.rows.length === 0) throw new AppError('Settlement not found.', 404);
  assertOwnerOwner(req, result.rows[0].owner_id);
  const [byIdSettlement] = await attachAdvanceBreakdown(result.rows);
  res.json({ success: true, message: 'Settlement retrieved.', data: byIdSettlement });
});

export const generateSettlement = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { trip_id } = req.params;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get trip with expense totals
    const tripResult = await client.query(
      `SELECT t.*, v.lorry_number, d.name as driver_name, d.id as d_id, p.name as party_name, r.from_location, r.to_location
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
    if (isFleetScoped(req)) {
      assertOwnerVehicle(req, trip.vehicle_id);
    } else if (!hasFleetWideAccess(req) && req.user?.id && trip.created_by !== req.user.id) {
      throw new AppError('You do not have permission to settle this trip.', 403);
    }

    // Check for existing settlement
    const existingSettlement = await client.query('SELECT id FROM settlements WHERE trip_id = $1', [trip_id]);
    if (existingSettlement.rows.length > 0) throw new AppError('Settlement already exists for this trip.', 409);

    // Ensure table columns exist
    await client.query(`
      ALTER TABLE settlements 
      ADD COLUMN IF NOT EXISTS previous_driver_balance DECIMAL(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_balance_to_driver DECIMAL(12,2) DEFAULT 0
    `).catch(() => {});

    // Calculate totals — backend is source of truth
    const expenseResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM driver_expenses WHERE trip_id = $1`,
      [trip_id]
    );

    const total_expenses = Math.round(parseFloat(expenseResult.rows[0].total) || 0);
    const trip_advance_paid = Math.round(parseFloat(trip.advance_paid) || 0);

    // === DRIVER ADVANCE CARRY-FORWARD BALANCE LOGIC ===
    // Correct formula:
    //   prior_balance = (prior truck advances to driver) + (prior direct driver advances)
    //                 - (prior trip expenses)
    //                 + (cash settlements admin paid driver for prior trips)
    //
    // This means:
    //   - positive prior_balance → driver holds surplus advance in hand
    //   - negative prior_balance → admin still owes driver money from prior trips
    //     → this REDUCES the new trip's available advance
    //
    // Example: Trip1 advance=3000, expenses=4200, admin owes 1200 (unsettled PENDING)
    //   prior truck advances = 3000, prior expenses = 4200, cash paid = 0
    //   prior_balance = 3000 - 4200 + 0 = -1200
    //   Trip2 advance = 5000, total_available = -1200 + 5000 = 3800
    //   → Trip2 settlement uses only 3800 effectively (1200 offsets what was owed)
    //
    // Example: Trip1 settled via CASH 1200 paid to driver:
    //   prior truck advances = 3000, prior expenses = 4200, cash paid = 1200
    //   prior_balance = 3000 - 4200 + 1200 = 0
    //   Trip2 advance = 5000, total_available = 0 + 5000 = 5000 ✅

    const driverAdvanceStats = await client.query(
      `SELECT
         -- All advance money given to driver before this trip
         COALESCE((
           SELECT SUM(da.amount) FROM driver_advances da
           WHERE da.driver_id = $1
             AND (da.trip_id IS NULL OR da.trip_id != $2)
             AND (da.trip_id IS NULL OR NOT EXISTS (SELECT 1 FROM truck_advances ta2 WHERE ta2.trip_id = da.trip_id))
         ), 0) +
         COALESCE((SELECT SUM(oa.amount) FROM owner_advances oa WHERE oa.driver_id = $1), 0) +
         COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = $1 AND (ta.trip_id IS NULL OR ta.trip_id != $2)), 0) +
         COALESCE((SELECT SUM(t.advance_paid) FROM trips t WHERE t.driver_id = $1 AND t.id != $2 AND t.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = t.id) AND NOT EXISTS (SELECT 1 FROM driver_advances da3 WHERE da3.trip_id = t.id)), 0)
         as total_prior_advances,

         -- All expenses incurred by driver across prior trips
         COALESCE((
           SELECT SUM(
             COALESCE(s.total_expenses, (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = t.id), 0)
           )
           FROM trips t
           LEFT JOIN settlements s ON s.trip_id = t.id
           WHERE t.driver_id = $1 AND t.id != $2 AND t.status NOT IN ('CANCELLED', 'DRAFT')
         ), 0) as total_prior_expenses,

         -- Cash/UPI/bank payments admin actually paid driver for prior settlements
         -- (ADJUSTED_ADVANCE payments have amount=0, so they don't affect this sum)
         COALESCE((
           SELECT SUM(dsp.amount)
           FROM driver_settlement_payments dsp
           JOIN settlements s ON dsp.settlement_id = s.id
           JOIN trips t ON s.trip_id = t.id
           WHERE t.driver_id = $1 AND t.id != $2
         ), 0) as total_prior_cash_paid_to_driver
      `,
      [trip.driver_id, trip_id]
    );

    const total_prior_advances = parseFloat(driverAdvanceStats.rows[0]?.total_prior_advances || 0);
    const total_prior_expenses_sum = parseFloat(driverAdvanceStats.rows[0]?.total_prior_expenses || 0);
    const total_prior_cash_paid = parseFloat(driverAdvanceStats.rows[0]?.total_prior_cash_paid_to_driver || 0);

    // Prior balance in driver hand before this trip (surplus advance held by driver >= 0):
    // Prior deficit is tracked on prior trips or deducted via trip's prior_deficit_deduction.
    const rawPriorDiff = total_prior_advances - total_prior_expenses_sum + total_prior_cash_paid;
    const previous_driver_balance = Math.max(0, Math.round(rawPriorDiff));
    const prior_deficit_deduction = Math.round(parseFloat(trip.prior_deficit_deduction) || 0);
    const effective_trip_advance = Math.max(0, trip_advance_paid - prior_deficit_deduction);
    const total_advance_available = effective_trip_advance + previous_driver_balance;

    let balance_to_driver = 0;
    let net_balance_to_driver = 0;
    let auto_settle = false;

    if (total_advance_available >= total_expenses) {
      // Advance completely covers trip expenses
      const remaining_advance_in_hand = Math.round(total_advance_available - total_expenses);
      balance_to_driver = 0;
      net_balance_to_driver = -remaining_advance_in_hand; // negative = surplus advance held by driver
      auto_settle = true;
    } else {
      // Expenses exceed available advance; company owes driver the difference for this trip
      const excess = Math.round(total_expenses - total_advance_available);
      balance_to_driver = excess;
      net_balance_to_driver = excess;
      auto_settle = false;
    }

    const initialStatus = auto_settle ? 'SETTLED' : 'PENDING';
    const initialMode = auto_settle ? 'ADJUSTED_ADVANCE' : null;
    const initialPayDate = auto_settle ? (trip.trip_date || new Date().toISOString().split('T')[0]) : null;

    // Build descriptive notes for the settlement
    let initialNotes: string | null = null;
    if (auto_settle) {
      if (previous_driver_balance > 0) {
        initialNotes = `Advance brought forward from prior trips: ₹${previous_driver_balance.toLocaleString('en-IN')}. Expenses ₹${total_expenses.toLocaleString('en-IN')} deducted from total available ₹${total_advance_available.toLocaleString('en-IN')}. Driver holds ₹${Math.abs(net_balance_to_driver).toLocaleString('en-IN')} advance in hand.`;
      } else {
        initialNotes = `Expenses ₹${total_expenses.toLocaleString('en-IN')} deducted from advance balance. Driver holds ₹${Math.abs(net_balance_to_driver).toLocaleString('en-IN')} advance in hand.`;
      }
    } else if (prior_deficit_deduction > 0) {
      initialNotes = `Trip advance of ₹${trip_advance_paid.toLocaleString('en-IN')} was adjusted by ₹${prior_deficit_deduction.toLocaleString('en-IN')} to settle prior trip dues. Balance to pay for this trip: ₹${net_balance_to_driver.toLocaleString('en-IN')}`;
    }

    // Create settlement with carry-forward fields
    const settlementResult = await client.query(
      `INSERT INTO settlements (
         trip_id, total_freight, total_expenses, advance_paid, prior_deficit_deduction, balance_to_driver,
         previous_driver_balance, net_balance_to_driver, settlement_status,
         payment_mode, payment_date, paid_amount, notes, settled_by, settled_at, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, ${auto_settle ? 'NOW()' : 'NULL'}, $15)
       RETURNING *`,
      [
        trip_id,
        Math.round(parseFloat(trip.total_freight) || 0),
        total_expenses,
        trip_advance_paid,
        prior_deficit_deduction,
        balance_to_driver,
        previous_driver_balance,
        net_balance_to_driver,
        initialStatus,
        initialMode,
        initialPayDate,
        0,
        initialNotes,
        auto_settle ? req.user?.id : null,
        req.user?.id,
      ]
    );

    // If auto-settled, also record in driver_settlement_payments for audit ledger
    if (auto_settle) {
      await client.query(
        `INSERT INTO driver_settlement_payments (settlement_id, trip_id, amount, payment_mode, payment_date, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [settlementResult.rows[0].id, trip_id, 0, 'ADJUSTED_ADVANCE', initialPayDate, initialNotes, req.user?.id]
      );
    }

    // When settlement slip is generated, record trip advance in truck_advances so manager balance reflects it
    if (trip_advance_paid > 0) {
      const advCheck = await client.query('SELECT id FROM truck_advances WHERE trip_id = $1', [trip_id]);
      if (advCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO truck_advances (vehicle_id, driver_id, manager_id, amount, advance_date, notes, created_by, trip_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            trip.vehicle_id,
            trip.driver_id,
            trip.created_by || req.user?.id,
            trip_advance_paid,
            trip.created_at || new Date(),
            `Advance for Trip #${trip_id} (${trip.lorry_number || ''})`,
            req.user?.id,
            trip_id,
          ]
        );
      }
    }

    // When settlement is generated, the trip is officially committed:
    // Move from DRAFT → PAYMENT_PENDING (or SETTLED if fully paid + auto_settle)
    const pmtSum = await client.query(
      `SELECT COALESCE(SUM(received_amount), 0) as total_received FROM trip_payments WHERE trip_id = $1`,
      [trip_id]
    );
    const totalRecv = parseFloat(pmtSum.rows[0].total_received);
    const totalFr = parseFloat(trip.total_freight);
    if (totalRecv >= totalFr && auto_settle) {
      await client.query(`UPDATE trips SET status = 'SETTLED', updated_at = NOW() WHERE id = $1`, [trip_id]);
    } else {
      // Ensure trip is at least PAYMENT_PENDING (activates it from DRAFT)
      await client.query(
        `UPDATE trips SET status = CASE WHEN status = 'DRAFT' THEN 'PAYMENT_PENDING' ELSE status END, updated_at = NOW() WHERE id = $1`,
        [trip_id]
      );
    }


    const expensesResult = await client.query(
      `SELECT expense_type, description, amount FROM driver_expenses WHERE trip_id = $1 ORDER BY id ASC`,
      [trip_id]
    );

    await client.query('COMMIT');

    if (!auto_settle && trip.driver_id) {
      await reconcileDriverPendingSettlements(trip.driver_id, null, req.user?.id);
    }

    await createAuditLog(req.user?.id, 'GENERATE_SETTLEMENT', 'SETTLEMENTS', settlementResult.rows[0].id, {
      trip_id, balance_to_driver, previous_driver_balance, net_balance_to_driver, auto_settle,
    });

    res.status(201).json({
      success: true,
      message: auto_settle
        ? `Trip settlement generated and settled automatically (₹${total_expenses.toFixed(2)} expenses covered by advance).`
        : 'Trip settlement slip generated successfully.',
      data: {
        ...settlementResult.rows[0],
        lorry_number: trip.lorry_number,
        driver_name: trip.driver_name,
        party_name: trip.party_name,
        from_location: trip.from_location,
        to_location: trip.to_location,
        trip_date: trip.trip_date,
        goods_weight: trip.goods_weight,
        freight_rate: trip.freight_rate,
        expense_items: expensesResult.rows,
      },
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

export const settlePayment = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { payment_mode, payment_date, paid_amount, reference_no, notes } = req.body;

  const mode = (payment_mode || 'CASH').toUpperCase();
  if (!['CASH', 'UPI', 'BANK_TRANSFER', 'ADJUSTED_ADVANCE'].includes(mode)) {
    throw new AppError('Payment mode must be CASH, UPI, BANK_TRANSFER, or ADJUSTED_ADVANCE.', 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const sResult = await client.query(`SELECT * FROM settlements WHERE id = $1 FOR UPDATE`, [id]);
    if (sResult.rows.length === 0) throw new AppError('Settlement not found.', 404);
    const settlement = sResult.rows[0];

    const isAdjusted = mode === 'ADJUSTED_ADVANCE';
    const effectivePaid = (paid_amount !== undefined && paid_amount !== null)
      ? parseFloat(paid_amount)
      : Math.max(0, parseFloat(settlement.net_balance_to_driver ?? settlement.balance_to_driver ?? 0));
    const ledgerAmount = isAdjusted ? 0 : effectivePaid;

    const payDate = payment_date || new Date().toISOString().split('T')[0];
    const finalNotes = notes || (isAdjusted ? 'Trip expenses deducted from driver advance balance' : null);

    // Record into driver_settlement_payments table
    await client.query(
      `INSERT INTO driver_settlement_payments (settlement_id, trip_id, amount, payment_mode, payment_date, reference_no, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [settlement.id, settlement.trip_id, ledgerAmount, mode, payDate, reference_no || null, finalNotes, req.user?.id]
    );

    // Update settlement record
    const updatedSettlement = await client.query(
      `UPDATE settlements
       SET settlement_status = 'SETTLED',
           payment_mode = $1,
           payment_date = $2,
           paid_amount = $3,
           net_balance_to_driver = 0,
           reference_no = $4,
           notes = $5,
           settled_by = $6,
           settled_at = NOW(),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [mode, payDate, effectivePaid, reference_no || null, finalNotes, req.user?.id, id]
    );

    // If freight is also settled, update trip status to SETTLED
    const pmtSum = await client.query(
      `SELECT COALESCE(SUM(received_amount), 0) as total_received FROM trip_payments WHERE trip_id = $1`,
      [settlement.trip_id]
    );
    const totalRecv = parseFloat(pmtSum.rows[0].total_received);
    const totalFr = parseFloat(settlement.total_freight);
    if (totalRecv >= totalFr) {
      await client.query(`UPDATE trips SET status = 'SETTLED', updated_at = NOW() WHERE id = $1`, [settlement.trip_id]);
    }

    await client.query('COMMIT');

    await createAuditLog(req.user?.id, 'SETTLE_DRIVER_PAYMENT', 'SETTLEMENTS', id, {
      trip_id: settlement.trip_id,
      payment_mode: mode,
      amount: effectivePaid,
      payment_date: payDate,
    });

    res.json({
      success: true,
      message: isAdjusted
        ? 'Trip settlement marked settled via driver advance adjustment.'
        : `Driver settlement of ₹${effectivePaid.toFixed(2)} recorded successfully via ${mode}.`,
      data: updatedSettlement.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const settleDriverBalance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { driverId } = req.params;
  const { payment_mode, payment_date, paid_amount, reference_no, notes } = req.body;

  const mode = (payment_mode || 'CASH').toUpperCase();
  if (!['CASH', 'UPI', 'BANK_TRANSFER', 'ADJUSTED_ADVANCE'].includes(mode)) {
    throw new AppError('Payment mode must be CASH, UPI, BANK_TRANSFER, or ADJUSTED_ADVANCE.', 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Find any PENDING settlement for this driver
    let sResult = await client.query(
      `SELECT s.* FROM settlements s
       JOIN trips t ON s.trip_id = t.id
       WHERE t.driver_id = $1 AND s.settlement_status = 'PENDING'
       ORDER BY s.id DESC
       LIMIT 1 FOR UPDATE`,
      [driverId]
    );

    let settlementId: number | null = null;
    let tripId: number | null = null;

    if (sResult.rows.length > 0) {
      settlementId = sResult.rows[0].id;
      tripId = sResult.rows[0].trip_id;
    } else {
      // Find latest trip for this driver
      const tripRes = await client.query(
        `SELECT t.id, t.total_freight, t.advance_paid FROM trips t
         WHERE t.driver_id = $1 AND t.status NOT IN ('CANCELLED', 'DRAFT')
         ORDER BY t.id DESC LIMIT 1`,
        [driverId]
      );
      if (tripRes.rows.length > 0) {
        tripId = tripRes.rows[0].id;
        const existS = await client.query(`SELECT id FROM settlements WHERE trip_id = $1`, [tripId]);
        if (existS.rows.length > 0) {
          settlementId = existS.rows[0].id;
        } else {
          const expRes = await client.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM driver_expenses WHERE trip_id = $1`,
            [tripId]
          );
          const total_expenses = parseFloat(expRes.rows[0].total);
          const total_freight = parseFloat(tripRes.rows[0].total_freight);
          const advance_paid = parseFloat(tripRes.rows[0].advance_paid);
          const balance_to_driver = total_expenses - advance_paid;

          const newS = await client.query(
            `INSERT INTO settlements (trip_id, total_freight, total_expenses, advance_paid, balance_to_driver, settlement_status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
             RETURNING id`,
            [tripId, total_freight, total_expenses, advance_paid, balance_to_driver, req.user?.id]
          );
          settlementId = newS.rows[0].id;
        }
      }
    }

    if (!settlementId || !tripId) {
      const anyS = await client.query(
        `SELECT s.id, s.trip_id FROM settlements s
         JOIN trips t ON s.trip_id = t.id
         WHERE t.driver_id = $1
         ORDER BY s.id DESC LIMIT 1`,
        [driverId]
      );
      if (anyS.rows.length > 0) {
        settlementId = anyS.rows[0].id;
        tripId = anyS.rows[0].trip_id;
      } else {
        throw new AppError('No trip or settlement found for this driver to record balance payment.', 404);
      }
    }

    const amount = (paid_amount !== undefined && paid_amount !== null)
      ? parseFloat(paid_amount)
      : 0;

    const payDate = payment_date || new Date().toISOString().split('T')[0];
    const finalNotes = notes || 'Balance payment to driver settled by manager';

    // Record into driver_settlement_payments table
    await client.query(
      `INSERT INTO driver_settlement_payments (settlement_id, trip_id, amount, payment_mode, payment_date, reference_no, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [settlementId, tripId, amount, mode, payDate, reference_no || null, finalNotes, req.user?.id]
    );

    // Update settlement record to SETTLED
    await client.query(
      `UPDATE settlements
       SET settlement_status = 'SETTLED',
           payment_mode = $1,
           payment_date = $2,
           paid_amount = COALESCE(paid_amount, 0) + $3,
           reference_no = $4,
           notes = $5,
           settled_by = $6,
           settled_at = NOW(),
           updated_at = NOW()
       WHERE id = $7`,
      [mode, payDate, amount, reference_no || null, finalNotes, req.user?.id, settlementId]
    );

    await client.query('COMMIT');

    await createAuditLog(req.user?.id, 'SETTLE_DRIVER_PAYMENT', 'SETTLEMENTS', String(settlementId), {
      trip_id: tripId,
      driver_id: driverId,
      payment_mode: mode,
      amount,
      payment_date: payDate,
    });

    res.json({
      success: true,
      message: `Balance of ₹${amount.toLocaleString('en-IN')} successfully settled with driver.`,
      data: { settlement_id: settlementId, amount, status: 'SETTLED' }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const getSettlementPayments = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const result = await query(
    `SELECT dsp.*, u.name as created_by_name
     FROM driver_settlement_payments dsp
     LEFT JOIN users u ON dsp.created_by = u.id
     WHERE dsp.settlement_id = $1
     ORDER BY dsp.created_at DESC`,
    [id]
  );
  res.json({ success: true, message: 'Settlement payments retrieved.', data: result.rows });
});

export const deleteSettlementPayment = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { paymentId } = req.params;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const pmt = await client.query('SELECT * FROM driver_settlement_payments WHERE id = $1', [paymentId]);
    if (pmt.rows.length === 0) throw new AppError('Payment not found.', 404);
    const payment = pmt.rows[0];

    await client.query('DELETE FROM driver_settlement_payments WHERE id = $1', [paymentId]);

    // Check remaining payments
    const rem = await client.query(
      'SELECT * FROM driver_settlement_payments WHERE settlement_id = $1 ORDER BY created_at DESC',
      [payment.settlement_id]
    );
    if (rem.rows.length === 0) {
      await client.query(
        `UPDATE settlements
         SET settlement_status = 'PENDING',
             payment_mode = NULL,
             payment_date = NULL,
             paid_amount = NULL,
             reference_no = NULL,
             notes = NULL,
             settled_by = NULL,
             settled_at = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [payment.settlement_id]
      );
    } else {
      const latest = rem.rows[0];
      await client.query(
        `UPDATE settlements
         SET payment_mode = $1,
             payment_date = $2,
             paid_amount = $3,
             reference_no = $4,
             notes = $5,
             updated_at = NOW()
         WHERE id = $6`,
        [latest.payment_mode, latest.payment_date, latest.amount, latest.reference_no, latest.notes, payment.settlement_id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Settlement payment receipt deleted.' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const deleteSettlement = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, trip_id FROM settlements WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Settlement not found.', 404);

  await query('DELETE FROM settlements WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_SETTLEMENT', 'SETTLEMENTS', id, existing.rows[0]);
  res.json({ success: true, message: 'Settlement deleted successfully.' });
});

