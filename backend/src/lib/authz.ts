import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from './errors.js';
import { pool } from '../db/connection.js';
import { hashToken } from './hash.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'student';
  status: 'active' | 'suspended';
  must_change_password: boolean;
  session_id: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * Middleware: Verifikasi sesi autentikasi dari cookie httpOnly (INV-20 & INV-22).
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies.session_token || request.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    throw new AppError('AUTH_REQUIRED');
  }

  const tokenHash = hashToken(token);

  const query = `
    SELECT 
      u.id, u.email, u.role, u.status, u.must_change_password, u.password_changed_at,
      s.id AS session_id, s.expires_at, s.revoked_at, s.created_at AS session_created_at
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.refresh_token_hash = $1 AND u.deleted_at IS NULL
    LIMIT 1;
  `;

  const { rows } = await pool.query(query, [tokenHash]);
  if (rows.length === 0) {
    throw new AppError('AUTH_REQUIRED');
  }

  const session = rows[0];

  // Cek apakah sesi sudah dicabut atau kedaluwarsa
  if (session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    throw new AppError('AUTH_REQUIRED');
  }

  // Cek apakah password diganti setelah sesi dibuat
  if (session.password_changed_at && new Date(session.password_changed_at).getTime() > new Date(session.session_created_at).getTime()) {
    throw new AppError('AUTH_REQUIRED');
  }

  // Cek apakah akun suspended
  if (session.status === 'suspended') {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Akun telah dinonaktifkan.');
  }

  // Cek must_change_password (FR-A03)
  const cleanUrl = request.url.split('?')[0];
  const isChangePasswordRoute =
    cleanUrl === '/api/v1/me/password' ||
    cleanUrl === '/api/v1/auth/change-password' ||
    cleanUrl === '/api/v1/auth/logout';
  if (session.must_change_password && !isChangePasswordRoute) {
    throw new AppError('AUTH_PASSWORD_CHANGE_REQUIRED');
  }

  request.user = {
    id: session.id,
    email: session.email,
    role: session.role,
    status: session.status,
    must_change_password: session.must_change_password,
    session_id: session.session_id,
  };
}

/**
 * Middleware: Pemeriksaan otorisasi berbasis peran (INV-20).
 */
export function requireRoles(roles: ('admin' | 'student')[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AppError('AUTH_REQUIRED');
    }

    if (!roles.includes(request.user.role)) {
      throw new AppError('FORBIDDEN');
    }
  };
}

/**
 * INV-14: Mahasiswa hanya dapat melihat data miliknya. Mengakses ID orang lain mengembalikan 404 (anti-IDOR).
 */
export function checkOwnership(requestedUserId: string, request: FastifyRequest): void {
  if (!request.user) {
    throw new AppError('AUTH_REQUIRED');
  }

  if (request.user.role === 'admin') {
    return;
  }

  if (request.user.id !== requestedUserId) {
    throw new AppError('NOT_FOUND');
  }
}
