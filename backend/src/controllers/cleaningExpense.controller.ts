import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';
import { isFleetScoped } from '../utils/ownerScope';

const toNullableId = (value: any): number | null => {
  if (value === undefined || value === null || value === '' || value === 'ALL') return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Express 4/5 param values can be string | string[]. Always use a single string. */
const routeParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return value == null ? '' : String(value);
};

const findDuplicate = async (
  unitName: string,
  partyId: number | null,
  vehicleId: number | null,
  excludeId?: string | string[]
) => {
  const params: any[] = [unitName.trim(), partyId, vehicleId];
  let sql = `
    SELECT id FROM cleaning_expense_rates
    WHERE LOWER(unit_name) = LOWER($1)
      AND COALESCE(party_id, 0) = COALESCE($2, 0)
      AND COALESCE(vehicle_id, 0) = COALESCE($3, 0)
  `;
  const exclude = routeParam(excludeId);
  if (exclude) {
    params.push(exclude);
    sql += ` AND id != $4`;
  }
  return query(sql, params);
};

export const getCleaningExpenseRates = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string;

  let sql = `
    SELECT cer.*, p.name AS party_name, v.lorry_number
    FROM cleaning_expense_rates cer
    LEFT JOIN parties p ON p.id = cer.party_id
    LEFT JOIN vehicles v ON v.id = cer.vehicle_id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIdx = 1;

  if (status) {
    sql += ` AND cer.status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }
  if (isFleetScoped(req)) {
    const vids = req.user?.vehicleIds || [];
    sql += ` AND (cer.vehicle_id IS NULL OR cer.vehicle_id = ANY($${paramIdx}::int[]))`;
    params.push(vids.length ? vids : [0]);
    paramIdx++;
  }

  sql += ' ORDER BY v.lorry_number NULLS FIRST, cer.unit_name ASC, cer.id ASC';

  const result = await query(sql, params);
  res.json({ success: true, message: 'Cleaning expense rates retrieved.', data: result.rows });
});

export const getCleaningExpenseRateById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = routeParam(req.params.id);
  const result = await query(
    `SELECT cer.*, p.name AS party_name, v.lorry_number
     FROM cleaning_expense_rates cer
     LEFT JOIN parties p ON p.id = cer.party_id
     LEFT JOIN vehicles v ON v.id = cer.vehicle_id
     WHERE cer.id = $1`,
    [id]
  );
  if (result.rows.length === 0) throw new AppError('Cleaning expense rate not found.', 404);
  res.json({ success: true, message: 'Cleaning expense rate retrieved.', data: result.rows[0] });
});

export const createCleaningExpenseRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { unit_name, loading_expense, cleaning_charge, description, party_id, vehicle_id } = req.body;

  if (!unit_name || !unit_name.trim()) {
    throw new AppError('Destination / Unit Name is required.', 400);
  }
  if (cleaning_charge === undefined || cleaning_charge === null) {
    throw new AppError('Cleaning charge is required.', 400);
  }
  if (parseFloat(cleaning_charge) < 0) throw new AppError('Cleaning charge must be >= 0.', 400);

  const partyId = toNullableId(party_id);
  const vehicleId = toNullableId(vehicle_id);

  const existing = await findDuplicate(unit_name, partyId, vehicleId);
  if (existing.rows.length > 0) {
    throw new AppError('A cleaning expense rate for this unit / party / truck already exists.', 409);
  }

  const result = await query(
    `INSERT INTO cleaning_expense_rates (unit_name, loading_expense, cleaning_charge, description, party_id, vehicle_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      unit_name.trim(),
      loading_expense !== undefined && loading_expense !== '' ? parseFloat(loading_expense) : null,
      parseFloat(cleaning_charge),
      description?.trim() || null,
      partyId,
      vehicleId,
    ]
  );

  await createAuditLog(req.user?.id, 'CREATE_CLEANING_EXPENSE_RATE', 'CLEANING_EXPENSE_RATES', result.rows[0].id, {
    unit_name,
    cleaning_charge,
    party_id: partyId,
    vehicle_id: vehicleId,
  });

  res.status(201).json({ success: true, message: 'Cleaning expense rate created.', data: result.rows[0] });
});

export const updateCleaningExpenseRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { unit_name, loading_expense, cleaning_charge, description, status, party_id, vehicle_id } = req.body;
  const id = routeParam(req.params.id);

  const existing = await query('SELECT * FROM cleaning_expense_rates WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Cleaning expense rate not found.', 404);

  const effectiveUnitName = unit_name !== undefined ? unit_name.trim() : existing.rows[0].unit_name;
  const partyId = party_id !== undefined ? toNullableId(party_id) : existing.rows[0].party_id;
  const vehicleId = vehicle_id !== undefined ? toNullableId(vehicle_id) : existing.rows[0].vehicle_id;

  const dup = await findDuplicate(effectiveUnitName, partyId, vehicleId, id);
  if (dup.rows.length > 0) {
    throw new AppError('A cleaning expense rate for this unit / party / truck already exists.', 409);
  }

  const result = await query(
    `UPDATE cleaning_expense_rates
     SET unit_name       = COALESCE($1, unit_name),
         loading_expense = $2,
         cleaning_charge = COALESCE($3, cleaning_charge),
         description     = COALESCE($4, description),
         status          = COALESCE($5, status),
         party_id        = $6,
         vehicle_id      = $7,
         updated_at      = NOW()
     WHERE id = $8 RETURNING *`,
    [
      unit_name !== undefined ? unit_name.trim() : null,
      loading_expense !== undefined ? (loading_expense !== '' ? parseFloat(loading_expense) : null) : existing.rows[0].loading_expense,
      cleaning_charge !== undefined ? parseFloat(cleaning_charge) : null,
      description !== undefined ? description?.trim() : null,
      status || null,
      partyId,
      vehicleId,
      id,
    ]
  );

  if (result.rows.length === 0) throw new AppError('Cleaning expense rate not found.', 404);
  await createAuditLog(req.user?.id, 'UPDATE_CLEANING_EXPENSE_RATE', 'CLEANING_EXPENSE_RATES', id, req.body);
  res.json({ success: true, message: 'Cleaning expense rate updated.', data: result.rows[0] });
});

export const deleteCleaningExpenseRate = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = routeParam(req.params.id);
  const existing = await query('SELECT id FROM cleaning_expense_rates WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Cleaning expense rate not found.', 404);

  await query('DELETE FROM cleaning_expense_rates WHERE id = $1', [id]);
  await createAuditLog(req.user?.id, 'DELETE_CLEANING_EXPENSE_RATE', 'CLEANING_EXPENSE_RATES', id);
  res.json({ success: true, message: 'Cleaning expense rate deleted.' });
});
