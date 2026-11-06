import { Response } from 'express';
import { query, getClient } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';
import { applyVehicleScope, assertOwnerVehicle, hasFleetWideAccess, isFleetScoped } from '../utils/ownerScope';
import { nameAppearsOnBill, normalizeVehicleNo, parseWeighBillText, vehicleNosMatch } from '../utils/parseWeighBill';
import { decodeBillImage, hashBillImage, ocrWeighBill } from '../utils/weighBillOcr';

const duplicateBillMessage = (dup: { id: number; trip_date?: string; weigh_bill_slip_no?: string; weigh_bill_date?: string }) => {
  const slip = dup.weigh_bill_slip_no ? ` slip ${dup.weigh_bill_slip_no}` : '';
  const date = dup.weigh_bill_date || dup.trip_date;
  return `This bill is duplicate${slip}${date ? ` dated ${date}` : ''}. It was already used on Trip #${dup.id}. Upload a different weighment / acceptance bill.`;
};

const toBillDateIso = (val?: string | null) => {
  const s = String(val || '').trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? (Number(dmy[3]) > 50 ? `19${dmy[3]}` : `20${dmy[3]}`) : dmy[3];
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
};

const findDuplicateWeighBill = async (
  opts: {
    hash?: string | null;
    slipNo?: string | null;
    billDate?: string | null;
    excludeTripId?: number;
  },
  exec: typeof query = query
) => {
  const params: any[] = [];
  const parts: string[] = [];
  if (opts.hash) {
    params.push(opts.hash);
    parts.push(`weigh_bill_hash = $${params.length}`);
  }
  const slip = String(opts.slipNo || '').trim();
  const billDate = toBillDateIso(opts.billDate);
  if (slip && billDate) {
    params.push(slip);
    params.push(billDate);
    parts.push(`(
      weigh_bill_slip_no = $${params.length - 1}
      AND (
        weigh_bill_date = $${params.length}::date
        OR (weigh_bill_date IS NULL AND trip_date::date = $${params.length}::date)
      )
    )`);
  } else if (slip) {
    params.push(slip);
    parts.push(`weigh_bill_slip_no = $${params.length}`);
  }
  if (!parts.length) return null;
  let sql = `SELECT id, trip_date, weigh_bill_slip_no, weigh_bill_date
             FROM trips
             WHERE status <> 'CANCELLED' AND (${parts.join(' OR ')})`;
  if (opts.excludeTripId) {
    params.push(opts.excludeTripId);
    sql += ` AND id <> $${params.length}`;
  }
  sql += ' ORDER BY id DESC LIMIT 1';
  const found = await exec(sql, params);
  return found.rows[0] || null;
};

export const parseWeighBill = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { image_base64, exclude_trip_id, expected_vehicle_no, expected_party_name, expected_unit_name } = req.body || {};
  if (!image_base64) throw new AppError('Upload the weighment / acceptance bill photo.', 400);

  const buffer = decodeBillImage(String(image_base64));
  const hash = hashBillImage(buffer);
  const destPromise = query(
    `SELECT DISTINCT to_location FROM routes WHERE status <> 'INACTIVE' AND to_location IS NOT NULL`
  );
  let ocrText = '';
  try {
    ocrText = await ocrWeighBill(buffer);
  } catch {
    ocrText = '';
  }
  const destRes = await destPromise;
  const parsed = parseWeighBillText(
    ocrText,
    expected_vehicle_no ? String(expected_vehicle_no) : null,
    expected_party_name ? String(expected_party_name) : null,
    expected_unit_name ? String(expected_unit_name) : null,
    destRes.rows.map((r: any) => String(r.to_location))
  );
  const duplicate = await findDuplicateWeighBill({
    hash,
    slipNo: parsed.slip_no,
    billDate: parsed.bill_date,
    excludeTripId: exclude_trip_id ? Number(exclude_trip_id) : undefined,
  });
  if (duplicate) {
    throw new AppError(duplicateBillMessage(duplicate), 409);
  }
  if (!parsed.goods_weight) {
    throw new AppError('Could not read weight from this bill. Capture Net Weight, Nett Weight, or Accepted Qty clearly.', 422);
  }

  res.json({
    success: true,
    message: parsed.weight_source === 'ACCEPTED'
      ? 'Accepted quantity read from bill.'
      : 'Net / Nett weight read from bill.',
    data: {
      ...parsed,
      weigh_bill_hash: hash,
      ocr_preview: ocrText.slice(0, 1200),
    },
  });
});

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
  const unit_id = req.query.unit_id as string;
  const route_id = req.query.route_id as string;
  const created_by = req.query.created_by as string;
  const owner_id = req.query.owner_id as string;
  const search = (req.query.search as string || '').trim();

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (isFleetScoped(req)) {
    paramIdx = applyVehicleScope(req, conditions, params, paramIdx, 't.vehicle_id');
  } else if (!hasFleetWideAccess(req) && req.user?.id) {
    conditions.push(`t.created_by = $${paramIdx}`); params.push(req.user.id); paramIdx++;
  } else if (created_by) {
    conditions.push(`t.created_by = $${paramIdx}`); params.push(created_by); paramIdx++;
  }

  if (status) {
    conditions.push(`t.status = $${paramIdx}`);
    params.push(status);
    paramIdx++;
  } else {
    // By default, exclude DRAFT trips so unfinished drafts never show in official trips lists
    conditions.push("t.status != 'DRAFT'");
  }
  if (party_id) { conditions.push(`t.party_id = $${paramIdx}`); params.push(party_id); paramIdx++; }
  if (driver_id) { conditions.push(`t.driver_id = $${paramIdx}`); params.push(driver_id); paramIdx++; }
  if (vehicle_id) { conditions.push(`t.vehicle_id = $${paramIdx}`); params.push(vehicle_id); paramIdx++; }
  if (owner_id) { conditions.push(`v.owner_id = $${paramIdx}`); params.push(parseInt(owner_id)); paramIdx++; }
  if (unit_id) { conditions.push(`t.unit_id = $${paramIdx}`); params.push(unit_id); paramIdx++; }
  if (route_id) { conditions.push(`t.route_id = $${paramIdx}`); params.push(route_id); paramIdx++; }
  if (from_date) { conditions.push(`t.trip_date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`t.trip_date <= $${paramIdx}`); params.push(to_date); paramIdx++; }
  if (search) {
    conditions.push(`(v.lorry_number ILIKE $${paramIdx} OR d.name ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx} OR o.name ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const countSql = search
    ? `SELECT COUNT(*) FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     WHERE ${where}`
    : `SELECT COUNT(*) FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     WHERE ${where}`;

  const listSql = `SELECT t.*, 
            COALESCE(s.advance_paid, t.advance_paid) as advance_paid,
            t.advance_paid as initial_trip_advance,
            GREATEST(0, COALESCE(s.advance_paid, t.advance_paid) - COALESCE(t.advance_paid, 0)) as additional_advance_paid,
            v.lorry_number, v.goodshed_loading_expense,
            o.id as owner_id, o.name as owner_name, o.mobile_number as owner_mobile,
            d.name as driver_name, p.name as party_name,
            r.from_location, r.to_location, u.name as unit_name,
            u.abbreviation as unit_abbreviation,
            COALESCE(pay.total_received, 0) as total_received,
            (t.total_freight - COALESCE(pay.total_received, 0)) as balance_due,
            s.id as settlement_id,
            s.settlement_status,
            s.previous_driver_balance,
            s.net_balance_to_driver,
            s.balance_to_driver,
            s.payment_mode as settlement_payment_mode,
            s.paid_amount as settlement_paid_amount,
            COALESCE(s.prior_deficit_deduction, t.prior_deficit_deduction, 0) as prior_deficit_deduction,
            COALESCE(s.total_expenses, COALESCE(exp.total_expenses, 0)) as total_expenses,
            (COALESCE(s.advance_paid, t.advance_paid) - COALESCE(s.total_expenses, COALESCE(exp.total_expenses, 0))) as trip_driver_balance,
            '[]'::json as expense_items,
            '[]'::json as truck_advances
     FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     JOIN units u ON t.unit_id = u.id
     LEFT JOIN settlements s ON s.trip_id = t.id
     LEFT JOIN (
       SELECT trip_id, SUM(received_amount) as total_received
       FROM trip_payments
       GROUP BY trip_id
     ) pay ON pay.trip_id = t.id
     LEFT JOIN (
       SELECT trip_id, SUM(amount) as total_expenses
       FROM driver_expenses
       GROUP BY trip_id
     ) exp ON exp.trip_id = t.id
     WHERE ${where}
     ORDER BY t.trip_date DESC, t.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;

  const [countResult, result] = await Promise.all([
    query(countSql, params),
    query(listSql, [...params, limit, offset]),
  ]);
  const total = parseInt(countResult.rows[0].count);

  res.json({ success: true, message: 'Trips retrieved.', data: { items: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

export const getTripById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT t.*, 
            COALESCE(s.advance_paid, t.advance_paid) as advance_paid,
            t.advance_paid as initial_trip_advance,
            GREATEST(0, COALESCE(s.advance_paid, t.advance_paid) - COALESCE(t.advance_paid, 0)) as additional_advance_paid,
            v.lorry_number, v.goodshed_loading_expense,
            o.id as owner_id, o.name as owner_name, o.mobile_number as owner_mobile,
            d.name as driver_name, d.mobile_number as driver_mobile,
            p.name as party_name, p.mobile_number as party_mobile,
            r.from_location, r.to_location, u.name as unit_name, u.abbreviation as unit_abbreviation,
            (SELECT COALESCE(SUM(received_amount), 0) FROM trip_payments WHERE trip_id = t.id) as total_received,
            (t.total_freight - COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0)) as balance_due,
            s.id as settlement_id,
            s.settlement_status,
            s.previous_driver_balance,
            s.net_balance_to_driver,
            s.balance_to_driver,
            s.payment_mode as settlement_payment_mode,
            s.paid_amount as settlement_paid_amount,
            COALESCE(s.prior_deficit_deduction, t.prior_deficit_deduction, 0) as prior_deficit_deduction,
            COALESCE(s.total_expenses, (SELECT COALESCE(SUM(de.amount), 0) FROM driver_expenses de WHERE de.trip_id = t.id), 0) as total_expenses,
            (COALESCE(s.advance_paid, t.advance_paid) - COALESCE(s.total_expenses, (SELECT COALESCE(SUM(de.amount), 0) FROM driver_expenses de WHERE de.trip_id = t.id), 0)) as trip_driver_balance,
            (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'id', de.id,
                    'expense_type', de.expense_type,
                    'description', de.description,
                    'amount', de.amount,
                    'created_at', de.created_at
                  ) ORDER BY de.id ASC
                ),
                '[]'::json
              )
              FROM driver_expenses de
              WHERE de.trip_id = t.id
            ) as expense_items,
            (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'id', ta.id,
                    'amount', ta.amount,
                    'advance_date', ta.advance_date,
                    'notes', ta.notes,
                    'manager_name', u2.name
                  ) ORDER BY ta.id ASC
                ),
                '[]'::json
              )
              FROM truck_advances ta
              LEFT JOIN users u2 ON ta.manager_id = u2.id
              WHERE ta.trip_id = t.id
            ) as truck_advances
     FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     JOIN units u ON t.unit_id = u.id
     LEFT JOIN settlements s ON s.trip_id = t.id
     WHERE t.id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) throw new AppError('Trip not found.', 404);

  if (isFleetScoped(req)) {
    assertOwnerVehicle(req, result.rows[0].vehicle_id);
  } else if (!hasFleetWideAccess(req) && req.user?.id && result.rows[0].created_by !== req.user.id) {
    throw new AppError('You do not have permission to view this trip.', 403);
  }

  res.json({ success: true, message: 'Trip retrieved.', data: result.rows[0] });
});

export const createTrip = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    vehicle_id, driver_id, party_id, route_id, unit_id, freight_rate_id, freight_rate, goods_weight, advance_paid, trip_date, cancel_draft_trip_id,
    weigh_bill_hash, weigh_bill_slip_no, weigh_bill_vehicle_no, weigh_bill_net_weight, weigh_bill_accepted_weight, weigh_bill_image,
    weigh_bill_party_name, weigh_bill_unit_name, weigh_bill_date,
  } = req.body;

  if (!vehicle_id || !driver_id || !party_id || !route_id || !freight_rate || !goods_weight || !trip_date) {
    throw new AppError('Vehicle, driver, party, route, freight rate, weight and date are required.', 400);
  }
  assertOwnerVehicle(req, vehicle_id);
  if (goods_weight <= 0) throw new AppError('Goods weight must be greater than 0.', 400);
  if (freight_rate < 0) throw new AppError('Freight rate must be >= 0.', 400);
  if ((advance_paid || 0) < 0) throw new AppError('Advance paid must be >= 0.', 400);

  let effectiveUnitId = unit_id;
  if (!effectiveUnitId) {
    const unitRes = await query(`SELECT id FROM units WHERE status = 'ACTIVE' ORDER BY id ASC LIMIT 1`);
    effectiveUnitId = unitRes.rows[0]?.id || 1;
  }

  // Backend calculates total freight — round off to whole rupees
  const total_freight = Math.round(parseFloat(goods_weight) * parseFloat(freight_rate));

  // Normalize date format if provided as DD-MM-YYYY
  let normalized_trip_date = trip_date;
  if (typeof trip_date === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(trip_date.trim())) {
    const [d, m, y] = trip_date.trim().split('-');
    normalized_trip_date = `${y}-${m}-${d}`;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // If a previous DRAFT trip exists (manager went back and changed details), delete it cleanly
    if (cancel_draft_trip_id) {
      await client.query(`DELETE FROM driver_expenses WHERE trip_id = $1`, [cancel_draft_trip_id]);
      await client.query(`DELETE FROM trips WHERE id = $1 AND status = 'DRAFT'`, [cancel_draft_trip_id]);
      await createAuditLog(req.user?.id, 'CANCEL_DRAFT_TRIP', 'TRIPS', cancel_draft_trip_id, { reason: 'Manager resubmitted with updated details' });
    }

    const entered_advance = Math.max(0, Math.round(parseFloat(advance_paid) || 0));

    // Calculate if admin owes driver any money from prior trips (unsettled pending balance)
    const driverDeficitRes = await client.query(
      `SELECT
         COALESCE((
           SELECT SUM(
             COALESCE(s.total_expenses, (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = t.id), 0)
           )
           FROM trips t LEFT JOIN settlements s ON s.trip_id = t.id
           WHERE t.driver_id = $1 AND t.status NOT IN ('CANCELLED', 'DRAFT')
         ), 0) -
         (
           COALESCE((
             SELECT SUM(da.amount) FROM driver_advances da
             WHERE da.driver_id = $1
               AND (da.trip_id IS NULL OR NOT EXISTS (SELECT 1 FROM truck_advances ta2 WHERE ta2.trip_id = da.trip_id))
           ), 0) +
           COALESCE((SELECT SUM(oa.amount) FROM owner_advances oa WHERE oa.driver_id = $1), 0) +
           COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = $1), 0) +
           COALESCE((SELECT SUM(tr.advance_paid) FROM trips tr WHERE tr.driver_id = $1 AND tr.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr.id) AND NOT EXISTS (SELECT 1 FROM driver_advances da3 WHERE da3.trip_id = tr.id)), 0) +
           COALESCE((SELECT SUM(dsp.amount) FROM driver_settlement_payments dsp JOIN settlements st ON dsp.settlement_id = st.id JOIN trips tr ON st.trip_id = tr.id WHERE tr.driver_id = $1), 0)
         ) as pending_deficit`,
      [driver_id]
    );

    const pendingDeficit = Math.max(0, Math.round(parseFloat(driverDeficitRes.rows[0]?.pending_deficit || 0)));
    const deduction = Math.min(entered_advance, pendingDeficit);
    const effective_trip_advance = Math.max(0, entered_advance - deduction);

    const billHash = weigh_bill_hash ? String(weigh_bill_hash) : null;
    const billSlip = weigh_bill_slip_no ? String(weigh_bill_slip_no) : null;
    const billVehicle = weigh_bill_vehicle_no ? normalizeVehicleNo(weigh_bill_vehicle_no) : null;
    if (billVehicle) {
      const vehRes = await client.query(`SELECT lorry_number FROM vehicles WHERE id = $1`, [vehicle_id]);
      const selectedTruck = normalizeVehicleNo(vehRes.rows[0]?.lorry_number);
      if (selectedTruck && !vehicleNosMatch(selectedTruck, billVehicle)) {
        throw new AppError(
          `Truck number on the bill (${weigh_bill_vehicle_no}) does not match selected truck (${vehRes.rows[0]?.lorry_number}).`,
          422
        );
      }
    }
    const billParty = weigh_bill_party_name ? String(weigh_bill_party_name) : '';
    const billUnit = weigh_bill_unit_name ? String(weigh_bill_unit_name) : '';
    if (billParty || billUnit) {
      const namesRes = await client.query(
        `SELECT p.name as party_name, r.to_location as unit_name
         FROM parties p, routes r
         WHERE p.id = $1 AND r.id = $2`,
        [party_id, route_id]
      );
      const selectedPartyName = namesRes.rows[0]?.party_name || '';
      const selectedUnitName = namesRes.rows[0]?.unit_name || '';
      const sources = [billParty, billUnit];
      const partyOk = nameAppearsOnBill(selectedPartyName, sources);
      const unitOk = nameAppearsOnBill(selectedUnitName, sources);
      if (!partyOk || !unitOk) {
        throw new AppError(
          `Party, unit and truck on the bill must match the selected trip. Bill party/unit (${[billParty, billUnit].filter(Boolean).join(' / ')}) vs selected party (${selectedPartyName}) / unit (${selectedUnitName}).`,
          422
        );
      }
    }
    const billDate = toBillDateIso(weigh_bill_date);
    if (billHash || billSlip) {
      const duplicate = await findDuplicateWeighBill(
        {
          hash: billHash,
          slipNo: billSlip,
          billDate,
          excludeTripId: cancel_draft_trip_id ? Number(cancel_draft_trip_id) : undefined,
        },
        (sqlText, params) => client.query(sqlText, params)
      );
      if (duplicate) {
        throw new AppError(duplicateBillMessage(duplicate), 409);
      }
    }

    const result = await client.query(
      `INSERT INTO trips (vehicle_id, driver_id, party_id, route_id, unit_id, freight_rate_id,
       freight_rate, goods_weight, total_freight, advance_paid, prior_deficit_deduction, trip_date, status, created_by,
       weigh_bill_hash, weigh_bill_slip_no, weigh_bill_vehicle_no, weigh_bill_net_weight, weigh_bill_accepted_weight, weigh_bill_image, weigh_bill_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'DRAFT', $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [vehicle_id, driver_id, party_id, route_id, effectiveUnitId, freight_rate_id || null,
       freight_rate, goods_weight, total_freight, entered_advance, deduction, normalized_trip_date, req.user?.id,
       billHash, billSlip, billVehicle, weigh_bill_net_weight || null, weigh_bill_accepted_weight || null, weigh_bill_image || null, billDate]
    );

    // If a portion of advance was deducted to settle prior trip dues:
    if (deduction > 0) {
      let remainingDeduction = deduction;

      // Partially or fully settle any prior PENDING settlements for this driver
      const pendingSettlements = await client.query(
        `SELECT s.id, s.trip_id, s.balance_to_driver, s.net_balance_to_driver, s.paid_amount
         FROM settlements s
         JOIN trips t ON s.trip_id = t.id
         WHERE t.driver_id = $1 AND s.settlement_status = 'PENDING' AND COALESCE(s.net_balance_to_driver, s.balance_to_driver, 0) > 0
         ORDER BY t.trip_date ASC, t.id ASC, s.created_at ASC`,
        [driver_id]
      );

      for (const pRow of pendingSettlements.rows) {
        if (remainingDeduction <= 0) break;
        const owed = Math.max(0, Math.round(parseFloat(pRow.net_balance_to_driver ?? pRow.balance_to_driver ?? 0)));
        const settleAmt = Math.min(remainingDeduction, owed);
        const remainingOwed = owed - settleAmt;
        const newPaidAmount = Math.round((parseFloat(pRow.paid_amount || 0) + settleAmt) * 100) / 100;
        const isSettled = remainingOwed <= 0;
        const noteAddition = isSettled
          ? `Fully settled via ₹${settleAmt} deduction from Trip #${result.rows[0].id} advance`
          : `Partially settled: ₹${settleAmt} adjusted from Trip #${result.rows[0].id} advance (Remaining balance: ₹${remainingOwed})`;

        if (isSettled) {
          await client.query(
            `UPDATE settlements
             SET settlement_status = 'SETTLED',
                 payment_mode = 'ADJUSTED_ADVANCE',
                 payment_date = $1,
                 paid_amount = $2,
                 net_balance_to_driver = $3,
                 notes = CASE WHEN notes IS NULL OR notes = '' THEN $4::text ELSE notes || ' | ' || $4::text END,
                 settled_by = $5,
                 settled_at = NOW(),
                 updated_at = NOW()
             WHERE id = $6`,
            [normalized_trip_date, newPaidAmount, remainingOwed, noteAddition, req.user?.id, pRow.id]
          );
        } else {
          await client.query(
            `UPDATE settlements
             SET settlement_status = 'PENDING',
                 payment_date = $1,
                 paid_amount = $2,
                 net_balance_to_driver = $3,
                 notes = CASE WHEN notes IS NULL OR notes = '' THEN $4::text ELSE notes || ' | ' || $4::text END,
                 updated_at = NOW()
             WHERE id = $5`,
            [normalized_trip_date, newPaidAmount, remainingOwed, noteAddition, pRow.id]
          );
        }

        await client.query(
          `INSERT INTO driver_settlement_payments (settlement_id, trip_id, amount, payment_mode, payment_date, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [pRow.id, pRow.trip_id, settleAmt, 'ADJUSTED_ADVANCE', normalized_trip_date, `Adjusted ₹${settleAmt} from Trip #${result.rows[0].id} advance`, req.user?.id]
        );

        remainingDeduction -= settleAmt;
      }
    }

    if (entered_advance > 0) {
      await client.query(
        `INSERT INTO truck_advances (vehicle_id, driver_id, manager_id, amount, advance_date, notes, created_by, trip_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          vehicle_id,
          driver_id,
          req.user?.id,
          entered_advance,
          normalized_trip_date,
          `Advance for Trip #${result.rows[0].id}${deduction > 0 ? ` (₹${deduction} adjusted to settle prior trip dues)` : ''}`,
          req.user?.id,
          result.rows[0].id,
        ]
      );
    }

    await client.query('COMMIT');
    await createAuditLog(req.user?.id, 'CREATE_TRIP', 'TRIPS', result.rows[0].id, {
      trip_date,
      total_freight,
      status: 'DRAFT',
      entered_advance,
      prior_balance_deducted: deduction,
      effective_advance: effective_trip_advance,
    });

    res.status(201).json({
      success: true,
      message: deduction > 0
        ? `Trip created. ₹${deduction.toLocaleString('en-IN')} was deducted from advance to settle prior balance owed to driver. Effective advance: ₹${effective_trip_advance.toLocaleString('en-IN')}.`
        : 'Trip created successfully.',
      data: {
        ...result.rows[0],
        entered_advance,
        prior_balance_deducted: deduction,
        effective_advance: effective_trip_advance,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export const deleteDraftTrip = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const draftCheck = await query(`SELECT id FROM trips WHERE id = $1 AND status = 'DRAFT'`, [id]);
  if (draftCheck.rows.length === 0) {
    throw new AppError('Draft trip not found or already finalized.', 404);
  }
  await query('DELETE FROM driver_expenses WHERE trip_id = $1', [id]);
  await query('DELETE FROM trips WHERE id = $1 AND status = \'DRAFT\'', [id]);
  await createAuditLog(req.user?.id, 'DELETE_DRAFT_TRIP', 'TRIPS', parseInt(id as string), { reason: 'Draft trip cancelled' });
  res.json({ success: true, message: 'Draft trip discarded successfully.' });
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

