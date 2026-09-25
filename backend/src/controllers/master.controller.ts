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

export const getExpiringDrivers = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const days = parseInt(req.query.days as string) || 45;
  const result = await query(
    `SELECT *,
      (license_expiry_date - CURRENT_DATE) as days_remaining
     FROM drivers
     WHERE status = 'ACTIVE'
       AND license_expiry_date IS NOT NULL
       AND license_expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
     ORDER BY license_expiry_date ASC`,
    [days]
  );
  res.json({ success: true, message: 'Expiring drivers retrieved.', data: result.rows });
});

export const createDriver = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, mobile_number, license_number, photo_url, license_photo_url, license_expiry_date, license_type, id_proof_type, id_proof_url } = req.body;
  if (!name) throw new AppError('Driver name is required.', 400);

  const result = await query(
    `INSERT INTO drivers (name, mobile_number, license_number, photo_url, license_photo_url, license_expiry_date, license_type, id_proof_type, id_proof_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      name.trim(),
      mobile_number || null,
      license_number || null,
      photo_url || null,
      license_photo_url || null,
      license_expiry_date || null,
      license_type || null,
      id_proof_type || null,
      id_proof_url || null
    ]
  );

  await createAuditLog(req.user?.id, 'CREATE_DRIVER', 'DRIVERS', result.rows[0].id, { name });
  res.status(201).json({ success: true, message: 'Driver created successfully.', data: result.rows[0] });
});

export const updateDriver = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, mobile_number, license_number, photo_url, license_photo_url, license_expiry_date, license_type, id_proof_type, id_proof_url } = req.body;
  const result = await query(
    `UPDATE drivers SET
     name = COALESCE($1, name),
     mobile_number = COALESCE($2, mobile_number),
     license_number = COALESCE($3, license_number),
     photo_url = COALESCE($4, photo_url),
     license_photo_url = COALESCE($5, license_photo_url),
     license_expiry_date = COALESCE($6, license_expiry_date),
     license_type = COALESCE($7, license_type),
     id_proof_type = COALESCE($8, id_proof_type),
     id_proof_url = COALESCE($9, id_proof_url),
     updated_at = NOW()
     WHERE id = $10 RETURNING *`,
    [
      name,
      mobile_number,
      license_number,
      photo_url || null,
      license_photo_url || null,
      license_expiry_date || null,
      license_type || null,
      id_proof_type || null,
      id_proof_url || null,
      req.params.id
    ]
  );
  if (result.rows.length === 0) throw new AppError('Driver not found.', 404);
  await createAuditLog(req.user?.id, 'UPDATE_DRIVER', 'DRIVERS', req.params.id, { name });
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

export const getExpiringVehicles = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const days = parseInt(req.query.days as string) || 45;
  const interval = `'${days} days'`;
  const result = await query(
    `SELECT
       id, lorry_number, vehicle_type, status,
       dts_expiry_date, dts_number,
       insurance_expiry_date, insurance_policy_number,
       permit_expiry_date, permit_number,
       fc_expiry_date, fc_number,
       tax_expiry_date
     FROM vehicles
     WHERE status = 'ACTIVE'
       AND (
         (dts_expiry_date IS NOT NULL AND dts_expiry_date <= CURRENT_DATE + (${interval})::INTERVAL)
         OR (insurance_expiry_date IS NOT NULL AND insurance_expiry_date <= CURRENT_DATE + (${interval})::INTERVAL)
         OR (permit_expiry_date IS NOT NULL AND permit_expiry_date <= CURRENT_DATE + (${interval})::INTERVAL)
         OR (fc_expiry_date IS NOT NULL AND fc_expiry_date <= CURRENT_DATE + (${interval})::INTERVAL)
         OR (tax_expiry_date IS NOT NULL AND tax_expiry_date <= CURRENT_DATE + (${interval})::INTERVAL)
       )
     ORDER BY LEAST(
       COALESCE(dts_expiry_date, 'infinity'::date),
       COALESCE(insurance_expiry_date, 'infinity'::date),
       COALESCE(permit_expiry_date, 'infinity'::date),
       COALESCE(fc_expiry_date, 'infinity'::date),
       COALESCE(tax_expiry_date, 'infinity'::date)
     ) ASC`,
    []
  );
  res.json({ success: true, message: 'Expiring vehicles retrieved.', data: result.rows });
});

export const createVehicle = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    lorry_number, vehicle_type, capacity_tons, goodshed_loading_expense,
    rc_number, rc_photo_url,
    account_number, bank_name, ifsc_code, account_holder_name, account_photo_url,
    pan_number, pan_card_url,
    dts_number, dts_expiry_date, dts_certificate_url,
    insurance_policy_number, insurance_expiry_date, insurance_photo_url,
    permit_number, permit_expiry_date, permit_photo_url,
    fc_number, fc_expiry_date, fc_photo_url,
    tax_expiry_date, tax_photo_url,
  } = req.body;
  if (!lorry_number) throw new AppError('Lorry number is required.', 400);

  const existing = await query('SELECT id FROM vehicles WHERE UPPER(REPLACE(lorry_number, \' \', \'\')) = UPPER(REPLACE($1, \' \', \'\'))', [lorry_number.trim()]);
  if (existing.rows.length > 0) throw new AppError('Vehicle with this lorry number already exists.', 409);

  const result = await query(
    `INSERT INTO vehicles (
      lorry_number, vehicle_type, capacity_tons, goodshed_loading_expense,
      rc_number, rc_photo_url,
      account_number, bank_name, ifsc_code, account_holder_name, account_photo_url,
      pan_number, pan_card_url,
      dts_number, dts_expiry_date, dts_certificate_url,
      insurance_policy_number, insurance_expiry_date, insurance_photo_url,
      permit_number, permit_expiry_date, permit_photo_url,
      fc_number, fc_expiry_date, fc_photo_url,
      tax_expiry_date, tax_photo_url
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13,
      $14, $15, $16,
      $17, $18, $19,
      $20, $21, $22,
      $23, $24, $25,
      $26, $27
    ) RETURNING *`,
    [
      lorry_number.trim().toUpperCase(),
      vehicle_type || null,
      capacity_tons || null,
      goodshed_loading_expense !== undefined ? goodshed_loading_expense : 0,
      rc_number || null,
      rc_photo_url || null,
      account_number || null,
      bank_name || null,
      ifsc_code || null,
      account_holder_name || null,
      account_photo_url || null,
      pan_number || null,
      pan_card_url || null,
      dts_number || null,
      dts_expiry_date || null,
      dts_certificate_url || null,
      insurance_policy_number || null,
      insurance_expiry_date || null,
      insurance_photo_url || null,
      permit_number || null,
      permit_expiry_date || null,
      permit_photo_url || null,
      fc_number || null,
      fc_expiry_date || null,
      fc_photo_url || null,
      tax_expiry_date || null,
      tax_photo_url || null,
    ]
  );

  await createAuditLog(req.user?.id, 'CREATE_VEHICLE', 'VEHICLES', result.rows[0].id, { lorry_number });
  res.status(201).json({ success: true, message: 'Vehicle created successfully.', data: result.rows[0] });
});

export const updateVehicle = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    lorry_number, vehicle_type, capacity_tons, goodshed_loading_expense,
    rc_number, rc_photo_url,
    account_number, bank_name, ifsc_code, account_holder_name, account_photo_url,
    pan_number, pan_card_url,
    dts_number, dts_expiry_date, dts_certificate_url,
    insurance_policy_number, insurance_expiry_date, insurance_photo_url,
    permit_number, permit_expiry_date, permit_photo_url,
    fc_number, fc_expiry_date, fc_photo_url,
    tax_expiry_date, tax_photo_url,
  } = req.body;

  const result = await query(
    `UPDATE vehicles SET
      lorry_number = COALESCE($1, lorry_number),
      vehicle_type = COALESCE($2, vehicle_type),
      capacity_tons = COALESCE($3, capacity_tons),
      goodshed_loading_expense = COALESCE($4, goodshed_loading_expense),
      rc_number = COALESCE($5, rc_number),
      rc_photo_url = COALESCE($6, rc_photo_url),
      account_number = COALESCE($7, account_number),
      bank_name = COALESCE($8, bank_name),
      ifsc_code = COALESCE($9, ifsc_code),
      account_holder_name = COALESCE($10, account_holder_name),
      account_photo_url = COALESCE($11, account_photo_url),
      pan_number = COALESCE($12, pan_number),
      pan_card_url = COALESCE($13, pan_card_url),
      dts_number = COALESCE($14, dts_number),
      dts_expiry_date = COALESCE($15, dts_expiry_date),
      dts_certificate_url = COALESCE($16, dts_certificate_url),
      insurance_policy_number = COALESCE($17, insurance_policy_number),
      insurance_expiry_date = COALESCE($18, insurance_expiry_date),
      insurance_photo_url = COALESCE($19, insurance_photo_url),
      permit_number = COALESCE($20, permit_number),
      permit_expiry_date = COALESCE($21, permit_expiry_date),
      permit_photo_url = COALESCE($22, permit_photo_url),
      fc_number = COALESCE($23, fc_number),
      fc_expiry_date = COALESCE($24, fc_expiry_date),
      fc_photo_url = COALESCE($25, fc_photo_url),
      tax_expiry_date = COALESCE($26, tax_expiry_date),
      tax_photo_url = COALESCE($27, tax_photo_url),
      updated_at = NOW()
     WHERE id = $28 RETURNING *`,
    [
      lorry_number ? lorry_number.toUpperCase() : null,
      vehicle_type !== undefined ? vehicle_type : null,
      capacity_tons !== undefined ? capacity_tons : null,
      goodshed_loading_expense !== undefined ? goodshed_loading_expense : null,
      rc_number !== undefined ? rc_number : null,
      rc_photo_url !== undefined ? rc_photo_url : null,
      account_number !== undefined ? account_number : null,
      bank_name !== undefined ? bank_name : null,
      ifsc_code !== undefined ? ifsc_code : null,
      account_holder_name !== undefined ? account_holder_name : null,
      account_photo_url !== undefined ? account_photo_url : null,
      pan_number !== undefined ? pan_number : null,
      pan_card_url !== undefined ? pan_card_url : null,
      dts_number !== undefined ? dts_number : null,
      dts_expiry_date !== undefined ? dts_expiry_date : null,
      dts_certificate_url !== undefined ? dts_certificate_url : null,
      insurance_policy_number !== undefined ? insurance_policy_number : null,
      insurance_expiry_date !== undefined ? insurance_expiry_date : null,
      insurance_photo_url !== undefined ? insurance_photo_url : null,
      permit_number !== undefined ? permit_number : null,
      permit_expiry_date !== undefined ? permit_expiry_date : null,
      permit_photo_url !== undefined ? permit_photo_url : null,
      fc_number !== undefined ? fc_number : null,
      fc_expiry_date !== undefined ? fc_expiry_date : null,
      fc_photo_url !== undefined ? fc_photo_url : null,
      tax_expiry_date !== undefined ? tax_expiry_date : null,
      tax_photo_url !== undefined ? tax_photo_url : null,
      req.params.id,
    ]
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
    `SELECT p.*,
            (SELECT COUNT(DISTINCT fr.route_id) FROM freight_rates fr WHERE fr.party_id = p.id) as routes_count
     FROM parties p WHERE ${where} ORDER BY p.name ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
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

