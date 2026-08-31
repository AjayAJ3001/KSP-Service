import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

// ===== UNITS =====
export const getUnits = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string;
  let sql = 'SELECT * FROM units';
  const params: any[] = [];
  if (status) { sql += ' WHERE status = $1'; params.push(status); }
  sql += ' ORDER BY name ASC';
  const result = await query(sql, params);
  res.json({ success: true, message: 'Units retrieved.', data: result.rows });
});

export const createUnit = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, abbreviation } = req.body;
  if (!name) throw new AppError('Unit name is required.', 400);
  const result = await query(`INSERT INTO units (name, abbreviation) VALUES ($1, $2) RETURNING *`, [name.trim(), abbreviation || null]);
  await createAuditLog(req.user?.id, 'CREATE_UNIT', 'UNITS', result.rows[0].id, { name });
  res.status(201).json({ success: true, message: 'Unit created.', data: result.rows[0] });
});

export const updateUnit = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, abbreviation, status } = req.body;
  const result = await query(
    `UPDATE units SET name = COALESCE($1, name), abbreviation = COALESCE($2, abbreviation), 
     status = COALESCE($3, status), updated_at = NOW() WHERE id = $4 RETURNING *`,
    [name, abbreviation, status, req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Unit not found.', 404);
  await createAuditLog(req.user?.id, 'UPDATE_UNIT', 'UNITS', req.params.id, req.body);
  res.json({ success: true, message: 'Unit updated.', data: result.rows[0] });
});

// ===== ROUTES =====
export const getRoutes = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const search = req.query.search as string;
  const status = req.query.status as string;
  const party_id = req.query.party_id as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(r.from_location ILIKE $${paramIdx} OR r.to_location ILIKE $${paramIdx} OR EXISTS (SELECT 1 FROM freight_rates fr JOIN parties p ON fr.party_id = p.id WHERE fr.route_id = r.id AND p.name ILIKE $${paramIdx}))`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (status) {
    conditions.push(`r.status = $${paramIdx}`);
    params.push(status);
    paramIdx++;
  }
  if (party_id) {
    conditions.push(`r.id IN (SELECT route_id FROM freight_rates WHERE party_id = $${paramIdx})`);
    params.push(party_id);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*) FROM routes r WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT r.*,
            (SELECT p.name FROM freight_rates fr JOIN parties p ON fr.party_id = p.id WHERE fr.route_id = r.id LIMIT 1) as party_name,
            (SELECT fr.party_id FROM freight_rates fr WHERE fr.route_id = r.id LIMIT 1) as party_id,
            (SELECT fr.rate_per_unit FROM freight_rates fr WHERE fr.route_id = r.id LIMIT 1) as rate_per_unit
     FROM routes r
     WHERE ${where}
     ORDER BY party_name ASC NULLS LAST, r.to_location ASC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({ success: true, message: 'Routes retrieved.', data: { items: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

export const createRoute = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { from_location, to_location, distance_km } = req.body;
  if (!from_location || !to_location) throw new AppError('From and To locations are required.', 400);
  const result = await query(
    `INSERT INTO routes (from_location, to_location, distance_km) VALUES ($1, $2, $3) RETURNING *`,
    [from_location.trim(), to_location.trim(), distance_km || null]
  );
  await createAuditLog(req.user?.id, 'CREATE_ROUTE', 'ROUTES', result.rows[0].id, { from_location, to_location });
  res.status(201).json({ success: true, message: 'Route created.', data: result.rows[0] });
});

export const updateRoute = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { from_location, to_location, distance_km, status } = req.body;
  const result = await query(
    `UPDATE routes SET from_location = COALESCE($1, from_location), to_location = COALESCE($2, to_location),
     distance_km = COALESCE($3, distance_km), status = COALESCE($4, status), updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [from_location, to_location, distance_km, status, req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Route not found.', 404);
  await createAuditLog(req.user?.id, 'UPDATE_ROUTE', 'ROUTES', req.params.id, req.body);
  res.json({ success: true, message: 'Route updated.', data: result.rows[0] });
});

// ===== FREIGHT RATES =====
export const getFreightRates = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const route_id = req.query.route_id as string;
  const party_id = req.query.party_id as string;
  const status = req.query.status as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (route_id) { conditions.push(`fr.route_id = $${paramIdx}`); params.push(route_id); paramIdx++; }
  if (party_id) { conditions.push(`fr.party_id = $${paramIdx}`); params.push(party_id); paramIdx++; }
  if (status) { conditions.push(`fr.status = $${paramIdx}`); params.push(status); paramIdx++; }

  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*) FROM freight_rates fr WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT fr.*, r.from_location, r.to_location, u.name as unit_name, p.name as party_name
     FROM freight_rates fr
     JOIN routes r ON fr.route_id = r.id
     JOIN units u ON fr.unit_id = u.id
     LEFT JOIN parties p ON fr.party_id = p.id
     WHERE ${where}
     ORDER BY fr.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({ success: true, message: 'Freight rates retrieved.', data: { items: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

export const createFreightRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { route_id, unit_id, party_id, rate_per_unit, effective_from } = req.body;
  if (!route_id || !unit_id || !rate_per_unit || !effective_from) {
    throw new AppError('Route, unit, rate and effective date are required.', 400);
  }
  if (rate_per_unit < 0) throw new AppError('Rate must be >= 0.', 400);

  const result = await query(
    `INSERT INTO freight_rates (route_id, unit_id, party_id, rate_per_unit, effective_from)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [route_id, unit_id, party_id || null, rate_per_unit, effective_from]
  );

  await createAuditLog(req.user?.id, 'CREATE_FREIGHT_RATE', 'FREIGHT_RATES', result.rows[0].id, { route_id, rate_per_unit });
  res.status(201).json({ success: true, message: 'Freight rate created.', data: result.rows[0] });
});

export const updateFreightRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { route_id, unit_id, party_id, rate_per_unit, effective_from, effective_to, status } = req.body;
  const result = await query(
    `UPDATE freight_rates SET route_id = COALESCE($1, route_id), unit_id = COALESCE($2, unit_id),
     party_id = $3, rate_per_unit = COALESCE($4, rate_per_unit), effective_from = COALESCE($5, effective_from),
     effective_to = $6, status = COALESCE($7, status), updated_at = NOW()
     WHERE id = $8 RETURNING *`,
    [route_id, unit_id, party_id || null, rate_per_unit, effective_from, effective_to || null, status, req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Freight rate not found.', 404);
  await createAuditLog(req.user?.id, 'UPDATE_FREIGHT_RATE', 'FREIGHT_RATES', req.params.id, req.body);
  res.json({ success: true, message: 'Freight rate updated.', data: result.rows[0] });
});

// ===== EXPENSE RATES =====
export const getExpenseRates = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string;
  const expense_type = req.query.expense_type as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (status) { conditions.push(`er.status = $${paramIdx}`); params.push(status); paramIdx++; }
  if (expense_type) { conditions.push(`er.expense_type = $${paramIdx}`); params.push(expense_type); paramIdx++; }

  const result = await query(
    `SELECT er.*, r.from_location, r.to_location, u.name as unit_name
     FROM expense_rates er
     LEFT JOIN routes r ON er.route_id = r.id
     LEFT JOIN units u ON er.unit_id = u.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY er.expense_type, er.name ASC`,
    params
  );

  res.json({ success: true, message: 'Expense rates retrieved.', data: result.rows });
});

export const createExpenseRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { expense_type, name, rate_per_unit, route_id, unit_id } = req.body;
  if (!expense_type || !name) throw new AppError('Expense type and name are required.', 400);

  const result = await query(
    `INSERT INTO expense_rates (expense_type, name, rate_per_unit, route_id, unit_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [expense_type, name.trim(), rate_per_unit || null, route_id || null, unit_id || null]
  );

  await createAuditLog(req.user?.id, 'CREATE_EXPENSE_RATE', 'EXPENSE_RATES', result.rows[0].id, { expense_type, name });
  res.status(201).json({ success: true, message: 'Expense rate created.', data: result.rows[0] });
});

export const updateExpenseRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { expense_type, name, rate_per_unit, route_id, unit_id, status } = req.body;
  const result = await query(
    `UPDATE expense_rates SET expense_type = COALESCE($1, expense_type), name = COALESCE($2, name),
     rate_per_unit = COALESCE($3, rate_per_unit), route_id = $4, unit_id = $5,
     status = COALESCE($6, status), updated_at = NOW()
     WHERE id = $7 RETURNING *`,
    [expense_type, name, rate_per_unit, route_id || null, unit_id || null, status, req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Expense rate not found.', 404);
  await createAuditLog(req.user?.id, 'UPDATE_EXPENSE_RATE', 'EXPENSE_RATES', req.params.id, req.body);
  res.json({ success: true, message: 'Expense rate updated.', data: result.rows[0] });
});

export const deleteUnit = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, name FROM units WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Unit not found.', 404);

  await query(`DELETE FROM driver_expenses WHERE trip_id IN (SELECT id FROM trips WHERE unit_id = $1)`, [id]);
  await query(`DELETE FROM trip_payments WHERE trip_id IN (SELECT id FROM trips WHERE unit_id = $1)`, [id]);
  await query(`DELETE FROM settlements WHERE trip_id IN (SELECT id FROM trips WHERE unit_id = $1)`, [id]);
  await query(`DELETE FROM trips WHERE unit_id = $1`, [id]);
  await query('DELETE FROM freight_rates WHERE unit_id = $1', [id]);
  await query('DELETE FROM expense_rates WHERE unit_id = $1', [id]);
  await query('DELETE FROM units WHERE id = $1', [id]);

  await createAuditLog(req.user?.id, 'DELETE_UNIT', 'UNITS', id, { name: existing.rows[0].name });
  res.json({ success: true, message: 'Unit deleted successfully.' });
});

export const deleteRoute = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, from_location, to_location FROM routes WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Route not found.', 404);

  await query(`DELETE FROM driver_expenses WHERE trip_id IN (SELECT id FROM trips WHERE route_id = $1)`, [id]);
  await query(`DELETE FROM trip_payments WHERE trip_id IN (SELECT id FROM trips WHERE route_id = $1)`, [id]);
  await query(`DELETE FROM settlements WHERE trip_id IN (SELECT id FROM trips WHERE route_id = $1)`, [id]);
  await query(`DELETE FROM trips WHERE route_id = $1`, [id]);
  await query('DELETE FROM freight_rates WHERE route_id = $1', [id]);
  await query('DELETE FROM expense_rates WHERE route_id = $1', [id]);
  await query('DELETE FROM routes WHERE id = $1', [id]);

  await createAuditLog(req.user?.id, 'DELETE_ROUTE', 'ROUTES', id, existing.rows[0]);
  res.json({ success: true, message: 'Route deleted successfully.' });
});

export const deleteFreightRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id FROM freight_rates WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Freight rate not found.', 404);

  await query('DELETE FROM freight_rates WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_FREIGHT_RATE', 'FREIGHT_RATES', id);
  res.json({ success: true, message: 'Freight rate deleted successfully.' });
});

export const deleteExpenseRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id FROM expense_rates WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Expense rate not found.', 404);

  await query('DELETE FROM expense_rates WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_EXPENSE_RATE', 'EXPENSE_RATES', id);
  res.json({ success: true, message: 'Expense rate deleted successfully.' });
});

