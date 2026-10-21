import { pool } from '../connection.js';
import { hashPassword } from '../../lib/hash.js';

async function main() {
  const email = process.env.NEW_ADMIN_EMAIL || 'admin3@fia.kampus.ac.id';
  const rawPassword = process.env.NEW_ADMIN_PASSWORD || 'AdminFIA2026!';

  console.log(`[CREATE_ADMIN] Memeriksa akun admin (${email})...`);

  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL;',
      [email]
    );

    const passwordHash = await hashPassword(rawPassword);

    await client.query('BEGIN;');

    let userId: string;
    if (existing.length > 0) {
      userId = existing[0].id;
      await client.query(
        `UPDATE users
         SET password_hash = $1, status = 'active', failed_login_count = 0, locked_until = NULL, must_change_password = false, updated_at = now()
         WHERE id = $2;`,
        [passwordHash, userId]
      );
      console.log(`[CREATE_ADMIN] Akun admin ${email} telah diperbarui dengan kata sandi baru.`);
    } else {
      const { rows: userRows } = await client.query(
        `INSERT INTO users (email, password_hash, role, status, must_change_password)
         VALUES ($1, $2, 'admin', 'active', false)
         RETURNING id;`,
        [email, passwordHash]
      );
      userId = userRows[0].id;

      await client.query(
        `INSERT INTO user_settings (user_id, preferences)
         VALUES ($1, '{}'::jsonb)
         ON CONFLICT (user_id) DO NOTHING;`,
        [userId]
      );

      await client.query(
        `INSERT INTO audit_logs (actor_role, action, entity_type, entity_id, reason, after_data)
         VALUES ('admin', 'users.create_admin', 'users', $1, 'Admin account created via create-admin-user script', $2);`,
        [userId, JSON.stringify({ email, role: 'admin' })]
      );

      console.log(`[CREATE_ADMIN] Akun admin ${email} berhasil dibuat.`);
    }

    await client.query('COMMIT;');

    console.log('\n=============================================');
    console.log('KREDENSIAL AKUN ADMIN BARU:');
    console.log(`Email    : ${email}`);
    console.log(`Password : ${rawPassword}`);
    console.log(`Role     : admin`);
    console.log(`Status   : active`);
    console.log('=============================================\n');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[CREATE_ADMIN] Gagal membuat admin:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
