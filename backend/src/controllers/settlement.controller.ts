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
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;
  const driver_id = req.query.driver_id as string;
  const vehicle_id = req.query.vehicle_id as string;
  const party_id = req.query.party_id as string;
  const search = (req.query.search as string || '').trim();

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (req.user?.role === 'TRANSPORT_USER') {
    conditions.push(`t.created_by = $${paramIdx}`); params.push(req.user.id); paramIdx++;
  }
  if (status) { conditions.push(`s.settlement_status = $${paramIdx}`); params.push(status); paramIdx++; }
  if (from_date) { conditions.push(`t.trip_date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`t.trip_date <= $${paramIdx}`); params.push(to_date); paramIdx++; }
  if (driver_id) { conditions.push(`t.driver_id = $${paramIdx}`); params.push(parseInt(driver_id)); paramIdx++; }
  if (vehicle_id) { conditions.push(`t.vehicle_id = $${paramIdx}`); params.push(parseInt(vehicle_id)); paramIdx++; }
  if (party_id) { conditions.push(`t.party_id = $${paramIdx}`); params.push(parseInt(party_id)); paramIdx++; }
  if (search) {
    conditions.push(`(v.lorry_number ILIKE $${paramIdx} OR d.name ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx} OR s.id::text ILIKE $${paramIdx} OR t.id::text ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*) FROM settlements s JOIN trips t ON s.trip_id = t.id WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT s.*, t.trip_date, t.advance_paid, t.total_freight, t.goods_weight, t.freight_rate,
            v.lorry_number, d.name as driver_name, d.mobile_number as driver_mobile,
            p.name as party_name, r.from_location, r.to_location,
            u.name as settled_by_name,
            (
              COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(tr.advance_paid) FROM trips tr WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr.id)), 0) +
              COALESCE((SELECT SUM(dsp.amount) FROM driver_settlement_payments dsp JOIN settlements st ON dsp.settlement_id = st.id JOIN trips tr ON st.trip_id = tr.id WHERE tr.driver_id = d.id), 0) -
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
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     LEFT JOIN users u ON s.settled_by = u.id
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
            u.name as settled_by_name,
            (
              COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(tr.advance_paid) FROM trips tr WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr.id)), 0) +
              COALESCE((SELECT SUM(dsp.amount) FROM driver_settlement_payments dsp JOIN settlements st ON dsp.settlement_id = st.id JOIN trips tr ON st.trip_id = tr.id WHERE tr.driver_id = d.id), 0) -
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
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     LEFT JOIN users u ON s.settled_by = u.id
     WHERE s.trip_id = $1`,
    [trip_id]
  );

  if (result.rows.length === 0) throw new AppError('Settlement not found for this trip.', 404);
  res.json({ success: true, message: 'Settlement retrieved.', data: result.rows[0] });
});

export const getSettlementById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const result = await query(
    `SELECT s.*, t.trip_date, t.advance_paid, t.total_freight, t.goods_weight, t.freight_rate,
            v.lorry_number, d.name as driver_name, d.mobile_number as driver_mobile,
            p.name as party_name, r.from_location, r.to_location,
            u.name as settled_by_name,
            (
              COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = d.id), 0) +
              COALESCE((SELECT SUM(tr.advance_paid) FROM trips tr WHERE tr.driver_id = d.id AND tr.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = tr.id)), 0) +
              COALESCE((SELECT SUM(dsp.amount) FROM driver_settlement_payments dsp JOIN settlements st ON dsp.settlement_id = st.id JOIN trips tr ON st.trip_id = tr.id WHERE tr.driver_id = d.id), 0) -
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
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     LEFT JOIN users u ON s.settled_by = u.id
     WHERE s.id = $1`,
    [id]
  );

  if (result.rows.length === 0) throw new AppError('Settlement not found.', 404);
  res.json({ success: true, message: 'Settlement retrieved.', data: result.rows[0] });
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
    if (req.user?.role === 'TRANSPORT_USER' && trip.created_by !== req.user.id) {
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

    const total_expenses = parseFloat(expenseResult.rows[0].total) || 0;
    const trip_advance_paid = parseFloat(trip.advance_paid) || 0;

    // === DRIVER ADVANCE BALANCE DEDUCTION LOGIC ===
    // "again the driver come another trip means need to take the expenses amount from driver advance balance"
    // Look up prior advance balance for this driver outside this trip
    const driverAdvanceStats = await client.query(
      `SELECT
         COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.driver_id = $1), 0) +
         COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.driver_id = $1 AND (ta.trip_id IS NULL OR ta.trip_id != $2)), 0) +
         COALESCE((SELECT SUM(t.advance_paid) FROM trips t WHERE t.driver_id = $1 AND t.id != $2 AND t.status NOT IN ('CANCELLED', 'DRAFT') AND NOT EXISTS (SELECT 1 FROM truck_advances ta WHERE ta.trip_id = t.id)), 0) +
         COALESCE((SELECT SUM(dsp.amount) FROM driver_settlement_payments dsp JOIN settlements s ON dsp.settlement_id = s.id JOIN trips t ON s.trip_id = t.id WHERE t.driver_id = $1 AND t.id != $2), 0)
         as total_prior_advance_given,

         COALESCE((
           SELECT SUM(
             COALESCE(s.total_expenses, (SELECT SUM(de.amount) FROM driver_expenses de WHERE de.trip_id = t.id), 0)
           )
           FROM trips t
           LEFT JOIN settlements s ON s.trip_id = t.id
           WHERE t.driver_id = $1 AND t.id != $2 AND t.status NOT IN ('CANCELLED', 'DRAFT')
         ), 0) as total_prior_expenses
      `,
      [trip.driver_id, trip_id]
    );

    const total_prior_advance_given = parseFloat(driverAdvanceStats.rows[0]?.total_prior_advance_given || 0);
    const total_prior_expenses = parseFloat(driverAdvanceStats.rows[0]?.total_prior_expenses || 0);

    // Prior advance cash in driver hand before this trip (positive = driver holds cash in hand)
    const previous_driver_balance = total_prior_advance_given - total_prior_expenses;
    const total_advance_available = previous_driver_balance + trip_advance_paid;

    let balance_to_driver = 0;
    let net_balance_to_driver = 0;
    let auto_settle = false;

    if (total_advance_available >= total_expenses) {
      // Advance completely covers trip expenses!
      const remaining_advance_in_hand = total_advance_available - total_expenses;
      balance_to_driver = 0;
      net_balance_to_driver = -remaining_advance_in_hand; // negative = surplus advance held by driver
      auto_settle = true;
    } else {
      // Expenses exceed available advance; company owes driver the difference
      const excess = total_expenses - total_advance_available;
      balance_to_driver = excess;
      net_balance_to_driver = excess;
      auto_settle = false;
    }

    const initialStatus = auto_settle ? 'SETTLED' : 'PENDING';
    const initialMode = auto_settle ? 'ADJUSTED_ADVANCE' : null;
    const initialPayDate = auto_settle ? (trip.trip_date || new Date().toISOString().split('T')[0]) : null;
    const initialNotes = auto_settle
      ? `Expenses ₹${total_expenses.toLocaleString('en-IN')} deducted from advance balance. Driver holds ₹${Math.abs(net_balance_to_driver).toLocaleString('en-IN')} advance in hand.`
      : null;

    // Create settlement with carry-forward fields
    const settlementResult = await client.query(
      `INSERT INTO settlements (
         trip_id, total_freight, total_expenses, advance_paid, balance_to_driver,
         previous_driver_balance, net_balance_to_driver, settlement_status,
         payment_mode, payment_date, paid_amount, notes, settled_by, settled_at, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, ${auto_settle ? 'NOW()' : 'NULL'}, $14)
       RETURNING *`,
      [
        trip_id,
        trip.total_freight,
        total_expenses,
        trip_advance_paid,
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
    const amount = isAdjusted
      ? 0
      : (paid_amount !== undefined && paid_amount !== null
          ? parseFloat(paid_amount)
          : Math.max(0, parseFloat(settlement.net_balance_to_driver ?? settlement.balance_to_driver ?? 0)));

    const payDate = payment_date || new Date().toISOString().split('T')[0];
    const finalNotes = notes || (isAdjusted ? 'Trip expenses deducted from driver advance balance' : null);

    // Record into driver_settlement_payments table
    await client.query(
      `INSERT INTO driver_settlement_payments (settlement_id, trip_id, amount, payment_mode, payment_date, reference_no, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [settlement.id, settlement.trip_id, amount, mode, payDate, reference_no || null, finalNotes, req.user?.id]
    );

    // Update settlement record
    const updatedSettlement = await client.query(
      `UPDATE settlements
       SET settlement_status = 'SETTLED',
           payment_mode = $1,
           payment_date = $2,
           paid_amount = $3,
           reference_no = $4,
           notes = $5,
           settled_by = $6,
           settled_at = NOW(),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [mode, payDate, amount, reference_no || null, finalNotes, req.user?.id, id]
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
      amount,
      payment_date: payDate,
    });

    res.json({
      success: true,
      message: isAdjusted
        ? 'Trip settlement marked settled via driver advance adjustment.'
        : `Driver settlement of ₹${amount.toFixed(2)} recorded successfully via ${mode}.`,
      data: updatedSettlement.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
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

