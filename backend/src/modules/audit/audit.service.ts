import { PoolClient } from 'pg';
import { pool } from '../../db/connection.js';

export interface AuditLogInput {
  actorId?: string | null;
  actorRole?: 'admin' | 'student' | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  beforeData?: any;
  afterData?: any;
  ipAddress?: string | null;
}

/**
 * INV-19: Append-only audit logging.
 * Dapat dipanggil dalam konteks transaksi (menggunakan client) atau pool langsung.
 */
export async function logAudit(
  input: AuditLogInput,
  client?: PoolClient
): Promise<void> {
  const executor = client || pool;
  
  // Format IP address safely (ensure null if invalid/unknown/localhost IPv6 to valid INET)
  let cleanIp = input.ipAddress || null;
  if (cleanIp === '::1' || cleanIp === 'localhost') {
    cleanIp = '127.0.0.1';
  } else if (cleanIp && !cleanIp.match(/^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/)) {
    cleanIp = null;
  }

  const query = `
    INSERT INTO audit_logs (
      actor_id, actor_role, action, entity_type, entity_id,
      reason, before_data, after_data, ip_address
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
  `;

  const values = [
    input.actorId || null,
    input.actorRole || null,
    input.action,
    input.entityType,
    input.entityId || null,
    input.reason || null,
    input.beforeData ? JSON.stringify(input.beforeData) : null,
    input.afterData ? JSON.stringify(input.afterData) : null,
    cleanIp,
  ];

  await executor.query(query, values);
}
