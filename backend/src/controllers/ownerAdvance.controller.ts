import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';
import { applyOwnerScope, assertOwnerOwner, assertOwnerVehicle, isOwnerUser, linkManagerToOwners } from '../utils/ownerScope';
import { reconcileDriverPendingSettlements } from './settlement.controller';

// ===== OWNER ADVANCES =====

export const getOwnerAdvances = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const owner_id = req.query.owner_id as string;
  const manager_id = req.query.manager_id as string;
  const driver_id = req.query.driver_id as string;
  const recipient_type = req.query.recipient_type as string;
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;
  const search = req.query.search as string;
  const payment_mode = req.query.payment_mode as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (payment_mode) {
    conditions.push(`oa.payment_mode = $${paramIdx}`);
    params.push(payment_mode);
    paramIdx++;
  }

  if (owner_id) {
    conditions.push(`oa.owner_id = $${paramIdx}`);
    params.push(parseInt(owner_id));
    paramIdx++;
  }

  if (recipient_type) {
    conditions.push(`oa.recipient_type = $${paramIdx}`);
    params.push(recipient_type);
    paramIdx++;
  }

  if (manager_id) {
    conditions.push(`oa.manager_id = $${paramIdx}`);
    params.push(parseInt(manager_id));
    paramIdx++;
  }

  if (driver_id) {
    conditions.push(`oa.driver_id = $${paramIdx}`);
    params.push(parseInt(driver_id));
    paramIdx++;
  }

  if (from_date) {
    conditions.push(`oa.advance_date >= $${paramIdx}`);
    params.push(from_date);
    paramIdx++;
  }

  if (to_date) {
    conditions.push(`oa.advance_date <= $${paramIdx}::date + interval '1 day'`);
    params.push(to_date);
    paramIdx++;
  }

  if (search) {
    conditions.push(`(o.name ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR d.name ILIKE $${paramIdx} OR v.lorry_number ILIKE $${paramIdx} OR oa.notes ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  paramIdx = applyOwnerScope(req, conditions, params, paramIdx, 'oa.owner_id');

  const where = conditions.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*) as total_count, COALESCE(SUM(oa.amount), 0) as total_amount
     FROM owner_advances oa
     JOIN owners o ON oa.owner_id = o.id
     LEFT JOIN users u ON oa.manager_id = u.id
     LEFT JOIN drivers d ON oa.driver_id = d.id
     LEFT JOIN vehicles v ON oa.vehicle_id = v.id
     WHERE ${where}`,
    params
  );

  const total = parseInt(countResult.rows[0].total_count);
  const totalAmount = parseFloat(countResult.rows[0].total_amount);

  const result = await query(
    `SELECT oa.*,
            o.name as owner_name,
            u.name as manager_name,
            d.name as driver_name,
            d.mobile_number as driver_mobile,
            v.lorry_number,
            cb.name as created_by_name
     FROM owner_advances oa
     JOIN owners o ON oa.owner_id = o.id
     LEFT JOIN users u ON oa.manager_id = u.id
     LEFT JOIN drivers d ON oa.driver_id = d.id
     LEFT JOIN vehicles v ON oa.vehicle_id = v.id
     LEFT JOIN users cb ON oa.created_by = cb.id
     WHERE ${where}
     ORDER BY oa.advance_date DESC, oa.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    message: 'Owner advances retrieved.',
    data: {
      items: result.rows,
      total,
      totalAmount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /owner-advances/mine — returns only advances for the logged-in manager
export const getMyOwnerAdvances = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const managerId = req.user?.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const countResult = await query(
    `SELECT COUNT(*) as total_count, COALESCE(SUM(amount), 0) as total_amount
     FROM owner_advances
     WHERE manager_id = $1`,
    [managerId]
  );

  const result = await query(
    `SELECT oa.*,
            o.name as owner_name,
            u.name as manager_name
     FROM owner_advances oa
     JOIN owners o ON oa.owner_id = o.id
     JOIN users u ON oa.manager_id = u.id
     WHERE oa.manager_id = $1
     ORDER BY oa.advance_date DESC, oa.created_at DESC
     LIMIT $2 OFFSET $3`,
    [managerId, limit, offset]
  );

  res.json({
    success: true,
    message: 'Your advance credit records retrieved.',
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

export const getOwnerAdvanceById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT oa.*,
            o.name as owner_name,
            u.name as manager_name,
            d.name as driver_name,
            d.mobile_number as driver_mobile,
            v.lorry_number,
            cb.name as created_by_name
     FROM owner_advances oa
     JOIN owners o ON oa.owner_id = o.id
     LEFT JOIN users u ON oa.manager_id = u.id
     LEFT JOIN drivers d ON oa.driver_id = d.id
     LEFT JOIN vehicles v ON oa.vehicle_id = v.id
     LEFT JOIN users cb ON oa.created_by = cb.id
     WHERE oa.id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) throw new AppError('Owner advance record not found.', 404);
  assertOwnerOwner(req, result.rows[0].owner_id);
  res.json({ success: true, message: 'Owner advance retrieved.', data: result.rows[0] });
});

const resolveAdvanceDate = (dateVal?: string | Date | null): string => {
  if (!dateVal) return new Date().toISOString();
  if (dateVal instanceof Date) return dateVal.toISOString();
  const clean = String(dateVal).trim();
  if (!clean) return new Date().toISOString();

  // If date only: YYYY-MM-DD (e.g. from mobile or date input)
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

export const createOwnerAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    recipient_type = 'MANAGER',
    manager_id,
    driver_id,
    vehicle_id,
    amount,
    advance_date,
    payment_mode,
    notes,
    screenshot_url,
  } = req.body;
  let { owner_id } = req.body;

  if (!owner_id && isOwnerUser(req) && req.user?.ownerIds?.length === 1) {
    owner_id = req.user.ownerIds[0];
  }

  if (!owner_id) {
    throw new AppError('Owner is required.', 400);
  }
  assertOwnerOwner(req, owner_id);
  if (vehicle_id) assertOwnerVehicle(req, vehicle_id);
  if (manager_id) {
    await linkManagerToOwners(Number(manager_id), [parseInt(String(owner_id), 10)], req.user?.id);
  }

  if (amount === undefined || amount === null) {
    throw new AppError('Advance amount is required.', 400);
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new AppError('Advance amount must be greater than 0.', 400);
  }

  const finalRecipientType: 'MANAGER' | 'DRIVER' =
    recipient_type === 'DRIVER' || (!manager_id && driver_id) ? 'DRIVER' : 'MANAGER';

  if (finalRecipientType === 'MANAGER' && !manager_id) {
    throw new AppError('Manager (Received By) is required when giving advance to a manager.', 400);
  }

  if (finalRecipientType === 'DRIVER' && !driver_id) {
    throw new AppError('Driver (Received By) is required when giving advance directly to a driver.', 400);
  }

  const resolvedDate = resolveAdvanceDate(advance_date);

  const result = await query(
    `INSERT INTO owner_advances (
       owner_id,
       recipient_type,
       manager_id,
       driver_id,
       vehicle_id,
       amount,
       advance_date,
       payment_mode,
       notes,
       screenshot_url,
       created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10, $11)
     RETURNING *`,
    [
      owner_id,
      finalRecipientType,
      finalRecipientType === 'MANAGER' ? manager_id : null,
      finalRecipientType === 'DRIVER' ? driver_id : null,
      vehicle_id || null,
      numAmount,
      resolvedDate,
      payment_mode || 'CASH',
      notes?.trim() || null,
      screenshot_url || null,
      req.user?.id,
    ]
  );

  await createAuditLog(req.user?.id, 'CREATE_OWNER_ADVANCE', 'OWNER_ADVANCES', result.rows[0].id, {
    owner_id,
    recipient_type: finalRecipientType,
    manager_id: finalRecipientType === 'MANAGER' ? manager_id : null,
    driver_id: finalRecipientType === 'DRIVER' ? driver_id : null,
    vehicle_id: vehicle_id || null,
    amount: numAmount,
  });

  if (finalRecipientType === 'DRIVER' && driver_id) {
    await reconcileDriverPendingSettlements(driver_id, null, req.user?.id);
  }

  const fullRow = await query(
    `SELECT oa.*,
            o.name as owner_name,
            u.name as manager_name,
            d.name as driver_name,
            d.mobile_number as driver_mobile,
            v.lorry_number,
            cb.name as created_by_name
     FROM owner_advances oa
     JOIN owners o ON oa.owner_id = o.id
     LEFT JOIN users u ON oa.manager_id = u.id
     LEFT JOIN drivers d ON oa.driver_id = d.id
     LEFT JOIN vehicles v ON oa.vehicle_id = v.id
     LEFT JOIN users cb ON oa.created_by = cb.id
     WHERE oa.id = $1`,
    [result.rows[0].id]
  );

  res.status(201).json({
    success: true,
    message: `Owner advance to ${finalRecipientType === 'DRIVER' ? 'driver' : 'manager'} recorded successfully.`,
    data: fullRow.rows[0],
  });
});

export const updateOwnerAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    owner_id,
    recipient_type,
    manager_id,
    driver_id,
    vehicle_id,
    amount,
    advance_date,
    payment_mode,
    notes,
    screenshot_url,
  } = req.body;
  const { id } = req.params;

  const existing = await query('SELECT * FROM owner_advances WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Owner advance record not found.', 404);
  assertOwnerOwner(req, existing.rows[0].owner_id);
  if (owner_id) assertOwnerOwner(req, owner_id);
  if (vehicle_id) assertOwnerVehicle(req, vehicle_id);

  if (amount !== undefined && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
    throw new AppError('Advance amount must be greater than 0.', 400);
  }

  const resolvedDate = advance_date ? resolveAdvanceDate(advance_date) : null;

  let finalRecipientType =
    recipient_type ||
    existing.rows[0].recipient_type ||
    (existing.rows[0].driver_id ? 'DRIVER' : 'MANAGER');

  if (recipient_type === 'DRIVER') {
    finalRecipientType = 'DRIVER';
  } else if (recipient_type === 'MANAGER') {
    finalRecipientType = 'MANAGER';
  }

  const finalManagerId =
    finalRecipientType === 'MANAGER'
      ? manager_id !== undefined
        ? manager_id
        : existing.rows[0].manager_id
      : null;

  const finalDriverId =
    finalRecipientType === 'DRIVER'
      ? driver_id !== undefined
        ? driver_id
        : existing.rows[0].driver_id
      : null;

  if (finalRecipientType === 'MANAGER' && !finalManagerId) {
    throw new AppError('Manager is required when advance is for a manager.', 400);
  }
  if (finalRecipientType === 'DRIVER' && !finalDriverId) {
    throw new AppError('Driver is required when advance is for a driver.', 400);
  }

  const finalVehicleId =
    vehicle_id !== undefined ? vehicle_id || null : existing.rows[0].vehicle_id;

  const result = await query(
    `UPDATE owner_advances
     SET owner_id = COALESCE($1, owner_id),
         recipient_type = $2,
         manager_id = $3,
         driver_id = $4,
         vehicle_id = $5,
         amount = COALESCE($6, amount),
         advance_date = COALESCE($7::timestamptz, advance_date),
         payment_mode = COALESCE($8, payment_mode),
         notes = COALESCE($9, notes),
         screenshot_url = COALESCE($10, screenshot_url),
         updated_at = NOW()
     WHERE id = $11
     RETURNING *`,
    [
      owner_id || null,
      finalRecipientType,
      finalManagerId,
      finalDriverId,
      finalVehicleId,
      amount !== undefined ? parseFloat(amount) : null,
      resolvedDate,
      payment_mode || null,
      notes !== undefined ? notes?.trim() : null,
      screenshot_url !== undefined ? screenshot_url : null,
      id,
    ]
  );

  await createAuditLog(req.user?.id, 'UPDATE_OWNER_ADVANCE', 'OWNER_ADVANCES', id, req.body);

  if (finalRecipientType === 'DRIVER' && finalDriverId) {
    await reconcileDriverPendingSettlements(finalDriverId, null, req.user?.id);
  }

  const fullRow = await query(
    `SELECT oa.*,
            o.name as owner_name,
            u.name as manager_name,
            d.name as driver_name,
            d.mobile_number as driver_mobile,
            v.lorry_number,
            cb.name as created_by_name
     FROM owner_advances oa
     JOIN owners o ON oa.owner_id = o.id
     LEFT JOIN users u ON oa.manager_id = u.id
     LEFT JOIN drivers d ON oa.driver_id = d.id
     LEFT JOIN vehicles v ON oa.vehicle_id = v.id
     LEFT JOIN users cb ON oa.created_by = cb.id
     WHERE oa.id = $1`,
    [id]
  );

  res.json({ success: true, message: 'Owner advance updated.', data: fullRow.rows[0] });
});

export const deleteOwnerAdvance = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, amount FROM owner_advances WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Owner advance record not found.', 404);

  await query('DELETE FROM owner_advances WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_OWNER_ADVANCE', 'OWNER_ADVANCES', id, existing.rows[0]);
  res.json({ success: true, message: 'Owner advance deleted successfully.' });
});
