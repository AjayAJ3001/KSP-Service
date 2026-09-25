import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';

// ===== DRIVER BATA RATES MASTER =====

export const getDriverBataRates = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string;
  const party_id = req.query.party_id as string;

  let sql = `
    SELECT dbr.*, p.name as party_name
    FROM driver_bata_rates dbr
    LEFT JOIN parties p ON dbr.party_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIdx = 1;

  if (status) {
    sql += ` AND dbr.status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  if (party_id !== undefined && party_id !== '') {
    if (party_id === 'null' || party_id === 'GLOBAL') {
      sql += ` AND dbr.party_id IS NULL`;
    } else {
      sql += ` AND dbr.party_id = $${paramIdx}`;
      params.push(parseInt(party_id));
      paramIdx++;
    }
  }

  sql += ' ORDER BY dbr.party_id ASC NULLS FIRST, dbr.created_at ASC';

  const result = await query(sql, params);
  res.json({ success: true, message: 'Driver bata rates retrieved.', data: result.rows });
});

export const getEffectiveBataRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const party_id = req.query.party_id as string;

  // 1. Try to find active rate for specific party if party_id is provided
  if (party_id && party_id !== '0' && party_id !== 'null') {
    const partyRate = await query(
      `SELECT dbr.*, p.name as party_name
       FROM driver_bata_rates dbr
       LEFT JOIN parties p ON dbr.party_id = p.id
       WHERE dbr.party_id = $1 AND dbr.status = 'ACTIVE'
       LIMIT 1`,
      [parseInt(party_id)]
    );
    if (partyRate.rows.length > 0) {
      res.json({ success: true, message: 'Effective driver bata rate retrieved.', data: partyRate.rows[0] });
      return;
    }
  }

  // 2. Fall back to global active standard rate (party_id IS NULL)
  const globalRate = await query(
    `SELECT dbr.*, NULL as party_name
     FROM driver_bata_rates dbr
     WHERE dbr.party_id IS NULL AND dbr.status = 'ACTIVE'
     LIMIT 1`
  );

  if (globalRate.rows.length > 0) {
    res.json({ success: true, message: 'Standard global driver bata rate retrieved.', data: globalRate.rows[0] });
    return;
  }

  // 3. Fallback default 15% (0.1500)
  res.json({
    success: true,
    message: 'Default driver bata rate.',
    data: {
      id: 0,
      party_id: null,
      rate_percentage: 15.0,
      rate_multiplier: 0.15,
      description: 'Default Driver Bata (15% of Total Freight)',
      status: 'ACTIVE',
    },
  });
});

export const createDriverBataRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { party_id, rate_percentage, rate_multiplier, description, status } = req.body;

  let percentage = rate_percentage !== undefined ? parseFloat(rate_percentage) : undefined;
  let multiplier = rate_multiplier !== undefined ? parseFloat(rate_multiplier) : undefined;

  if (percentage === undefined && multiplier === undefined) {
    throw new AppError('Rate percentage (e.g. 15 for 15%) or multiplier (e.g. 0.15) is required.', 400);
  }

  if (percentage !== undefined && multiplier === undefined) {
    multiplier = percentage / 100;
  } else if (multiplier !== undefined && percentage === undefined) {
    percentage = multiplier * 100;
  }

  if (percentage! < 0 || multiplier! < 0) {
    throw new AppError('Rate must be positive (>= 0).', 400);
  }

  const effectivePartyId = party_id ? parseInt(party_id) : null;

  // Check duplicate rate rule for party
  if (effectivePartyId !== null) {
    const dup = await query(
      'SELECT id FROM driver_bata_rates WHERE party_id = $1',
      [effectivePartyId]
    );
    if (dup.rows.length > 0) {
      throw new AppError('A Driver Bata rate rule for this party already exists. Please update the existing rule.', 409);
    }
  }

  const result = await query(
    `INSERT INTO driver_bata_rates (party_id, rate_percentage, rate_multiplier, description, status)
     VALUES ($1, $2, $3, $4, COALESCE($5, 'ACTIVE')) RETURNING *`,
    [
      effectivePartyId,
      percentage,
      multiplier,
      description?.trim() || (effectivePartyId ? `Driver Bata for Party #${effectivePartyId} (${percentage}%)` : `Standard Driver Bata (${percentage}%)`),
      status || 'ACTIVE',
    ]
  );

  await createAuditLog(req.user?.id, 'CREATE_DRIVER_BATA_RATE', 'DRIVER_BATA_RATES', result.rows[0].id, {
    party_id: effectivePartyId,
    rate_percentage: percentage,
    rate_multiplier: multiplier,
  });

  res.status(201).json({ success: true, message: 'Driver bata rate created successfully.', data: result.rows[0] });
});

export const updateDriverBataRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { rate_percentage, rate_multiplier, description, status, party_id } = req.body;

  const existing = await query('SELECT * FROM driver_bata_rates WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Driver bata rate not found.', 404);

  let percentage = rate_percentage !== undefined ? parseFloat(rate_percentage) : undefined;
  let multiplier = rate_multiplier !== undefined ? parseFloat(rate_multiplier) : undefined;

  if (percentage !== undefined && multiplier === undefined) {
    multiplier = percentage / 100;
  } else if (multiplier !== undefined && percentage === undefined) {
    percentage = multiplier * 100;
  }

  const effectivePercentage = percentage !== undefined ? percentage : existing.rows[0].rate_percentage;
  const effectiveMultiplier = multiplier !== undefined ? multiplier : existing.rows[0].rate_multiplier;

  if (parseFloat(effectivePercentage) < 0 || parseFloat(effectiveMultiplier) < 0) {
    throw new AppError('Rate must be positive (>= 0).', 400);
  }

  const result = await query(
    `UPDATE driver_bata_rates
     SET rate_percentage = $1,
         rate_multiplier = $2,
         description     = COALESCE($3, description),
         status          = COALESCE($4, status),
         party_id        = CASE WHEN $5::boolean THEN $6 ELSE party_id END,
         updated_at      = NOW()
     WHERE id = $7 RETURNING *`,
    [
      effectivePercentage,
      effectiveMultiplier,
      description !== undefined ? description.trim() : null,
      status || null,
      party_id !== undefined,
      party_id ? parseInt(party_id) : null,
      id,
    ]
  );

  await createAuditLog(req.user?.id, 'UPDATE_DRIVER_BATA_RATE', 'DRIVER_BATA_RATES', id, req.body);
  res.json({ success: true, message: 'Driver bata rate updated successfully.', data: result.rows[0] });
});

export const deleteDriverBataRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const existing = await query('SELECT * FROM driver_bata_rates WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Driver bata rate not found.', 404);

  // Prevent deleting the global standard rate if it's the only one
  if (existing.rows[0].party_id === null) {
    const countRes = await query('SELECT COUNT(*) FROM driver_bata_rates WHERE party_id IS NULL');
    if (parseInt(countRes.rows[0].count) <= 1) {
      throw new AppError('Cannot delete the default global Driver Bata rate. You can edit it instead.', 400);
    }
  }

  await query('DELETE FROM driver_bata_rates WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_DRIVER_BATA_RATE', 'DRIVER_BATA_RATES', id);
  res.json({ success: true, message: 'Driver bata rate deleted successfully.' });
});
