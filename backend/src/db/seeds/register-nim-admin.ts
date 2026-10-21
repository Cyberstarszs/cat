import { pool } from '../connection.js';
import { hashPassword } from '../../lib/hash.js';
import { loginUser } from '../../modules/auth/auth.service.js';

async function registerNimAdmin() {
  const nim = '2023520074';
  const rawPassword = 'Kacongasf231125';

  console.log(`[REGISTER_ADMIN] Memproses pendaftaran NIM ${nim} sebagai admin...`);

  const client = await pool.connect();
  try {
    const hashedPassword = await hashPassword(rawPassword);

    await client.query('BEGIN;');

    // 1. Cari apakah profile dengan NIM ini sudah ada
    const { rows: profiles } = await client.query(
      'SELECT user_id, identifier, full_name FROM student_profiles WHERE identifier = $1;',
      [nim]
    );

    let userId: string;

    if (profiles.length > 0) {
      userId = profiles[0].user_id;
      console.log(`[REGISTER_ADMIN] Profil ditemukan untuk ${profiles[0].full_name} (${userId}). Memperbarui role menjadi admin...`);

      await client.query(
        `UPDATE users
         SET role = 'admin',
             password_hash = $1,
             status = 'active',
             must_change_password = false,
             failed_login_count = 0,
             locked_until = NULL,
             updated_at = now()
         WHERE id = $2;`,
        [hashedPassword, userId]
      );

      await client.query(
        `UPDATE student_profiles
         SET initial_password = $1,
             updated_at = now()
         WHERE user_id = $2;`,
        [rawPassword, userId]
      );
    } else {
      console.log(`[REGISTER_ADMIN] Profil belum ada, membuat akun user dan profil admin baru...`);
      const email = `${nim}@fia.unira.ac.id`;

      const { rows: userRows } = await client.query(
        `INSERT INTO users (email, password_hash, role, status, must_change_password)
         VALUES ($1, $2, 'admin', 'active', false)
         RETURNING id;`,
        [email, hashedPassword]
      );
      userId = userRows[0].id;

      await client.query(
        `INSERT INTO student_profiles (user_id, identifier, full_name, institution, initial_password)
         VALUES ($1, $2, 'Administrator ${nim}', 'FIA Universitas Madura', $3);`,
        [userId, nim, rawPassword]
      );
    }

    // Pastikan user_settings ada
    await client.query(
      `INSERT INTO user_settings (user_id, preferences)
       VALUES ($1, '{}'::jsonb)
       ON CONFLICT (user_id) DO NOTHING;`,
      [userId]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_role, action, entity_type, entity_id, reason, after_data)
       VALUES ('admin', 'users.promote_admin', 'users', $1, 'Promoted NIM to admin by user request', $2);`,
      [userId, JSON.stringify({ identifier: nim, role: 'admin' })]
    );

    await client.query('COMMIT;');

    console.log(`[REGISTER_ADMIN] Sukses! Akun NIM ${nim} sekarang aktif sebagai ADMIN.`);

    // Test verifikasi login fungsi auth
    const testLogin = await loginUser(nim, rawPassword);
    console.log('[REGISTER_ADMIN] Verifikasi Login Berhasil:', {
      role: testLogin.user.role,
      email: testLogin.user.email,
      identifier: testLogin.user.student_profile?.identifier,
      fullName: testLogin.user.student_profile?.full_name,
      tokenLength: testLogin.token.length
    });

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[REGISTER_ADMIN] Gagal:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

registerNimAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
