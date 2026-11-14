import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';

const roleOf = (req: AuthRequest): string => String(req.user?.role || '').toUpperCase().trim();

export const isFullAdmin = (req: AuthRequest): boolean => roleOf(req) === 'ADMIN';
export const isOwnerUser = (req: AuthRequest): boolean => roleOf(req) === 'OWNER';
export const isManagerRole = (req: AuthRequest): boolean => {
  const r = roleOf(req);
  return r === 'MANAGER' || r === 'TRANSPORT_USER';
};
/** Manager funded/linked to one or more owners (truck list stays company-wide). */
export const isLinkedManager = (req: AuthRequest): boolean =>
  isManagerRole(req) && (req.user?.ownerIds?.length || 0) > 0;
/** Owner login only: restricted to that owner's trucks. Admin and manager see every trip. */
export const isFleetScoped = (req: AuthRequest): boolean => isOwnerUser(req);
/** Company-wide trip/settlement lists: admin and manager. Owner is never company-wide. */
export const hasFleetWideAccess = (req: AuthRequest): boolean =>
  roleOf(req) === 'ADMIN' || roleOf(req) === 'MANAGER';

/** Live SQL: only trucks mapped to this owner login via user_owners. */
export const sqlOwnerVehicleIn = (vehicleColumn: string, userPlaceholder: string): string =>
  `${vehicleColumn} IN (
    SELECT ov.id FROM vehicles ov
    INNER JOIN user_owners uo ON uo.owner_id = ov.owner_id
    WHERE uo.user_id = ${userPlaceholder}
  )`;

export const sqlOwnerOwnerIn = (ownerColumn: string, userPlaceholder: string): string =>
  `${ownerColumn} IN (SELECT uo.owner_id FROM user_owners uo WHERE uo.user_id = ${userPlaceholder})`;

/** Admin/owner-started work should appear on every manager dashboard. */
export const sqlIsCompanyOperator = (userIdExpr: string): string =>
  `EXISTS (SELECT 1 FROM users _co WHERE _co.id = ${userIdExpr} AND _co.role IN ('ADMIN', 'OWNER'))`;

export const sqlSelfOrCompany = (userIdExpr: string, paramPlaceholder: string): string =>
  `(${userIdExpr} = ${paramPlaceholder} OR ${sqlIsCompanyOperator(userIdExpr)})`;

/** Manager can see own trips plus any trip started by admin or owner (and trucks of linked owners). */
export const sqlManagerVisibleTrip = (createdByExpr: string, vehicleIdExpr: string, managerParam: string): string =>
  `(
    ${sqlSelfOrCompany(createdByExpr, managerParam)}
    OR EXISTS (
      SELECT 1 FROM vehicles _mv
      JOIN manager_owners _mo ON _mo.owner_id = _mv.owner_id
      WHERE _mv.id = ${vehicleIdExpr} AND _mo.user_id = ${managerParam}
    )
  )`;

export async function isCompanyOperatorUserId(userId: number | string | null | undefined): Promise<boolean> {
  const id = parseInt(String(userId || ''), 10);
  if (!id) return false;
  const result = await query(`SELECT 1 FROM users WHERE id = $1 AND role IN ('ADMIN', 'OWNER') LIMIT 1`, [id]);
  return result.rows.length > 0;
}

export async function loadOwnerScope(userId: number, role: string): Promise<{ ownerIds: number[]; vehicleIds: number[] }> {
  if (role !== 'OWNER' && role !== 'MANAGER' && role !== 'TRANSPORT_USER') {
    return { ownerIds: [], vehicleIds: [] };
  }
  const ownerSql =
    role === 'OWNER'
      ? 'SELECT owner_id FROM user_owners WHERE user_id = $1'
      : 'SELECT owner_id FROM manager_owners WHERE user_id = $1';
  const owners = await query(ownerSql, [userId]);
  const ownerIds = owners.rows.map((r: any) => parseInt(r.owner_id, 10)).filter((n: number) => n > 0);
  if (ownerIds.length === 0) return { ownerIds: [], vehicleIds: [] };
  const vehicles = await query('SELECT id FROM vehicles WHERE owner_id = ANY($1::int[])', [ownerIds]);
  const vehicleIds = vehicles.rows.map((r: any) => parseInt(r.id, 10));
  return { ownerIds, vehicleIds };
}

export function applyVehicleScope(
  req: AuthRequest,
  conditions: string[],
  params: any[],
  paramIdx: number,
  vehicleColumn: string
): number {
  if (!isFleetScoped(req)) return paramIdx;
  if (!req.user?.id) {
    conditions.push('FALSE');
    return paramIdx;
  }
  conditions.push(sqlOwnerVehicleIn(vehicleColumn, `$${paramIdx}`));
  params.push(req.user.id);
  return paramIdx + 1;
}

export function applyOwnerScope(
  req: AuthRequest,
  conditions: string[],
  params: any[],
  paramIdx: number,
  ownerColumn: string
): number {
  if (!isFleetScoped(req)) return paramIdx;
  if (!req.user?.id) {
    conditions.push('FALSE');
    return paramIdx;
  }
  conditions.push(sqlOwnerOwnerIn(ownerColumn, `$${paramIdx}`));
  params.push(req.user.id);
  return paramIdx + 1;
}

export function assertOwnerVehicle(req: AuthRequest, vehicleId: any): void {
  if (!isFleetScoped(req)) return;
  const id = parseInt(String(vehicleId), 10);
  if (!id || !req.user?.vehicleIds?.includes(id)) {
    throw new AppError('You can only access your own vehicles.', 403);
  }
}

export async function assertOwnerVehicleAsync(req: AuthRequest, vehicleId: any): Promise<void> {
  if (!isFleetScoped(req)) return;
  const id = parseInt(String(vehicleId), 10);
  if (!id || !req.user?.id) throw new AppError('You can only access your own vehicles.', 403);
  const result = await query(
    `SELECT 1 FROM vehicles ov
     INNER JOIN user_owners uo ON uo.owner_id = ov.owner_id
     WHERE ov.id = $1 AND uo.user_id = $2
     LIMIT 1`,
    [id, req.user.id]
  );
  if (result.rows.length === 0) throw new AppError('You can only access your own vehicles.', 403);
}

export function assertOwnerOwner(req: AuthRequest, ownerId: any): void {
  if (!isFleetScoped(req)) return;
  const id = parseInt(String(ownerId), 10);
  if (!id || !req.user?.ownerIds?.includes(id)) {
    throw new AppError('You can only access your own owner records.', 403);
  }
}

export async function assertTripInOwnerScope(req: AuthRequest, tripId: any): Promise<void> {
  if (!isFleetScoped(req)) return;
  const result = await query('SELECT vehicle_id FROM trips WHERE id = $1', [tripId]);
  if (result.rows.length === 0) throw new AppError('Trip not found.', 404);
  await assertOwnerVehicleAsync(req, result.rows[0].vehicle_id);
}

export async function linkManagerToOwners(managerUserId: number, ownerIds: number[], createdBy?: number): Promise<void> {
  if (!ownerIds.length) return;
  for (const ownerId of ownerIds) {
    await query(
      `INSERT INTO manager_owners (user_id, owner_id, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, owner_id) DO NOTHING`,
      [managerUserId, ownerId, createdBy || null]
    );
  }
}

export async function assertOwnerManager(req: AuthRequest, managerUserId: any): Promise<void> {
  if (!isOwnerUser(req)) return;
  const id = parseInt(String(managerUserId), 10);
  const ownerIds = req.user?.ownerIds || [];
  if (!id || ownerIds.length === 0) {
    throw new AppError('You can only assign your own managers.', 403);
  }
  const result = await query(
    `SELECT 1 FROM manager_owners
     WHERE user_id = $1 AND owner_id = ANY($2::int[])
     LIMIT 1`,
    [id, ownerIds]
  );
  if (result.rows.length === 0) {
    throw new AppError('You can only assign managers you created.', 403);
  }
}
