import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { loginUser, logoutSession, refreshSession, changeUserPassword } from './auth.service.js';
import { authenticate } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';

const loginSchema = z.object({
  username: z.string().min(1, 'Email atau Nomor Identitas wajib diisi'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

const changePasswordSchema = z.object({
  old_password: z.string().min(1, 'Kata sandi lama wajib diisi'),
  new_password: z.string().min(10, 'Kata sandi baru minimal 10 karakter'),
});

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /auth/login
  fastify.post('/auth/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_FAILED', 'Format data tidak valid', parseResult.error.format());
    }

    const { username, password } = parseResult.data;
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    const result = await loginUser(username, password, ipAddress, userAgent);

    const isSecureCookie = process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && request.protocol === 'https');

    // Set cookie httpOnly (INV-22)
    reply.setCookie('session_token', result.token, {
      path: '/',
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: 'lax',
      expires: result.expiresAt,
    });

    return reply.send({
      success: true,
      token: result.token, // Return token for API clients / bearer header support
      user: result.user,
      expires_at: result.expiresAt,
    });
  });

  // POST /auth/logout
  fastify.post('/auth/logout', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const user = request.user!;
      const ipAddress = request.ip;

      await logoutSession(user.session_id, user.id, user.role, ipAddress);

      reply.clearCookie('session_token', { path: '/' });
      return reply.send({ success: true, message: 'Berhasil keluar.' });
    },
  });

  // POST /auth/refresh
  fastify.post('/auth/refresh', async (request, reply) => {
    const token = request.cookies.session_token || request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new AppError('AUTH_REQUIRED');
    }

    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    const result = await refreshSession(token, ipAddress, userAgent);

    const isSecureCookie = process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && request.protocol === 'https');

    reply.setCookie('session_token', result.token, {
      path: '/',
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: 'lax',
      expires: result.expiresAt,
    });

    return reply.send({
      success: true,
      token: result.token,
      user: result.user,
      expires_at: result.expiresAt,
    });
  });

  // Handler ganti kata sandi (FR-A03 & INV-22)
  const handleChangePassword = async (request: any, reply: any) => {
    const user = request.user!;
    const parseResult = changePasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_FAILED', 'Format kata sandi tidak memenuhi syarat (minimal 10 karakter)', parseResult.error.format());
    }

    const { old_password, new_password } = parseResult.data;
    const ipAddress = request.ip;

    await changeUserPassword(user.id, old_password, new_password, user.session_id, ipAddress);

    return reply.send({
      success: true,
      message: 'Kata sandi berhasil diperbarui.',
    });
  };

  // Support both /auth/change-password and /me/password
  fastify.post('/auth/change-password', {
    preHandler: [authenticate],
    handler: handleChangePassword,
  });

  fastify.post('/me/password', {
    preHandler: [authenticate],
    handler: handleChangePassword,
  });
};
