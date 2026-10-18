import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import crypto from 'node:crypto';

import { env } from './config/env.js';
import { CONSTANTS } from './config/constants.js';
import { handleGlobalError } from './lib/errors.js';
import { pool, getPoolMetrics } from './db/connection.js';
import { checkClockDrift } from './lib/time.js';

// Route modules
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { meRoutes } from './modules/me/me.routes.js';
import { questionRoutes } from './modules/questions/questions.routes.js';
import { examRoutes } from './modules/exams/exams.routes.js';
import { sessionRoutes } from './modules/sessions/sessions.routes.js';
import { attemptRoutes } from './modules/attempts/attempts.routes.js';
import { resultRoutes } from './modules/results/results.routes.js';
import { certificateRoutes } from './modules/certificates/certificates.routes.js';
import { reportRoutes } from './modules/reports/reports.routes.js';
import { appealRoutes } from './modules/appeals/appeals.routes.js';
import { notificationRoutes } from './modules/notifications/notifications.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    genReqId: () => crypto.randomUUID(),
    logger: env.NODE_ENV === 'development'
      ? {
          level: 'info',
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : { level: 'warn' },
  });

  // Global Error Handler
  fastify.setErrorHandler(handleGlobalError);

  // Register Core Plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });

  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
    if (!body || body.trim() === '') {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body));
    } catch (err: any) {
      done(err, undefined);
    }
  });

  await fastify.register(cookie, {
    secret: env.APP_SECRET,
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: CONSTANTS.CSV_MAX_BYTES, // 5 MB
      files: 1,
    },
  });

  await fastify.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return (request.headers.authorization as string) || (request.cookies?.session_token as string) || request.ip;
    },
  });

  // Health check endpoint (Enhanced with NTP Clock Drift & Pool Monitoring)
  fastify.get('/health', async (_request, reply) => {
    try {
      const clock = await checkClockDrift();
      const poolMetrics = getPoolMetrics();

      return reply.send({
        status: clock.status === 'CRITICAL' ? 'DEGRADED' : 'UP',
        timestamp: clock.dbTime,
        uptime_seconds: Math.floor(process.uptime()),
        clock: {
          status: clock.status,
          drift_ms: clock.driftMs,
          is_synced: clock.isSynced,
          message: clock.message,
        },
        database: {
          status: 'CONNECTED',
          pool: poolMetrics,
        },
      });
    } catch (err: any) {
      return reply.status(503).send({
        status: 'DOWN',
        database: 'UNREACHABLE',
        error: err.message,
      });
    }
  });

  // Root welcome endpoint
  fastify.get('/', async (_request, reply) => {
    return reply.send({
      app: 'CAT GOVERNANCE',
      description: 'Sistem Uji Kompetensi Berbasis Komputer Fakultas Ilmu Administrasi (FIA)',
      status: 'ONLINE',
      version: '1.0.0',
      api_v1: '/api/v1',
      health: '/health',
      verify: '/verify/:code',
    });
  });

  // Favicon handler to avoid 404 in browser
  fastify.get('/favicon.ico', async (_request, reply) => {
    return reply.status(204).send();
  });

  // Root certificate verify alias (convenience for QR code scans)
  fastify.get('/verify/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    return reply.redirect(`/api/v1/verify/${code}`);
  });

  // Register API v1 Routes
  await fastify.register(
    async (v1) => {
      // Re-export health on /api/v1/health as well
      v1.get('/health', async (_request, reply) => {
        try {
          const clock = await checkClockDrift();
          const poolMetrics = getPoolMetrics();
          return reply.send({
            status: clock.status === 'CRITICAL' ? 'DEGRADED' : 'UP',
            timestamp: clock.dbTime,
            clock: {
              status: clock.status,
              drift_ms: clock.driftMs,
              is_synced: clock.isSynced,
              message: clock.message,
            },
            database: {
              status: 'CONNECTED',
              pool: poolMetrics,
            },
          });
        } catch (err: any) {
          return reply.status(503).send({
            status: 'DOWN',
            database: 'UNREACHABLE',
            error: err.message,
          });
        }
      });

      await v1.register(authRoutes);
      await v1.register(userRoutes);
      await v1.register(meRoutes);
      await v1.register(questionRoutes);
      await v1.register(examRoutes);
      await v1.register(sessionRoutes);
      await v1.register(attemptRoutes);
      await v1.register(resultRoutes);
      await v1.register(certificateRoutes);
      await v1.register(reportRoutes);
      await v1.register(appealRoutes);
      await v1.register(notificationRoutes);
      await v1.register(auditRoutes);
    },
    { prefix: '/api/v1' }
  );

  return fastify;
}
