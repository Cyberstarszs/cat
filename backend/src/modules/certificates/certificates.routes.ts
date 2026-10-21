import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../../db/connection.js';
import { authenticate, requireRoles, isStudentRole } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import {
  revokeCertificate,
  verifyCertificatePublic,
  generateCertificatePDFBuffer,
} from './certificates.service.js';

const revokeSchema = z.object({
  reason: z.string().min(3, 'Alasan pencabutan sertifikat wajib diisi.'),
});

export const certificateRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /verify/:code (Publik, tanpa login, FR-C03)
  fastify.get('/verify/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const result = await verifyCertificatePublic(code);
    return reply.send({ certificate: result });
  });

  // GET /certificates (A, FR-C01)
  fastify.get('/certificates', {
    preHandler: [authenticate, requireRoles(['admin'])],
    handler: async (request, reply) => {
      const query = request.query as {
        status?: 'valid' | 'revoked';
        search?: string;
        limit?: string;
        offset?: string;
      };

      const limit = Math.min(Math.max(parseInt(query.limit || '25', 10), 1), 100);
      const offset = Math.max(parseInt(query.offset || '0', 10), 0);

      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (query.status) {
        conditions.push(`c.status = $${idx++}`);
        params.push(query.status);
      }

      if (query.search) {
        conditions.push(`(sp.full_name ILIKE $${idx} OR sp.identifier ILIKE $${idx} OR c.certificate_no ILIKE $${idx})`);
        params.push(`%${query.search}%`);
        idx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await pool.query(
        `SELECT COUNT(*) AS total
         FROM certificates c
         JOIN results r ON r.id = c.result_id
         JOIN attempts a ON a.id = r.attempt_id
         JOIN session_enrollments se ON se.id = a.enrollment_id
         JOIN student_profiles sp ON sp.user_id = se.student_id
         ${whereClause};`,
        params
      );
      const total = parseInt(countRes.rows[0].total, 10);

      const dataQuery = `
        SELECT 
          c.id, c.certificate_no, c.verification_code, c.status, c.issued_at,
          c.revoked_at, c.revoked_reason,
          sp.identifier, sp.full_name, sp.full_name AS student_name, sp.institution,
          e.title AS exam_title, r.score
        FROM certificates c
        JOIN results r ON r.id = c.result_id
        JOIN attempts a ON a.id = r.attempt_id
        JOIN session_enrollments se ON se.id = a.enrollment_id
        JOIN student_profiles sp ON sp.user_id = se.student_id
        JOIN exam_sessions s ON s.id = se.session_id
        JOIN exams e ON e.id = s.exam_id
        ${whereClause}
        ORDER BY c.issued_at DESC
        LIMIT $${idx++} OFFSET $${idx++};
      `;
      params.push(limit, offset);

      const { rows } = await pool.query(dataQuery, params);
      return reply.send({ data: rows, meta: { total, limit, offset } });
    },
  });

  // GET /certificates/:id (A, M, FR-C01, INV-14)
  fastify.get('/certificates/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const query = `
        SELECT 
          c.id, c.certificate_no, c.verification_code, c.status, c.issued_at,
          c.revoked_at, c.revoked_reason,
          r.id AS result_id, r.score, r.passed,
          sp.identifier, sp.full_name, sp.full_name AS student_name, sp.institution,
          e.id AS exam_id, e.title AS exam_title,
          se.student_id
        FROM certificates c
        JOIN results r ON r.id = c.result_id
        JOIN attempts a ON a.id = r.attempt_id
        JOIN session_enrollments se ON se.id = a.enrollment_id
        JOIN student_profiles sp ON sp.user_id = se.student_id
        JOIN exam_sessions s ON s.id = se.session_id
        JOIN exams e ON e.id = s.exam_id
        WHERE c.id = $1;
      `;

      const { rows } = await pool.query(query, [id]);
      if (rows.length === 0) throw new AppError('NOT_FOUND');

      const cert = rows[0];
      if (isStudentRole(user.role) && cert.student_id !== user.id) {
        throw new AppError('NOT_FOUND'); // Anti-IDOR (INV-14)
      }

      return reply.send({ certificate: cert });
    },
  });

  // GET /certificates/:id/pdf (A, M, FR-C02)
  fastify.get('/certificates/:id/pdf', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      // Cek izin akses jika mahasiswa (anti-IDOR, INV-14)
      if (isStudentRole(user.role)) {
        const { rows } = await pool.query(
          `SELECT se.student_id
           FROM certificates c
           JOIN results r ON r.id = c.result_id
           JOIN attempts a ON a.id = r.attempt_id
           JOIN session_enrollments se ON se.id = a.enrollment_id
           WHERE c.id = $1;`,
          [id]
        );
        if (rows.length === 0 || rows[0].student_id !== user.id) {
          throw new AppError('NOT_FOUND');
        }
      }

      const origin = (request.headers.origin as string) || (request.headers.referer as string) || '';
      let frontendUrl = 'http://localhost:5173';
      if (origin) {
        try {
          const u = new URL(origin);
          frontendUrl = `${u.protocol}//${u.host}`;
        } catch {}
      } else if (request.headers.host) {
        const hostWithoutPort = (request.headers.host as string).split(':')[0];
        frontendUrl = `http://${hostWithoutPort}:5173`;
      }

      const pdfBuffer = await generateCertificatePDFBuffer(id, frontendUrl);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="sertifikat_${id.slice(0, 8)}.pdf"`);
      return reply.send(pdfBuffer);
    },
  });

  // POST /certificates/:id/revoke (A, FR-C04)
  fastify.post('/certificates/:id/revoke', {
    preHandler: [authenticate, requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = revokeSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Alasan pencabutan wajib diisi', parse.error.format());

      const result = await revokeCertificate(id, parse.data.reason, 'manual', request.user!.id);
      return reply.send({ success: true, certificate: result });
    },
  });
};
