import { Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLog';
import { applyOwnerScope, assertOwnerOwner } from '../utils/ownerScope';

// ===== OWNERS =====
export const getOwners = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search as string;

  let conditions = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(name ILIKE $${paramIdx} OR mobile_number ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  paramIdx = applyOwnerScope(req, conditions, params, paramIdx, 'o.id');

  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*) FROM owners o WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT o.*,
            COUNT(v.id) as vehicle_count,
            COALESCE(
              json_agg(
                json_build_object('id', v.id, 'lorry_number', v.lorry_number, 'vehicle_type', v.vehicle_type)
                ORDER BY v.lorry_number ASC
              ) FILTER (WHERE v.id IS NOT NULL),
              '[]'::json
            ) as vehicles
     FROM owners o
     LEFT JOIN vehicles v ON v.owner_id = o.id
     WHERE ${where}
     GROUP BY o.id
     ORDER BY o.name ASC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    message: 'Owners retrieved.',
    data: { items: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

export const getOwnerById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT o.*,
            COUNT(v.id) as vehicle_count,
            COALESCE(
              json_agg(
                json_build_object('id', v.id, 'lorry_number', v.lorry_number, 'vehicle_type', v.vehicle_type)
                ORDER BY v.lorry_number ASC
              ) FILTER (WHERE v.id IS NOT NULL),
              '[]'::json
            ) as vehicles
     FROM owners o
     LEFT JOIN vehicles v ON v.owner_id = o.id
     WHERE o.id = $1
     GROUP BY o.id`,
    [req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Owner not found.', 404);
  assertOwnerOwner(req, result.rows[0].id);
  res.json({ success: true, message: 'Owner retrieved.', data: result.rows[0] });
});

export const createOwner = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, mobile_number } = req.body;
  if (!name) throw new AppError('Owner name is required.', 400);

  const existing = await query('SELECT id FROM owners WHERE UPPER(name) = UPPER($1)', [name.trim()]);
  if (existing.rows.length > 0) throw new AppError('An owner with this name already exists.', 409);

  const result = await query(
    `INSERT INTO owners (name, mobile_number, status) VALUES ($1, $2, 'ACTIVE') RETURNING *`,
    [name.trim(), mobile_number || null]
  );

  await createAuditLog(req.user?.id, 'CREATE_OWNER', 'OWNERS', result.rows[0].id, { name });
  res.status(201).json({ success: true, message: 'Owner created successfully.', data: result.rows[0] });
});

export const updateOwner = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertOwnerOwner(req, req.params.id);
  const { name, mobile_number } = req.body;
  const result = await query(
    `UPDATE owners SET name = COALESCE($1, name), mobile_number = COALESCE($2, mobile_number), updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [name?.trim() || null, mobile_number || null, req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Owner not found.', 404);
  await createAuditLog(req.user?.id, 'UPDATE_OWNER', 'OWNERS', req.params.id, req.body);
  res.json({ success: true, message: 'Owner updated.', data: result.rows[0] });
});

export const deleteOwner = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existing = await query('SELECT id, name FROM owners WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw new AppError('Owner not found.', 404);

  await query('DELETE FROM owners WHERE id = $1', [id]);

  await createAuditLog(req.user?.id, 'DELETE_OWNER', 'OWNERS', id, { name: existing.rows[0].name });
  res.json({ success: true, message: 'Owner deleted successfully.' });
});
