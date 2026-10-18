import crypto from 'node:crypto';
import { pool } from '../../db/connection.js';
import { prisma } from '../../db/prisma.js';
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

  let user: any = null;
  let studentProfile: any = null;

  if (isEmail) {
    user = await prisma.users.findFirst({
      where: {
        email: { equals: username.toLowerCase(), mode: 'insensitive' },
        deleted_at: null,
      },
      include: {
        student_profiles: true,
      },
    });
    if (user) {
      studentProfile = user.student_profiles;
    }
  } else {
    // Identifier-based login (NIM / NISN) via Prisma
    const profile = await prisma.student_profiles.findFirst({
      where: {
        identifier: username,
        users: { deleted_at: null },
      },
      include: {
        users: true,
      },
    });
    if (profile) {
      user = profile.users;
      studentProfile = profile;
    }
  }

  // Timing attack prevention: run dummy comparison if user doesn't exist
  if (!user) {
    await comparePassword(passwordInput, '$2a$12$e80yq9g6L9s/rAqvY/6kpuYm1Jc64f7mF3u8K7c2f6Y3vG2a9kK6G');
    throw new AppError('AUTH_INVALID_CREDENTIALS');
  }

  // Cek apakah akun suspended
  if (user.status === 'suspended') {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Akun telah dinonaktifkan.');
  }

  // Verifikasi kata sandi
  const isPasswordValid = await comparePassword(passwordInput, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('AUTH_INVALID_CREDENTIALS');
  }

  // Reset fail count dan perbarui last_login_at via Prisma
  await prisma.users.update({
    where: { id: user.id },
    data: {
      failed_login_count: 0,
      locked_until: null,
      last_login_at: new Date(),
    },
  });

  // Cabut sesi aktif sebelumnya jika mahasiswa (INV-22: single active session untuk integritas ujian)
  if (user.role === 'student') {
    await prisma.auth_sessions.updateMany({
      where: { user_id: user.id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  // Buat sesi login baru via Prisma
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  const durationHours = user.role === 'admin' ? 8 : CONSTANTS.STUDENT_SESSION_MAX_HOURS;
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  await prisma.auth_sessions.create({
    data: {
      user_id: user.id,
      refresh_token_hash: tokenHash,
      user_agent: userAgent || null,
      ip_address: ipAddress || null,
      expires_at: expiresAt,
    },
  });

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
      student_profile: studentProfile
        ? {
            identifier: studentProfile.identifier,
            full_name: studentProfile.full_name,
            institution: studentProfile.institution,
            phone: studentProfile.phone,
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
  await prisma.auth_sessions.updateMany({
    where: { id: sessionId, revoked_at: null },
    data: { revoked_at: new Date() },
  });

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

  const s = await prisma.auth_sessions.findFirst({
    where: {
      refresh_token_hash: tokenHash,
      users: { deleted_at: null },
    },
    include: {
      users: {
        include: {
          student_profiles: true,
        },
      },
    },
  });

  if (!s) {
    throw new AppError('AUTH_REQUIRED');
  }

  const u = s.users;

  if (s.revoked_at || new Date(s.expires_at).getTime() <= Date.now()) {
    throw new AppError('AUTH_REQUIRED');
  }

  if (u.password_changed_at && new Date(u.password_changed_at).getTime() > new Date(s.created_at).getTime() + 2000) {
    throw new AppError('AUTH_REQUIRED');
  }

  if (u.status === 'suspended') {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Akun telah dinonaktifkan.');
  }

  // Revoke old session and issue new token via Prisma
  await prisma.auth_sessions.update({
    where: { id: s.id },
    data: { revoked_at: new Date() },
  });

  const newRawToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = hashToken(newRawToken);
  const durationHours = u.role === 'admin' ? 8 : CONSTANTS.STUDENT_SESSION_MAX_HOURS;
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  await prisma.auth_sessions.create({
    data: {
      user_id: u.id,
      refresh_token_hash: newTokenHash,
      user_agent: userAgent || null,
      ip_address: ipAddress || null,
      expires_at: expiresAt,
    },
  });

  const sp = u.student_profiles;

  return {
    token: newRawToken,
    expiresAt,
    user: {
      id: u.id,
      email: u.email,
      role: u.role,
      must_change_password: u.must_change_password,
      student_profile: sp
        ? {
            identifier: sp.identifier,
            full_name: sp.full_name,
            institution: sp.institution,
            phone: sp.phone,
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

  const user = await prisma.users.findFirst({
    where: { id: userId, deleted_at: null },
    select: { id: true, password_hash: true, role: true },
  });
  if (!user) {
    throw new AppError('NOT_FOUND');
  }

  const isOldValid = await comparePassword(oldPass, user.password_hash);
  if (!isOldValid) {
    throw new AppError('VALIDATION_FAILED', 'Kata sandi saat ini tidak cocok.');
  }

  const newHash = await hashPassword(newPass);

  await prisma.$transaction(async (tx) => {
    await tx.users.update({
      where: { id: userId },
      data: {
        password_hash: newHash,
        must_change_password: false,
        password_changed_at: new Date(),
      },
    });

    // Revoke all other sessions except current (INV-22)
    await tx.auth_sessions.updateMany({
      where: {
        user_id: userId,
        id: { not: currentSessionId },
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    });

    await logAudit({
      actorId: userId,
      actorRole: user.role,
      action: 'auth.change_password',
      entityType: 'users',
      entityId: userId,
      reason: 'User self-service password update',
      ipAddress,
    });
  });
}
