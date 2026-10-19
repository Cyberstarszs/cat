import { pool } from '../connection.js';
import { env } from '../../config/env.js';
import { hashPassword } from '../../lib/hash.js';

export async function seedAdmin(): Promise<void> {
  const client = await pool.connect();
  try {
    const adminEmail = env.ADMIN_EMAIL.toLowerCase().trim();
    const adminPassword = env.ADMIN_PASSWORD;

    console.log(`[SEED] Checking admin account (${adminEmail})...`);

    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE lower(email) = $1 AND deleted_at IS NULL;',
      [adminEmail]
    );

    if (existing.length > 0) {
      console.log(`[SEED] Admin account ${adminEmail} already exists. Skipping.`);
      return;
    }

    const passwordHash = await hashPassword(adminPassword);

    await client.query('BEGIN;');

    const { rows: userRows } = await client.query(
      `INSERT INTO users (email, password_hash, role, status, must_change_password)
       VALUES ($1, $2, 'admin', 'active', false)
       RETURNING id;`,
      [adminEmail, passwordHash]
    );

    const adminId = userRows[0].id;

    // Create user_settings
    await client.query(
      `INSERT INTO user_settings (user_id, preferences)
       VALUES ($1, '{}'::jsonb);`,
      [adminId]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, reason)
       VALUES ($1, 'admin', 'system.seed_admin', 'users', $1, 'Initial administrator seeding from environment');`,
      [adminId]
    );

    await client.query('COMMIT;');
    console.log(`[SEED] Successfully created initial administrator account: ${adminEmail}`);
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[SEED] Failed to seed administrator:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Auto-run if executed directly via CLI
if (process.argv[1]?.includes('seed-admin')) {
  seedAdmin()
    .then(() => {
      console.log('[SEED] Seeding finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[SEED] Seeding failed:', err);
      process.exit(1);
    });
}
