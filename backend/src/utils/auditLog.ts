import { query } from '../config/database';

export const createAuditLog = async (
  userId: number | undefined,
  action: string,
  module: string,
  recordId?: any,
  details?: any
): Promise<void> => {
  try {
    const recId = recordId !== undefined && recordId !== null ? String(recordId) : null;
    await query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [userId || null, action, module, recId, details ? JSON.stringify(details) : null]
    );
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};
