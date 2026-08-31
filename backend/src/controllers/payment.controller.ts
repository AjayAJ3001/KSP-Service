import { Response } from 'express';
import { query, getClient } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

export const getTripPayments = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { trip_id } = req.params;
  const result = await query(
    `SELECT tp.*, u.name as created_by_name FROM trip_payments tp
     JOIN users u ON tp.created_by = u.id
     WHERE tp.trip_id = $1 ORDER BY tp.payment_date DESC, tp.created_at DESC`,
    [trip_id]
  );
  res.json({ success: true, message: 'Payments retrieved.', data: result.rows });
});

export const addPayment = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { trip_id } = req.params;
  const { received_amount, payment_date, notes } = req.body;

  if (!received_amount || received_amount < 0) {
    throw new AppError('Received amount must be >= 0.', 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get trip details
    const tripResult = await client.query(
      `SELECT t.total_freight, t.status,
              COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0) as total_received
       FROM trips t WHERE t.id = $1 FOR UPDATE`,
      [trip_id]
    );

    if (tripResult.rows.length === 0) throw new AppError('Trip not found.', 404);
    const trip = tripResult.rows[0];

    if (trip.status === 'SETTLED' || trip.status === 'CANCELLED') {
      throw new AppError('Cannot add payment to a settled or cancelled trip.', 400);
    }

    const newTotal = parseFloat(trip.total_received) + parseFloat(received_amount);
    const balance_due = parseFloat(trip.total_freight) - newTotal;

    if (newTotal > parseFloat(trip.total_freight)) {
      throw new AppError(`Payment amount exceeds remaining balance of ₹${balance_due.toFixed(2)}.`, 400);
    }

    // Determine payment status
    const payment_status = balance_due <= 0 ? 'RECEIVED' : 'PARTIAL';

    // Insert payment
    const paymentResult = await client.query(
      `INSERT INTO trip_payments (trip_id, received_amount, payment_date, balance_due, payment_status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [trip_id, received_amount, payment_date || new Date(), balance_due > 0 ? balance_due : 0, payment_status, notes || null, req.user?.id]
    );

    // Update trip status
    const newTripStatus = balance_due <= 0 ? 'SETTLED' : 'PARTIALLY_PAID';
    await client.query(`UPDATE trips SET status = $1, updated_at = NOW() WHERE id = $2`, [newTripStatus, trip_id]);

    await client.query('COMMIT');

    await createAuditLog(req.user?.id, 'ADD_PAYMENT', 'PAYMENTS', paymentResult.rows[0].id, { trip_id, received_amount, balance_due });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      data: {
        ...paymentResult.rows[0],
        total_received: newTotal,
        trip_status: newTripStatus,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const getPartyLedger = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { party_id } = req.params;
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;

  let conditions = ['t.party_id = $1'];
  const params: any[] = [party_id];
  let paramIdx = 2;

  if (from_date) { conditions.push(`t.trip_date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`t.trip_date <= $${paramIdx}`); params.push(to_date); paramIdx++; }

  const result = await query(
    `SELECT t.id as trip_id, t.trip_date, r.from_location, r.to_location,
            t.total_freight as freight, t.goods_weight, t.freight_rate, t.status,
            COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0) as received_amount,
            (t.total_freight - COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0)) as balance_due,
            CASE 
              WHEN t.status = 'SETTLED' THEN 'Settled'
              WHEN (t.total_freight - COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0)) > 0 
                   AND COALESCE((SELECT SUM(received_amount) FROM trip_payments WHERE trip_id = t.id), 0) > 0 THEN 'Partial'
              ELSE 'Pending'
            END as payment_status
     FROM trips t
     JOIN routes r ON t.route_id = r.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.trip_date DESC`,
    params
  );

  res.json({ success: true, message: 'Party ledger retrieved.', data: result.rows });
});

export const deletePayment = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT * FROM trip_payments WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Payment not found.', 404);

  const trip_id = existing.rows[0].trip_id;
  await query('DELETE FROM trip_payments WHERE id = $1', [id]);

  // Re-calculate trip status
  const tripResult = await query('SELECT total_freight FROM trips WHERE id = $1', [trip_id]);
  if (tripResult.rows.length > 0) {
    const totalFreight = parseFloat(tripResult.rows[0].total_freight);
    const sumResult = await query('SELECT COALESCE(SUM(received_amount), 0) as total_received FROM trip_payments WHERE trip_id = $1', [trip_id]);
    const totalReceived = parseFloat(sumResult.rows[0].total_received);

    let newStatus = 'PAYMENT_PENDING';
    if (totalReceived >= totalFreight) {
      newStatus = 'SETTLED';
    } else if (totalReceived > 0) {
      newStatus = 'PARTIALLY_PAID';
    }
    await query('UPDATE trips SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, trip_id]);
  }

  await createAuditLog(req.user?.id, 'DELETE_PAYMENT', 'PAYMENTS', id, existing.rows[0]);
  res.json({ success: true, message: 'Payment record deleted successfully.' });
});

