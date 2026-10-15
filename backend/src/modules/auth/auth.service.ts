import crypto from 'node:crypto';
import { pool } from '../../db/connection.js';
import { comparePassword, hashPassword, hashToken } from '../../lib/hash.js';
import { AppError } from '../../lib/errors.js';
import { CONSTANTS } from '../../config/constants.js';
import { logAudit } from '../audit/audit.service.js';

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    role: 'admin' | 'student';
    must_change_password: boolean;
    student_profile?: {
      identifier: string;
      full_name: string;
      institution: string | null;
      phone: string | null;
    } | null;
  };
  expiresAt: Date;
}

export async function loginUser(
  usernameInput: string,
  passwordInput: string,
  ipAddress?: string,
  userAgent?: string
): Promise<LoginResult> {
  const username = usernameInput.trim();
  const isEmail = username.includes('@');

  let userQuery = '';
  let userParam: string = username;

  if (isEmail) {
    userQuery = `
      SELECT 
        u.id, u.email, u.password_hash, u.role, u.status,
        u.must_change_password, u.failed_login_count, u.locked_until,
        sp.identifier, sp.full_name, sp.institution, sp.phone
      FROM users u
      LEFT JOIN student_profiles sp ON sp.user_id = u.id
      WHERE lower(u.email) = lower($1) AND u.deleted_at IS NULL;
    `;
    userParam = username.toLowerCase();
  } else {
    // Identifier-based login (NIM / NISN)
    userQuery = `
      SELECT 
        u.id, u.email, u.password_hash, u.role, u.status,
        u.must_change_password, u.failed_login_count, u.locked_until,
        sp.identifier, sp.full_name, sp.institution, sp.phone
      FROM student_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE sp.identifier = $1 AND u.deleted_at IS NULL;
    `;
  }

  const { rows } = await pool.query(userQuery, [userParam]);

  // Timing attack prevention: run dummy comparison if user doesn't exist
  if (rows.length === 0) {
    await comparePassword(passwordInput, '$2a$12$e80yq9g6L9s/rAqvY/6kpuYm1Jc64f7mF3u8K7c2f6Y3vG2a9kK6G');
    throw new AppError('AUTH_INVALID_CREDENTIALS');
  }

  const user = rows[0];

  // Cek apakah akun suspended
  if (user.status === 'suspended') {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Akun telah dinonaktifkan.');
  }

  // Cek apakah akun terkunci (AUTH_LOCKED)
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000));
    throw new AppError(
      'AUTH_LOCKED',
      `Akun Anda terkunci sementara karena beberapa kali gagal login. Silakan tunggu ${remainingMinutes} menit atau hubungi administrator.`
    );
  }

  // Verifikasi kata sandi
  const isPasswordValid = await comparePassword(passwordInput, user.password_hash);
  if (!isPasswordValid) {
    const newFailCount = (user.failed_login_count || 0) + 1;
    if (newFailCount >= CONSTANTS.LOGIN_MAX_FAILS) {
      const lockUntil = new Date(Date.now() + CONSTANTS.LOGIN_LOCK_MINUTES * 60 * 1000);
      await pool.query(
        `UPDATE users SET failed_login_count = $1, locked_until = $2, updated_at = now() WHERE id = $3;`,
        [newFailCount, lockUntil, user.id]
      );
      await logAudit({
        actorId: user.id,
        actorRole: user.role,
        action: 'auth.locked',
        entityType: 'users',
        entityId: user.id,
        reason: `Exceeded max failed login attempts (${CONSTANTS.LOGIN_MAX_FAILS})`,
        ipAddress,
      });
      throw new AppError(
        'AUTH_LOCKED',
        `Akun Anda telah terkunci selama ${CONSTANTS.LOGIN_LOCK_MINUTES} menit karena 5 kali salah kata sandi.`
      );
    } else {
      await pool.query(
        `UPDATE users SET failed_login_count = $1, updated_at = now() WHERE id = $2;`,
        [newFailCount, user.id]
      );
      throw new AppError('AUTH_INVALID_CREDENTIALS');
    }
  }

  // Reset fail count dan perbarui last_login_at
  await pool.query(
    `UPDATE users 
     SET failed_login_count = 0, locked_until = NULL, last_login_at = now(), updated_at = now()
     WHERE id = $1;`,
    [user.id]
  );

  // Cabut sesi aktif sebelumnya jika mahasiswa (INV-22: single active session untuk integritas ujian)
  if (user.role === 'student') {
    await pool.query(
      `UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL;`,
      [user.id]
    );
  }

  // Buat sesi login baru
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  const durationHours = user.role === 'admin' ? 8 : CONSTANTS.STUDENT_SESSION_MAX_HOURS;
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO auth_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5);`,
    [user.id, tokenHash, userAgent || null, ipAddress || null, expiresAt]
  );

  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: 'auth.login',
    entityType: 'users',
    entityId: user.id,
    ipAddress,
  });

  return {
    token: rawToken,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      must_change_password: user.must_change_password,
      student_profile: user.identifier
        ? {
            identifier: user.identifier,
            full_name: user.full_name,
            institution: user.institution,
            phone: user.phone,
          }
        : null,
    },
  };
}

export async function logoutSession(
  sessionId: string,
  actorId: string,
  actorRole: 'admin' | 'student',
  ipAddress?: string
): Promise<void> {
  await pool.query(
    `UPDATE auth_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL;`,
    [sessionId]
  );

  await logAudit({
    actorId,
    actorRole,
    action: 'auth.logout',
    entityType: 'auth_sessions',
    entityId: sessionId,
    ipAddress,
  });
}

export async function refreshSession(
  rawToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<LoginResult> {
  const tokenHash = hashToken(rawToken);

  const query = `
    SELECT 
      s.id AS session_id, s.expires_at, s.revoked_at, s.created_at AS session_created_at,
      u.id, u.email, u.role, u.status, u.must_change_password, u.password_changed_at,
      sp.identifier, sp.full_name, sp.institution, sp.phone
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN student_profiles sp ON sp.user_id = u.id
    WHERE s.refresh_token_hash = $1 AND u.deleted_at IS NULL;
  `;

  const { rows } = await pool.query(query, [tokenHash]);
  if (rows.length === 0) {
    throw new AppError('AUTH_REQUIRED');
  }

  const s = rows[0];

  if (s.revoked_at || new Date(s.expires_at).getTime() <= Date.now()) {
    throw new AppError('AUTH_REQUIRED');
  }

  if (s.password_changed_at && new Date(s.password_changed_at).getTime() > new Date(s.session_created_at).getTime()) {
    throw new AppError('AUTH_REQUIRED');
  }

  if (s.status === 'suspended') {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Akun telah dinonaktifkan.');
  }

  // Revoke old session and issue new token
  await pool.query(`UPDATE auth_sessions SET revoked_at = now() WHERE id = $1;`, [s.session_id]);

  const newRawToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = hashToken(newRawToken);
  const durationHours = s.role === 'admin' ? 8 : CONSTANTS.STUDENT_SESSION_MAX_HOURS;
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO auth_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5);`,
    [s.id, newTokenHash, userAgent || null, ipAddress || null, expiresAt]
  );

  return {
    token: newRawToken,
    expiresAt,
    user: {
      id: s.id,
      email: s.email,
      role: s.role,
      must_change_password: s.must_change_password,
      student_profile: s.identifier
        ? {
            identifier: s.identifier,
            full_name: s.full_name,
            institution: s.institution,
            phone: s.phone,
          }
        : null,
    },
  };
}

export async function changeUserPassword(
  userId: string,
  oldPass: string,
  newPass: string,
  currentSessionId: string,
  ipAddress?: string
): Promise<void> {
  if (newPass.length < CONSTANTS.PASSWORD_MIN_LENGTH) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Kata sandi baru minimal harus memiliki ${CONSTANTS.PASSWORD_MIN_LENGTH} karakter.`
    );
  }

  // Password complexity check
  if (!/[a-z]/.test(newPass) || !/[A-Z]/.test(newPass) || !/[0-9]/.test(newPass)) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Kata sandi harus mengandung kombinasi huruf besar, huruf kecil, dan angka.'
    );
  }

  if (oldPass === newPass) {
    throw new AppError('VALIDATION_FAILED', 'Kata sandi baru tidak boleh sama dengan kata sandi saat ini.');
  }

  const { rows } = await pool.query(
    `SELECT id, password_hash, role FROM users WHERE id = $1 AND deleted_at IS NULL;`,
    [userId]
  );
  if (rows.length === 0) {
    throw new AppError('NOT_FOUND');
  }

  const user = rows[0];
  const isOldValid = await comparePassword(oldPass, user.password_hash);
  if (!isOldValid) {
    throw new AppError('VALIDATION_FAILED', 'Kata sandi saat ini tidak cocok.');
  }

  const newHash = await hashPassword(newPass);

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    await client.query(
      `UPDATE users 
       SET password_hash = $1, must_change_password = false, password_changed_at = now(), updated_at = now()
       WHERE id = $2;`,
      [newHash, userId]
    );

    // Revoke all other sessions except current (INV-22)
    await client.query(
      `UPDATE auth_sessions
       SET revoked_at = now()
       WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL;`,
      [userId, currentSessionId]
    );

    await logAudit(
      {
        actorId: userId,
        actorRole: user.role,
        action: 'auth.change_password',
        entityType: 'users',
        entityId: userId,
        reason: 'User self-service password update',
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}
