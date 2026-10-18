import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from './errors.js';
import { prisma } from '../db/prisma.js';
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

  const session = await prisma.auth_sessions.findFirst({
    where: {
      refresh_token_hash: tokenHash,
      users: { deleted_at: null },
    },
    include: {
      users: true,
    },
  });

  if (!session) {
    throw new AppError('AUTH_REQUIRED');
  }

  const user = session.users;

  // Cek apakah sesi sudah dicabut atau kedaluwarsa
  if (session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    throw new AppError('AUTH_REQUIRED');
  }

  // Cek apakah password diganti setelah sesi dibuat (toleransi 2000ms untuk drift mikrodetik)
  if (user.password_changed_at && new Date(user.password_changed_at).getTime() > new Date(session.created_at).getTime() + 2000) {
    throw new AppError('AUTH_REQUIRED');
  }

  // Cek apakah akun suspended
  if (user.status === 'suspended') {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Akun telah dinonaktifkan.');
  }

  // Cek must_change_password (FR-A03)
  const cleanUrl = request.url.split('?')[0];
  const isChangePasswordRoute =
    cleanUrl === '/api/v1/me/password' ||
    cleanUrl === '/api/v1/auth/change-password' ||
    cleanUrl === '/api/v1/auth/logout';
  if (user.must_change_password && !isChangePasswordRoute) {
    throw new AppError('AUTH_PASSWORD_CHANGE_REQUIRED');
  }

  request.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    must_change_password: user.must_change_password,
    session_id: session.id,
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
