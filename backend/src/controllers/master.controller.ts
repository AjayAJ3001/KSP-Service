import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

// ===== DRIVERS =====
export const getDrivers = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search as string;
  const status = req.query.status as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (search) { conditions.push(`(name ILIKE $${paramIdx} OR mobile_number ILIKE $${paramIdx} OR license_number ILIKE $${paramIdx})`); params.push(`%${search}%`); paramIdx++; }
  if (status) { conditions.push(`status = $${paramIdx}`); params.push(status); paramIdx++; }

  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*) FROM drivers WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT * FROM drivers WHERE ${where} ORDER BY name ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({ success: true, message: 'Drivers retrieved.', data: { items: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

export const getDriverById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query('SELECT * FROM drivers WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) throw new AppError('Driver not found.', 404);
  res.json({ success: true, message: 'Driver retrieved.', data: result.rows[0] });
});

export const createDriver = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, mobile_number, license_number } = req.body;
  if (!name) throw new AppError('Driver name is required.', 400);

  const result = await query(
    `INSERT INTO drivers (name, mobile_number, license_number) VALUES ($1, $2, $3) RETURNING *`,
    [name.trim(), mobile_number || null, license_number || null]
  );

  await createAuditLog(req.user?.id, 'CREATE_DRIVER', 'DRIVERS', result.rows[0].id, { name });
  res.status(201).json({ success: true, message: 'Driver created successfully.', data: result.rows[0] });
});

export const updateDriver = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, mobile_number, license_number } = req.body;
  const result = await query(
    `UPDATE drivers SET name = COALESCE($1, name), mobile_number = COALESCE($2, mobile_number),
     license_number = COALESCE($3, license_number), updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [name, mobile_number, license_number, req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Driver not found.', 404);
  await createAuditLog(req.user?.id, 'UPDATE_DRIVER', 'DRIVERS', req.params.id, req.body);
  res.json({ success: true, message: 'Driver updated.', data: result.rows[0] });
});

export const updateDriverStatus = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new AppError('Invalid status.', 400);
  const result = await query(`UPDATE drivers SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [status, req.params.id]);
  if (result.rows.length === 0) throw new AppError('Driver not found.', 404);
  await createAuditLog(req.user?.id, `${status}_DRIVER`, 'DRIVERS', req.params.id);
  res.json({ success: true, message: `Driver ${status.toLowerCase()}d.`, data: result.rows[0] });
});

// ===== VEHICLES =====
export const getVehicles = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search as string;
  const status = req.query.status as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (search) { conditions.push(`(lorry_number ILIKE $${paramIdx} OR vehicle_type ILIKE $${paramIdx})`); params.push(`%${search}%`); paramIdx++; }
  if (status) { conditions.push(`status = $${paramIdx}`); params.push(status); paramIdx++; }

  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*) FROM vehicles WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT * FROM vehicles WHERE ${where} ORDER BY lorry_number ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({ success: true, message: 'Vehicles retrieved.', data: { items: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

export const getVehicleById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) throw new AppError('Vehicle not found.', 404);
  res.json({ success: true, message: 'Vehicle retrieved.', data: result.rows[0] });
});

export const createVehicle = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { lorry_number, vehicle_type, capacity_tons, goodshed_loading_expense } = req.body;
  if (!lorry_number) throw new AppError('Lorry number is required.', 400);

  const existing = await query('SELECT id FROM vehicles WHERE UPPER(REPLACE(lorry_number, \' \', \'\')) = UPPER(REPLACE($1, \' \', \'\'))', [lorry_number.trim()]);
  if (existing.rows.length > 0) throw new AppError('Vehicle with this lorry number already exists.', 409);

  const result = await query(
    `INSERT INTO vehicles (lorry_number, vehicle_type, capacity_tons, goodshed_loading_expense) VALUES ($1, $2, $3, $4) RETURNING *`,
    [lorry_number.trim().toUpperCase(), vehicle_type || null, capacity_tons || null, goodshed_loading_expense !== undefined ? goodshed_loading_expense : 0]
  );

  await createAuditLog(req.user?.id, 'CREATE_VEHICLE', 'VEHICLES', result.rows[0].id, { lorry_number });
  res.status(201).json({ success: true, message: 'Vehicle created successfully.', data: result.rows[0] });
});

export const updateVehicle = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { lorry_number, vehicle_type, capacity_tons, goodshed_loading_expense } = req.body;
  const result = await query(
    `UPDATE vehicles SET lorry_number = COALESCE($1, lorry_number), vehicle_type = COALESCE($2, vehicle_type),
     capacity_tons = COALESCE($3, capacity_tons),
     goodshed_loading_expense = COALESCE($4, goodshed_loading_expense),
     updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [lorry_number?.toUpperCase(), vehicle_type, capacity_tons, goodshed_loading_expense, req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Vehicle not found.', 404);
  await createAuditLog(req.user?.id, 'UPDATE_VEHICLE', 'VEHICLES', req.params.id, req.body);
  res.json({ success: true, message: 'Vehicle updated.', data: result.rows[0] });
});

export const updateVehicleStatus = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new AppError('Invalid status.', 400);
  const result = await query(`UPDATE vehicles SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [status, req.params.id]);
  if (result.rows.length === 0) throw new AppError('Vehicle not found.', 404);
  await createAuditLog(req.user?.id, `${status}_VEHICLE`, 'VEHICLES', req.params.id);
  res.json({ success: true, message: `Vehicle ${status.toLowerCase()}d.`, data: result.rows[0] });
});

// ===== PARTIES =====
export const getParties = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search as string;
  const status = req.query.status as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (search) { conditions.push(`(name ILIKE $${paramIdx} OR contact_person ILIKE $${paramIdx} OR mobile_number ILIKE $${paramIdx})`); params.push(`%${search}%`); paramIdx++; }
  if (status) { conditions.push(`status = $${paramIdx}`); params.push(status); paramIdx++; }

  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*) FROM parties WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT * FROM parties WHERE ${where} ORDER BY name ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({ success: true, message: 'Parties retrieved.', data: { items: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

export const getPartyById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query('SELECT * FROM parties WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) throw new AppError('Party not found.', 404);
  res.json({ success: true, message: 'Party retrieved.', data: result.rows[0] });
});

export const createParty = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, contact_person, mobile_number, address } = req.body;
  if (!name) throw new AppError('Party name is required.', 400);

  const result = await query(
    `INSERT INTO parties (name, contact_person, mobile_number, address) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name.trim(), contact_person || null, mobile_number || null, address || null]
  );

  await createAuditLog(req.user?.id, 'CREATE_PARTY', 'PARTIES', result.rows[0].id, { name });
  res.status(201).json({ success: true, message: 'Party created successfully.', data: result.rows[0] });
});

export const updateParty = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, contact_person, mobile_number, address } = req.body;
  const result = await query(
    `UPDATE parties SET name = COALESCE($1, name), contact_person = COALESCE($2, contact_person),
     mobile_number = COALESCE($3, mobile_number), address = COALESCE($4, address), updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [name, contact_person, mobile_number, address, req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Party not found.', 404);
  await createAuditLog(req.user?.id, 'UPDATE_PARTY', 'PARTIES', req.params.id, req.body);
  res.json({ success: true, message: 'Party updated.', data: result.rows[0] });
});

export const updatePartyStatus = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new AppError('Invalid status.', 400);
  const result = await query(`UPDATE parties SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [status, req.params.id]);
  if (result.rows.length === 0) throw new AppError('Party not found.', 404);
  await createAuditLog(req.user?.id, `${status}_PARTY`, 'PARTIES', req.params.id);
  res.json({ success: true, message: `Party ${status.toLowerCase()}d.`, data: result.rows[0] });
});

export const deleteDriver = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, name FROM drivers WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Driver not found.', 404);

  // Cascade delete any linked trips, expenses, payments, settlements
  await query(`DELETE FROM driver_expenses WHERE trip_id IN (SELECT id FROM trips WHERE driver_id = $1)`, [id]);
  await query(`DELETE FROM trip_payments WHERE trip_id IN (SELECT id FROM trips WHERE driver_id = $1)`, [id]);
  await query(`DELETE FROM settlements WHERE trip_id IN (SELECT id FROM trips WHERE driver_id = $1)`, [id]);
  await query(`DELETE FROM trips WHERE driver_id = $1`, [id]);
  await query('UPDATE users SET driver_id = NULL WHERE driver_id = $1', [id]);
  await query('DELETE FROM drivers WHERE id = $1', [id]);

  await createAuditLog(req.user?.id, 'DELETE_DRIVER', 'DRIVERS', id, { name: existing.rows[0].name });
  res.json({ success: true, message: 'Driver deleted successfully.' });
});

export const deleteVehicle = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, lorry_number FROM vehicles WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Vehicle not found.', 404);

  // Cascade delete any linked trips, expenses, payments, settlements
  await query(`DELETE FROM driver_expenses WHERE trip_id IN (SELECT id FROM trips WHERE vehicle_id = $1)`, [id]);
  await query(`DELETE FROM trip_payments WHERE trip_id IN (SELECT id FROM trips WHERE vehicle_id = $1)`, [id]);
  await query(`DELETE FROM settlements WHERE trip_id IN (SELECT id FROM trips WHERE vehicle_id = $1)`, [id]);
  await query(`DELETE FROM trips WHERE vehicle_id = $1`, [id]);
  await query('DELETE FROM vehicles WHERE id = $1', [id]);

  await createAuditLog(req.user?.id, 'DELETE_VEHICLE', 'VEHICLES', id, { lorry_number: existing.rows[0].lorry_number });
  res.json({ success: true, message: 'Vehicle deleted successfully.' });
});

export const deleteParty = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, name FROM parties WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Party not found.', 404);

  // Cascade delete any linked trips, expenses, payments, settlements
  await query(`DELETE FROM driver_expenses WHERE trip_id IN (SELECT id FROM trips WHERE party_id = $1)`, [id]);
  await query(`DELETE FROM trip_payments WHERE trip_id IN (SELECT id FROM trips WHERE party_id = $1)`, [id]);
  await query(`DELETE FROM settlements WHERE trip_id IN (SELECT id FROM trips WHERE party_id = $1)`, [id]);
  await query(`DELETE FROM trips WHERE party_id = $1`, [id]);
  await query('DELETE FROM freight_rates WHERE party_id = $1', [id]);
  await query('DELETE FROM parties WHERE id = $1', [id]);

  await createAuditLog(req.user?.id, 'DELETE_PARTY', 'PARTIES', id, { name: existing.rows[0].name });
  res.json({ success: true, message: 'Party deleted successfully.' });
});

