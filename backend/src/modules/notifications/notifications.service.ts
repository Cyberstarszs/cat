import { PoolClient } from 'pg';
import { pool } from '../../db/connection.js';

export interface NotificationInput {
  recipientId: string;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
}

export async function sendNotification(
  input: NotificationInput,
  client?: PoolClient
): Promise<void> {
  const executor = client || pool;
  
  // Gunakan ON CONFLICT DO NOTHING jika ada dedupe_key
  const query = `
    INSERT INTO notifications (
      recipient_id, type, title, body, entity_type, entity_id, dedupe_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (recipient_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  `;

  await executor.query(query, [
    input.recipientId,
    input.type,
    input.title,
    input.body || null,
    input.entityType || null,
    input.entityId || null,
    input.dedupeKey || null,
  ]);
}
