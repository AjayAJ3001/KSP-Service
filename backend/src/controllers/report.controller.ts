import { Response } from 'express';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { applyVehicleScope, isFleetScoped } from '../utils/ownerScope';
import { attachAdvanceBreakdown } from './settlement.controller';

export const getTripReport = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { from_date, to_date, party_id, driver_id, vehicle_id, owner_id, unit_id, status } = req.query;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (from_date) { conditions.push(`t.trip_date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`t.trip_date <= $${paramIdx}`); params.push(to_date); paramIdx++; }
  if (party_id) { conditions.push(`t.party_id = $${paramIdx}`); params.push(party_id); paramIdx++; }
  if (driver_id) { conditions.push(`t.driver_id = $${paramIdx}`); params.push(driver_id); paramIdx++; }
  if (vehicle_id) {
    const vid = parseInt(String(vehicle_id), 10);
    const allowed = !isFleetScoped(req) || (req.user?.vehicleIds || []).includes(vid);
    if (allowed && vid) {
      conditions.push(`t.vehicle_id = $${paramIdx}`);
      params.push(vid);
      paramIdx++;
    }
  }
  if (owner_id) {
    const oid = parseInt(String(owner_id), 10);
    const allowed = !isFleetScoped(req) || (req.user?.ownerIds || []).includes(oid);
    if (allowed && oid) {
      conditions.push(`v.owner_id = $${paramIdx}`);
      params.push(oid);
      paramIdx++;
    }
  }
  if (unit_id) { conditions.push(`t.unit_id = $${paramIdx}`); params.push(unit_id); paramIdx++; }
  if (status) {
    conditions.push(`t.status = $${paramIdx}`);
    params.push(status);
    paramIdx++;
  } else {
    conditions.push(`t.status != 'DRAFT'`);
  }
  paramIdx = applyVehicleScope(req, conditions, params, paramIdx, 't.vehicle_id');

  const where = conditions.join(' AND ');
  const fromSql = `
     FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     JOIN units u ON t.unit_id = u.id
     LEFT JOIN settlements s ON s.trip_id = t.id
     LEFT JOIN (
       SELECT trip_id,
              SUM(received_amount) as total_received,
              json_agg(
                json_build_object(
                  'payment_date', payment_date,
                  'received_amount', received_amount,
                  'balance_due', balance_due,
                  'payment_status', payment_status,
                  'notes', notes
                ) ORDER BY id
              ) as payment_items
       FROM trip_payments
       GROUP BY trip_id
     ) pay ON pay.trip_id = t.id
     LEFT JOIN (
       SELECT trip_id,
              SUM(amount) as total_expenses,
              json_agg(
                json_build_object(
                  'expense_type', expense_type,
                  'description', description,
                  'amount', amount
                ) ORDER BY id
              ) as expense_items
       FROM driver_expenses
       GROUP BY trip_id
     ) exp ON exp.trip_id = t.id
     LEFT JOIN (
       SELECT trip_id, SUM(amount) as manager_advance
       FROM truck_advances
       GROUP BY trip_id
     ) ta ON ta.trip_id = t.id
     LEFT JOIN (
       SELECT settlement_id, SUM(amount) as driver_cash_paid
       FROM driver_settlement_payments
       GROUP BY settlement_id
     ) dsp ON dsp.settlement_id = s.id`;

  const result = await query(
    `SELECT t.id, t.id as trip_id, t.driver_id, t.trip_date, t.goods_weight, t.freight_rate, t.total_freight,
            t.advance_paid as initial_trip_advance,
            COALESCE(s.advance_paid, t.advance_paid, 0) as advance_paid,
            t.status,
            v.lorry_number, v.owner_id, o.name as owner_name, o.mobile_number as owner_mobile,
            d.name as driver_name, d.mobile_number as driver_mobile,
            p.name as party_name,
            r.from_location, r.to_location, u.name as unit_name,
            COALESCE(pay.total_received, 0) as total_received,
            COALESCE(pay.payment_items, '[]'::json) as payment_items,
            (t.total_freight - COALESCE(pay.total_received, 0)) as balance_due,
            COALESCE(s.total_expenses, COALESCE(exp.total_expenses, 0), 0) as total_expenses,
            COALESCE(exp.expense_items, '[]'::json) as expense_items,
            COALESCE(ta.manager_advance, t.advance_paid, 0) as manager_advance,
            s.id as settlement_id,
            s.settlement_status,
            COALESCE(s.paid_amount, 0) as driver_paid_amount,
            COALESCE(dsp.driver_cash_paid, s.paid_amount, 0) as driver_cash_paid,
            COALESCE(s.prior_deficit_deduction, t.prior_deficit_deduction, 0) as prior_deficit_deduction,
            s.balance_to_driver,
            s.net_balance_to_driver
     ${fromSql}
     WHERE ${where}
     ORDER BY t.trip_date DESC, t.id DESC`,
    params
  );

  const summaryResult = await query(
    `SELECT COUNT(*) as total_trips,
            COALESCE(SUM(t.total_freight), 0) as total_freight,
            COALESCE(SUM(pay.total_received), 0) as total_received,
            COALESCE(SUM(t.total_freight) - COALESCE(SUM(pay.total_received), 0), 0) as total_balance,
            COALESCE(SUM(COALESCE(s.total_expenses, exp.total_expenses, 0)), 0) as total_expenses,
            COALESCE(SUM(COALESCE(ta.manager_advance, t.advance_paid, 0)), 0) as total_advance
     ${fromSql}
     WHERE ${where}`,
    params
  );

  const withBreakdown = await attachAdvanceBreakdown(result.rows);
  const trips = withBreakdown.map((row: any) => {
    const expenses = parseFloat(String(row.total_expenses || 0)) || 0;
    const manager = parseFloat(String(row.manager_advance ?? row.advance_paid ?? 0)) || 0;
    const priorDeficit = parseFloat(String(row.prior_deficit_deduction || 0)) || 0;
    const effectiveManager = row.effective_manager_advance != null
      ? (parseFloat(String(row.effective_manager_advance)) || 0)
      : Math.max(0, manager - priorDeficit);
    const ownerApplied = parseFloat(String(row.owner_applied || 0)) || 0;
    const leftover = parseFloat(String(row.owner_leftover_used || 0)) || 0;
    const cashPaid = parseFloat(String(row.driver_cash_paid || row.driver_paid_amount || 0)) || 0;
    const inHand = parseFloat(String(row.owner_balance || 0)) || 0;
    const needToPay = inHand > 0 ? 0 : Math.max(0, expenses - effectiveManager - ownerApplied - leftover - cashPaid);
    let expenseItems = row.expense_items;
    if (typeof expenseItems === 'string') {
      try { expenseItems = JSON.parse(expenseItems); } catch { expenseItems = []; }
    }
    let paymentItems = row.payment_items;
    if (typeof paymentItems === 'string') {
      try { paymentItems = JSON.parse(paymentItems); } catch { paymentItems = []; }
    }
    return {
      ...row,
      expense_items: Array.isArray(expenseItems) ? expenseItems : [],
      payment_items: Array.isArray(paymentItems) ? paymentItems : [],
      need_to_pay: needToPay,
      in_hand: inHand,
      driver_cash_paid: cashPaid,
    };
  });

  res.json({
    success: true,
    message: 'Trip report retrieved.',
    data: { trips, summary: summaryResult.rows[0] },
  });
});

export const getPaymentReport = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { from_date, to_date, party_id, owner_id, vehicle_id } = req.query;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (from_date) { conditions.push(`tp.payment_date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`tp.payment_date <= $${paramIdx}`); params.push(to_date); paramIdx++; }
  if (party_id) { conditions.push(`t.party_id = $${paramIdx}`); params.push(party_id); paramIdx++; }
  if (owner_id) {
    const oid = parseInt(String(owner_id), 10);
    const allowed = !isFleetScoped(req) || (req.user?.ownerIds || []).includes(oid);
    if (allowed && oid) {
      conditions.push(`v.owner_id = $${paramIdx}`);
      params.push(oid);
      paramIdx++;
    }
  }
  if (vehicle_id) {
    const vid = parseInt(String(vehicle_id), 10);
    const allowed = !isFleetScoped(req) || (req.user?.vehicleIds || []).includes(vid);
    if (allowed && vid) {
      conditions.push(`t.vehicle_id = $${paramIdx}`);
      params.push(vid);
      paramIdx++;
    }
  }
  paramIdx = applyVehicleScope(req, conditions, params, paramIdx, 't.vehicle_id');

  const result = await query(
    `SELECT tp.id, tp.payment_date, tp.received_amount, tp.balance_due, tp.payment_status, tp.notes,
            t.trip_date, t.total_freight, p.name as party_name, r.from_location, r.to_location,
            v.lorry_number, v.owner_id, o.name as owner_name, o.mobile_number as owner_mobile,
            u.name as created_by_name
     FROM trip_payments tp
     JOIN trips t ON tp.trip_id = t.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     JOIN users u ON tp.created_by = u.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY tp.payment_date DESC`,
    params
  );

  res.json({ success: true, message: 'Payment report retrieved.', data: result.rows });
});

export const getSettlementReport = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { from_date, to_date, status, owner_id, vehicle_id } = req.query;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (from_date) { conditions.push(`s.created_at::date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`s.created_at::date <= $${paramIdx}`); params.push(to_date); paramIdx++; }
  if (status) { conditions.push(`s.settlement_status = $${paramIdx}`); params.push(status); paramIdx++; }
  if (owner_id) {
    const oid = parseInt(String(owner_id), 10);
    const allowed = !isFleetScoped(req) || (req.user?.ownerIds || []).includes(oid);
    if (allowed && oid) {
      conditions.push(`v.owner_id = $${paramIdx}`);
      params.push(oid);
      paramIdx++;
    }
  }
  if (vehicle_id) {
    const vid = parseInt(String(vehicle_id), 10);
    const allowed = !isFleetScoped(req) || (req.user?.vehicleIds || []).includes(vid);
    if (allowed && vid) {
      conditions.push(`t.vehicle_id = $${paramIdx}`);
      params.push(vid);
      paramIdx++;
    }
  }
  paramIdx = applyVehicleScope(req, conditions, params, paramIdx, 't.vehicle_id');

  const result = await query(
    `SELECT s.*, t.trip_date, t.driver_id,
            t.advance_paid as initial_trip_advance,
            v.lorry_number, v.owner_id, o.name as owner_name, o.mobile_number as owner_mobile,
            d.name as driver_name,
            p.name as party_name, r.from_location, r.to_location
     FROM settlements s
     JOIN trips t ON s.trip_id = t.id
     JOIN vehicles v ON t.vehicle_id = v.id
     LEFT JOIN owners o ON v.owner_id = o.id
     JOIN drivers d ON t.driver_id = d.id
     JOIN parties p ON t.party_id = p.id
     JOIN routes r ON t.route_id = r.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.created_at DESC`,
    params
  );

  const items = await attachAdvanceBreakdown(result.rows);
  res.json({ success: true, message: 'Settlement report retrieved.', data: items });
});

export const getAuditLogs = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  const module = req.query.module as string;
  const source = (req.query.source as string || '').toUpperCase();
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (source && source !== 'ALL') {
    conditions.push(`al.source = $${paramIdx}`);
    params.push(source);
    paramIdx++;
  }
  if (module) { conditions.push(`al.module = $${paramIdx}`); params.push(module); paramIdx++; }
  if (from_date) { conditions.push(`al.created_at::date >= $${paramIdx}`); params.push(from_date); paramIdx++; }
  if (to_date) { conditions.push(`al.created_at::date <= $${paramIdx}`); params.push(to_date); paramIdx++; }

  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*) FROM audit_logs al WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const countsResult = await query(
    `SELECT 
       COUNT(*) as total_all,
       COUNT(*) FILTER (WHERE source = 'ADMIN') as total_admin,
       COUNT(*) FILTER (WHERE source = 'MOBILE') as total_mobile
     FROM audit_logs`
  );
  const counts = countsResult.rows[0] || { total_all: 0, total_admin: 0, total_mobile: 0 };

  const result = await query(
    `SELECT al.*, u.username, u.name as user_name, u.role as user_role
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE ${where}
     ORDER BY al.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    message: 'Audit logs retrieved.',
    data: { items: result.rows, total, page, limit, totalPages: Math.ceil(total / limit), counts },
  });
});
