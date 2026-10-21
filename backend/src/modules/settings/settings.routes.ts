import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRoles } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import {
  getInstitutionSettings,
  updateInstitutionSettings,
  getSmtpSettings,
  updateSmtpSettings,
} from './settings.service.js';
import { testSmtpConnection } from '../email/email.service.js';
import { pool } from '../../db/connection.js';

const updateSettingsSchema = z.object({
  faculty_name: z.string().min(2).max(150).optional(),
  university_name: z.string().min(2).max(150).optional(),
  decan_name: z.string().min(2).max(150).optional(),
  decan_nip: z.string().max(50).optional(),
  decan_title: z.string().min(2).max(150).optional(),
  cert_city: z.string().min(2).max(100).optional(),
  cert_validity_years: z.number().int().min(1).max(10).optional(),
  cert_no_prefix: z.string().min(2).max(50).optional(),
});

const updateSmtpSchema = z.object({
  enabled: z.boolean().optional(),
  host: z.string().min(1).max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  user: z.string().max(255).optional(),
  pass: z.string().max(255).optional(),
  from_name: z.string().max(255).optional(),
  from_email: z.string().email().optional(),
  rate_limit_per_minute: z.number().int().min(1).max(300).optional(),
  delay_between_emails_ms: z.number().int().min(200).max(10000).optional(),
});

export const settingsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // GET /settings/institution
  fastify.get('/settings/institution', async (_request, reply) => {
    const settings = await getInstitutionSettings();
    return reply.send({ settings });
  });

  // PATCH /settings/institution (Admin only)
  fastify.patch('/settings/institution', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const parse = updateSettingsSchema.safeParse(request.body);
      if (!parse.success) {
        throw new AppError('VALIDATION_FAILED', 'Data pengaturan tidak valid', parse.error.format());
      }

      const updated = await updateInstitutionSettings(
        parse.data,
        request.user!.id,
        request.ip
      );

      return reply.send({ success: true, settings: updated });
    },
  });

  // GET /settings/smtp (Admin only)
  fastify.get('/settings/smtp', {
    preHandler: [requireRoles(['admin'])],
    handler: async (_request, reply) => {
      const smtp = await getSmtpSettings();
      return reply.send({
        smtp: {
          ...smtp,
          pass: smtp.pass ? '••••••••' : '',
          is_configured: !!(smtp.host && smtp.user && smtp.pass),
        },
      });
    },
  });

  // PATCH /settings/smtp (Admin only)
  fastify.patch('/settings/smtp', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const parse = updateSmtpSchema.safeParse(request.body);
      if (!parse.success) {
        throw new AppError('VALIDATION_FAILED', 'Data konfigurasi SMTP tidak valid', parse.error.format());
      }

      const updated = await updateSmtpSettings(
        parse.data,
        request.user!.id,
        request.ip
      );

      return reply.send({
        success: true,
        smtp: {
          ...updated,
          pass: updated.pass ? '••••••••' : '',
          is_configured: !!(updated.host && updated.user && updated.pass),
        },
      });
    },
  });

  // POST /settings/smtp/test (Admin only)
  fastify.post('/settings/smtp/test', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const body = (request.body as any) || {};
      const smtp = await getSmtpSettings();

      // Izinkan testing dengan password yang baru diinput sebelum disimpan
      if (body.pass && body.pass !== '••••••••') {
        smtp.pass = body.pass;
      }
      if (body.host) smtp.host = body.host;
      if (body.port) smtp.port = Number(body.port);
      if (body.user) smtp.user = body.user;
      if (body.from_email) smtp.from_email = body.from_email;

      const result = await testSmtpConnection(smtp, body.test_email);
      return reply.send(result);
    },
  });

  // GET /settings/email-outbox (Admin only - Monitor Antrean Email Sertifikat)
  fastify.get('/settings/email-outbox', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { limit = '20', offset = '0', status } = request.query as any;
      const numLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const numOffset = Math.max(0, parseInt(offset, 10) || 0);

      const params: any[] = [];
      let whereClause = '';
      if (status && ['pending', 'sending', 'sent', 'failed'].includes(status)) {
        params.push(status);
        whereClause = `WHERE o.status = $1`;
      }

      // Query Stats Ringkasan
      const { rows: statsRows } = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
          COUNT(*) FILTER (WHERE status = 'sending') AS sending_count,
          COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
          COUNT(*) AS total_count
        FROM email_outbox;
      `);

      const countQuery = `SELECT COUNT(*) AS total FROM email_outbox o ${whereClause};`;
      const { rows: countRows } = await pool.query(countQuery, params);
      const total = parseInt(countRows[0].total, 10);

      const dataQuery = `
        SELECT 
          o.id, o.certificate_id, o.recipient_email, o.recipient_name,
          o.subject, o.status, o.attempts, o.max_attempts, o.last_error,
          o.next_retry_at, o.sent_at, o.created_at,
          c.certificate_no, sp.identifier
        FROM email_outbox o
        LEFT JOIN certificates c ON c.id = o.certificate_id
        LEFT JOIN results r ON r.id = c.result_id
        LEFT JOIN attempts a ON a.id = r.attempt_id
        LEFT JOIN session_enrollments se ON se.id = a.enrollment_id
        LEFT JOIN student_profiles sp ON sp.user_id = se.student_id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2};
      `;
      params.push(numLimit, numOffset);

      const { rows: items } = await pool.query(dataQuery, params);

      return reply.send({
        items,
        stats: statsRows[0],
        meta: { total, limit: numLimit, offset: numOffset },
      });
    },
  });

  // POST /settings/email-outbox/:id/retry (Admin only - Ulangi pengiriman email gagal)
  fastify.post('/settings/email-outbox/:id/retry', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      const { rows } = await pool.query(
        `UPDATE email_outbox
         SET status = 'pending', attempts = 0, next_retry_at = now(), last_error = NULL
         WHERE id = $1
         RETURNING id;`,
        [id]
      );

      if (rows.length === 0) {
        throw new AppError('NOT_FOUND', 'Item antrean email tidak ditemukan.');
      }

      return reply.send({ success: true, message: 'Email berhasil direset dan siap dikirim ulang oleh antrean.' });
    },
  });
};

