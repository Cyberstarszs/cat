import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:root@localhost:5432/cat_governance?schema=public'
});

async function run() {
  const adminPasswordHash = await bcrypt.hash('Password123!', 12);
  const studentPasswordHash = await bcrypt.hash('Password123!', 12);
  const defaultAdminHash = await bcrypt.hash('AdminPassword123!', 12);

  // 1. Reset / update default admin
  await pool.query(
    `UPDATE users 
     SET password_hash = $1, failed_login_count = 0, locked_until = NULL, must_change_password = false 
     WHERE lower(email) = lower($2)`,
    [defaultAdminHash, 'admin@fia.kampus.ac.id']
  );

  // 2. Admin Baru
  const adminEmail = 'admin2@fia.kampus.ac.id';
  const existingAdmin = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [adminEmail]);
  if (existingAdmin.rows.length === 0) {
    const res = await pool.query(
      `INSERT INTO users (email, password_hash, role, status, must_change_password)
       VALUES ($1, $2, 'admin', 'active', false)
       RETURNING id`,
      [adminEmail, adminPasswordHash]
    );
    await pool.query('INSERT INTO user_settings (user_id, preferences) VALUES ($1, $2)', [res.rows[0].id, '{}']);
    console.log(`[SUCCESS] Admin baru dibuat: ${adminEmail}`);
  } else {
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, failed_login_count = 0, locked_until = NULL, must_change_password = false 
       WHERE id = $2`,
      [adminPasswordHash, existingAdmin.rows[0].id]
    );
    console.log(`[SUCCESS] Admin diperbarui: ${adminEmail}`);
  }

  // 3. Mahasiswa / Peserta Baru
  const studentEmail = 'peserta@fia.kampus.ac.id';
  const studentIdentifier = '2026001';
  const existingStudent = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [studentEmail]);
  let studentUserId = null;

  if (existingStudent.rows.length === 0) {
    const res = await pool.query(
      `INSERT INTO users (email, password_hash, role, status, must_change_password)
       VALUES ($1, $2, 'student', 'active', false)
       RETURNING id`,
      [studentEmail, studentPasswordHash]
    );
    studentUserId = res.rows[0].id;
    await pool.query('INSERT INTO user_settings (user_id, preferences) VALUES ($1, $2)', [studentUserId, '{}']);
    await pool.query(
      `INSERT INTO student_profiles (user_id, identifier, full_name, institution, phone)
       VALUES ($1, $2, 'Peserta Ujian FIA', 'Fakultas Ilmu Administrasi', '081234567890')
       ON CONFLICT (user_id) DO NOTHING`,
      [studentUserId, studentIdentifier]
    );
    console.log(`[SUCCESS] Peserta baru dibuat: ${studentEmail} (NIM/ID: ${studentIdentifier})`);
  } else {
    studentUserId = existingStudent.rows[0].id;
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, failed_login_count = 0, locked_until = NULL, must_change_password = false 
       WHERE id = $2`,
      [studentPasswordHash, studentUserId]
    );
    await pool.query(
      `INSERT INTO student_profiles (user_id, identifier, full_name, institution, phone)
       VALUES ($1, $2, 'Peserta Ujian FIA', 'Fakultas Ilmu Administrasi', '081234567890')
       ON CONFLICT (user_id) DO UPDATE SET identifier = $2, full_name = 'Peserta Ujian FIA'`,
      [studentUserId, studentIdentifier]
    );
    console.log(`[SUCCESS] Peserta diperbarui: ${studentEmail} (NIM/ID: ${studentIdentifier})`);
  }

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
