import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

// ===== UNLOADING RATES MASTER =====

export const getUnloadingRates = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string;
  const party_id = req.query.party_id as string;
  const search = req.query.search as string;

  let sql = `
    SELECT ur.*, p.name as party_name, r.from_location, r.to_location
    FROM unloading_rates ur
    JOIN parties p ON ur.party_id = p.id
    LEFT JOIN routes r ON ur.route_id = r.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIdx = 1;

  if (status) {
    sql += ` AND ur.status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  if (party_id) {
    sql += ` AND ur.party_id = $${paramIdx}`;
    params.push(party_id);
    paramIdx++;
  }

  if (search) {
    sql += ` AND (ur.unit_name ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx} OR r.to_location ILIKE $${paramIdx} OR ur.description ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
    paramIdx++;
  }

  sql += ' ORDER BY p.name ASC, ur.unit_number ASC NULLS LAST, ur.unit_name ASC';

  const result = await query(sql, params);
  res.json({ success: true, message: 'Unloading rates retrieved.', data: result.rows });
});

export const getUnloadingRateById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT ur.*, p.name as party_name, r.from_location, r.to_location
     FROM unloading_rates ur
     JOIN parties p ON ur.party_id = p.id
     LEFT JOIN routes r ON ur.route_id = r.id
     WHERE ur.id = $1`,
    [req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Unloading rate not found.', 404);
  res.json({ success: true, message: 'Unloading rate retrieved.', data: result.rows[0] });
});

export const createUnloadingRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { party_id, unit_number, unit_name, route_id, rate_per_ton, description, status } = req.body;

  if (!party_id) throw new AppError('Party is required.', 400);
  if (!unit_name || !unit_name.trim()) throw new AppError('Unit Name is required.', 400);
  if (rate_per_ton === undefined || rate_per_ton === null) {
    throw new AppError('Rate per Ton is required.', 400);
  }
  const rate = parseFloat(rate_per_ton);
  if (isNaN(rate) || rate < 0) throw new AppError('Rate per ton must be >= 0.', 400);

  // Check duplicate unit_name for same party
  const dup = await query(
    'SELECT id FROM unloading_rates WHERE party_id = $1 AND LOWER(unit_name) = LOWER($2)',
    [party_id, unit_name.trim()]
  );
  if (dup.rows.length > 0) {
    throw new AppError(`An unloading rate for "${unit_name}" under this party already exists.`, 409);
  }

  const result = await query(
    `INSERT INTO unloading_rates (party_id, unit_number, unit_name, route_id, rate_per_ton, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'ACTIVE')) RETURNING *`,
    [
      party_id,
      unit_number !== undefined && unit_number !== '' ? parseInt(unit_number) : null,
      unit_name.trim(),
      route_id ? parseInt(route_id) : null,
      rate,
      description?.trim() || null,
      status || 'ACTIVE',
    ]
  );

  await createAuditLog(req.user?.id, 'CREATE_UNLOADING_RATE', 'UNLOADING_RATES', result.rows[0].id, {
    party_id,
    unit_name,
    rate_per_ton: rate,
  });

  res.status(201).json({ success: true, message: 'Unloading rate created successfully.', data: result.rows[0] });
});

export const updateUnloadingRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { party_id, unit_number, unit_name, route_id, rate_per_ton, description, status } = req.body;
  const { id } = req.params;

  const existing = await query('SELECT * FROM unloading_rates WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Unloading rate not found.', 404);

  const effectivePartyId = party_id || existing.rows[0].party_id;
  const effectiveUnitName = unit_name !== undefined ? unit_name.trim() : existing.rows[0].unit_name;

  if (unit_name !== undefined) {
    const dup = await query(
      'SELECT id FROM unloading_rates WHERE party_id = $1 AND LOWER(unit_name) = LOWER($2) AND id != $3',
      [effectivePartyId, effectiveUnitName, id]
    );
    if (dup.rows.length > 0) {
      throw new AppError(`An unloading rate for "${effectiveUnitName}" under this party already exists.`, 409);
    }
  }

  const rate = rate_per_ton !== undefined ? parseFloat(rate_per_ton) : existing.rows[0].rate_per_ton;
  if (rate < 0) throw new AppError('Rate per ton must be >= 0.', 400);

  const result = await query(
    `UPDATE unloading_rates
     SET party_id     = COALESCE($1, party_id),
         unit_number  = $2,
         unit_name    = COALESCE($3, unit_name),
         route_id     = $4,
         rate_per_ton = COALESCE($5, rate_per_ton),
         description  = COALESCE($6, description),
         status       = COALESCE($7, status),
         updated_at   = NOW()
     WHERE id = $8 RETURNING *`,
    [
      party_id ? parseInt(party_id) : null,
      unit_number !== undefined && unit_number !== '' ? parseInt(unit_number) : (unit_number === '' ? null : existing.rows[0].unit_number),
      unit_name !== undefined ? unit_name.trim() : null,
      route_id !== undefined ? (route_id ? parseInt(route_id) : null) : existing.rows[0].route_id,
      rate !== undefined ? rate : null,
      description !== undefined ? description?.trim() : null,
      status || null,
      id,
    ]
  );

  await createAuditLog(req.user?.id, 'UPDATE_UNLOADING_RATE', 'UNLOADING_RATES', id, req.body);
  res.json({ success: true, message: 'Unloading rate updated successfully.', data: result.rows[0] });
});

export const deleteUnloadingRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id FROM unloading_rates WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Unloading rate not found.', 404);

  await query('DELETE FROM unloading_rates WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_UNLOADING_RATE', 'UNLOADING_RATES', id);
  res.json({ success: true, message: 'Unloading rate deleted successfully.' });
});
