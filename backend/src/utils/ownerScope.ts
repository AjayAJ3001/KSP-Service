import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';

export const isFullAdmin = (req: AuthRequest): boolean => req.user?.role === 'ADMIN';
export const isOwnerUser = (req: AuthRequest): boolean => req.user?.role === 'OWNER';
export const isManagerRole = (req: AuthRequest): boolean =>
  req.user?.role === 'MANAGER' || req.user?.role === 'TRANSPORT_USER';
/** Manager funded/linked to one or more owners (truck list stays company-wide). */
export const isLinkedManager = (req: AuthRequest): boolean =>
  isManagerRole(req) && (req.user?.ownerIds?.length || 0) > 0;
/** Owner login only: restricted to that owner's trucks. Managers see all trucks. */
export const isFleetScoped = (req: AuthRequest): boolean => isOwnerUser(req);
/** Full company admin or an owner viewing their own fleet (not manager-created-by filter). */
export const hasFleetWideAccess = (req: AuthRequest): boolean =>
  req.user?.role === 'ADMIN' || req.user?.role === 'OWNER';

export async function loadOwnerScope(userId: number, role: string): Promise<{ ownerIds: number[]; vehicleIds: number[] }> {
  if (role !== 'OWNER') return { ownerIds: [], vehicleIds: [] };
  const ownerSql = 'SELECT owner_id FROM user_owners WHERE user_id = $1';
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
  const ids = req.user?.vehicleIds || [];
  if (ids.length === 0) {
    conditions.push('FALSE');
    return paramIdx;
  }
  conditions.push(`${vehicleColumn} = ANY($${paramIdx}::int[])`);
  params.push(ids);
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
  const ids = req.user?.ownerIds || [];
  if (ids.length === 0) {
    conditions.push('FALSE');
    return paramIdx;
  }
  conditions.push(`${ownerColumn} = ANY($${paramIdx}::int[])`);
  params.push(ids);
  return paramIdx + 1;
}

export function assertOwnerVehicle(req: AuthRequest, vehicleId: any): void {
  if (!isFleetScoped(req)) return;
  const id = parseInt(String(vehicleId), 10);
  if (!id || !req.user?.vehicleIds?.includes(id)) {
    throw new AppError('You can only access your own vehicles.', 403);
  }
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
  assertOwnerVehicle(req, result.rows[0].vehicle_id);
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
