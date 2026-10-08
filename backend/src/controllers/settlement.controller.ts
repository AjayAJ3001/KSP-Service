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
            u.name as settled_by_name
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

    // Update trip status to SETTLED only if freight payment has also been fully received
    const pmtSum = await client.query(
      `SELECT COALESCE(SUM(received_amount), 0) as total_received FROM trip_payments WHERE trip_id = $1`,
      [trip_id]
    );
    const totalRecv = parseFloat(pmtSum.rows[0].total_received);
    const totalFr = parseFloat(trip.total_freight);
    if (totalRecv >= totalFr) {
      await client.query(`UPDATE trips SET status = 'SETTLED', updated_at = NOW() WHERE id = $1`, [trip_id]);
    }

    const expensesResult = await client.query(
      `SELECT expense_type, description, amount FROM driver_expenses WHERE trip_id = $1 ORDER BY id ASC`,
      [trip_id]
    );

    await client.query('COMMIT');

    await createAuditLog(req.user?.id, 'GENERATE_SETTLEMENT', 'SETTLEMENTS', settlementResult.rows[0].id, { trip_id, balance_to_driver });

    res.status(201).json({
      success: true,
      message: 'Settlement generated successfully.',
      data: { ...settlementResult.rows[0], ...trip, expense_items: expensesResult.rows },
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
  if (!['CASH', 'UPI', 'BANK_TRANSFER'].includes(mode)) {
    throw new AppError('Payment mode must be CASH, UPI, or BANK_TRANSFER.', 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const sResult = await client.query(`SELECT * FROM settlements WHERE id = $1 FOR UPDATE`, [id]);
    if (sResult.rows.length === 0) throw new AppError('Settlement not found.', 404);
    const settlement = sResult.rows[0];

    const amount = paid_amount !== undefined && paid_amount !== null
      ? parseFloat(paid_amount)
      : Math.abs(parseFloat(settlement.balance_to_driver || 0));
    const payDate = payment_date || new Date().toISOString().split('T')[0];

    // Record into driver_settlement_payments table
    await client.query(
      `INSERT INTO driver_settlement_payments (settlement_id, trip_id, amount, payment_mode, payment_date, reference_no, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [settlement.id, settlement.trip_id, amount, mode, payDate, reference_no || null, notes || null, req.user?.id]
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
      [mode, payDate, amount, reference_no || null, notes || null, req.user?.id, id]
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
      message: `Driver settlement of ₹${amount.toFixed(2)} recorded successfully via ${mode}.`,
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

