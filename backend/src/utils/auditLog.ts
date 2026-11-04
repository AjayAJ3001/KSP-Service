import { AsyncLocalStorage } from 'async_hooks';
import { query } from '../config/database';

export const auditRequestContext = new AsyncLocalStorage<{ platform?: string }>();

export const normalizeAuditPlatform = (raw?: string | null): 'ADMIN' | 'MOBILE_ADMIN' | 'MOBILE' | '' => {
  const v = String(raw || '').trim().toUpperCase().replace(/[-\s]/g, '_');
  if (!v) return '';
  if (v === 'MOBILE_ADMIN' || v === 'ADMIN_MOBILE' || v === 'MOBILEADMIN') return 'MOBILE_ADMIN';
  if (v.includes('MOBILE') && v.includes('ADMIN')) return 'MOBILE_ADMIN';
  if (v === 'MOBILE' || v === 'APP' || v === 'DRIVER') return 'MOBILE';
  if (v.includes('MOBILE')) return 'MOBILE';
  if (v === 'ADMIN' || v === 'WEB' || v === 'ADMIN_PANEL') return 'ADMIN';
  return 'ADMIN';
};

export const createAuditLog = async (
  userId: number | undefined,
  action: string,
  module: string,
  recordId?: any,
  details?: any,
  source?: string
): Promise<void> => {
  try {
    const recId = recordId !== undefined && recordId !== null ? String(recordId) : null;
    let platform =
      normalizeAuditPlatform(source)
      || normalizeAuditPlatform(auditRequestContext.getStore()?.platform)
      || '';
    if (!platform && userId) {
      const uRes = await query('SELECT role FROM users WHERE id = $1', [userId]);
      if (uRes.rows.length > 0) {
        const role = uRes.rows[0].role;
        platform = (role === 'TRANSPORT_USER' || role === 'MANAGER') ? 'MOBILE' : 'ADMIN';
      }
    }
    if (!platform) platform = 'ADMIN';

    await query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, details, source) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId || null, action, module, recId, details ? JSON.stringify(details) : null, platform]
    );
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};
