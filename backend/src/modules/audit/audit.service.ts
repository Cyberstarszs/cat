import { PoolClient } from 'pg';
import { pool } from '../../db/connection.js';

export interface AuditLogInput {
  actorId?: string | null;
  actorRole?: string | null;
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
  if (cleanIp && cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.slice(7);
  }
  if (cleanIp === '::1' || cleanIp === 'localhost') {
    cleanIp = '127.0.0.1';
  } else if (cleanIp && !cleanIp.match(/^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/)) {
    cleanIp = null;
  }

  // Sanitize entityId: PostgreSQL audit_logs.entity_id is UUID type.
  // If a non-UUID string is provided (e.g., 'institution'), treat as null to prevent 22P02 database error
  const isUuid = input.entityId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.entityId);
  const safeEntityId = isUuid ? input.entityId : null;

  let afterData = input.afterData;
  if (input.entityId && !isUuid) {
    if (afterData && typeof afterData === 'object' && !Array.isArray(afterData)) {
      afterData = { ...afterData, _entity_id: input.entityId };
    }
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
    safeEntityId,
    input.reason || null,
    input.beforeData ? JSON.stringify(input.beforeData) : null,
    afterData ? JSON.stringify(afterData) : null,
    cleanIp,
  ];

  await executor.query(query, values);
}
