import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const isManagerWalletLimited = (role?: string) => {
  const r = String(role || '').toUpperCase();
  return r === 'MANAGER' || r === 'TRANSPORT_USER';
};

export async function getManagerWalletSnapshot(managerId: number) {
  if (!managerId) {
    return {
      owner_advance_credit: 0,
      owner_advance_entries: 0,
      truck_advance_used: 0,
      manager_available_balance: 0,
      owner_advance_breakdown: [] as any[],
    };
  }

  const [creditResult, usedResult, breakdownResult] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(amount), 0) as total_credit, COUNT(*) as total_entries
       FROM owner_advances
       WHERE manager_id = $1`,
      [managerId]
    ),
    query(
      `SELECT (
         COALESCE((SELECT SUM(amount) FROM truck_advances WHERE manager_id = $1), 0) +
         COALESCE((SELECT SUM(amount) FROM driver_advances WHERE manager_id = $1), 0)
       ) as total_used`,
      [managerId]
    ),
    query(
      `SELECT oa.id, oa.amount, oa.advance_date, oa.payment_mode, oa.notes,
              COALESCE(o.name, 'Owner') as owner_name
       FROM owner_advances oa
       LEFT JOIN owners o ON oa.owner_id = o.id
       WHERE oa.manager_id = $1
       ORDER BY oa.advance_date DESC, oa.created_at DESC`,
      [managerId]
    ),
  ]);

  const credit = Math.round(parseFloat(String(creditResult.rows[0]?.total_credit || 0)) || 0);
  const used = Math.round(parseFloat(String(usedResult.rows[0]?.total_used || 0)) || 0);

  return {
    owner_advance_credit: credit,
    owner_advance_entries: parseInt(String(creditResult.rows[0]?.total_entries || 0), 10) || 0,
    truck_advance_used: used,
    manager_available_balance: credit - used,
    owner_advance_breakdown: breakdownResult.rows,
  };
}

export async function getManagerAvailableBalance(managerId: number): Promise<number> {
  const result = await query(
    `SELECT (
       COALESCE((SELECT SUM(oa.amount) FROM owner_advances oa WHERE oa.manager_id = $1), 0) -
       (
         COALESCE((SELECT SUM(ta.amount) FROM truck_advances ta WHERE ta.manager_id = $1), 0) +
         COALESCE((SELECT SUM(da.amount) FROM driver_advances da WHERE da.manager_id = $1), 0)
       )
     ) as available`,
    [managerId]
  );
  return Math.round(parseFloat(String(result.rows[0]?.available || 0)) || 0);
}

export async function assertManagerCanDisburse(req: AuthRequest, amount: number): Promise<void> {
  if (!isManagerWalletLimited(req.user?.role)) return;
  const managerId = req.user?.id;
  if (!managerId) throw new AppError('Unauthorized.', 401);
  const numAmount = Math.round(parseFloat(String(amount)) || 0);
  if (numAmount <= 0) return;
  const available = await getManagerAvailableBalance(managerId);
  if (numAmount > available) {
    throw new AppError(
      available <= 0
        ? 'No balance from owner. You can still start a trip without advance, or give only after the owner gives you advance.'
        : `You can only give ₹${available.toLocaleString('en-IN')} to the driver — remaining from the amount the owner gave you.`,
      400
    );
  }
}
