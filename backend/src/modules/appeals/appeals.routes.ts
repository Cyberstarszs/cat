import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../../db/connection.js';
import { authenticate, requireRoles } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import { logAudit } from '../audit/audit.service.js';
import { sendNotification } from '../notifications/notifications.service.js';

const respondAppealSchema = z
  .object({
    status: z.enum(['accepted', 'approved', 'rejected']).transform((s) => (s === 'approved' ? 'accepted' : s)),
    response: z.string().optional(),
    admin_notes: z.string().optional(),
  })
  .refine((data) => (data.response && data.response.trim().length >= 3) || (data.admin_notes && data.admin_notes.trim().length >= 3), {
    message: 'Tanggapan sanggah wajib diisi (minimal 3 karakter).',
  })
  .transform((data) => ({
    status: data.status as 'accepted' | 'rejected',
    response: (data.response || data.admin_notes || '').trim(),
  }));

export const appealRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRoles(['admin']));

  // GET /appeals (A, FR-R07)
  fastify.get('/appeals', async (request, reply) => {
    const query = request.query as {
      status?: 'open' | 'accepted' | 'rejected';
      session_id?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(Math.max(parseInt(query.limit || '25', 10), 1), 100);
    const offset = Math.max(parseInt(query.offset || '0', 10), 0);

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (query.status) {
      conditions.push(`ap.status = $${idx++}`);
      params.push(query.status);
    }
    if (query.session_id) {
      conditions.push(`s.id = $${idx++}`);
      params.push(query.session_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total
       FROM appeals ap
       JOIN results r ON r.id = ap.result_id
       JOIN attempts a ON a.id = r.attempt_id
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN exam_sessions s ON s.id = se.session_id
       ${whereClause};`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const dataQuery = `
      SELECT 
        ap.id, ap.message, ap.message AS reason, ap.status, ap.response, ap.response AS admin_notes, ap.created_at, ap.responded_at,
        ap.student_id, sp.identifier, sp.full_name, sp.full_name AS student_name, sp.institution,
        r.id AS result_id, r.score, r.passed,
        s.id AS session_id, s.name AS session_name,
        e.id AS exam_id, e.title AS exam_title,
        qv.id AS question_version_id, qv.stem AS question_stem,
        u_admin.email AS responded_by_email

      FROM appeals ap
      JOIN results r ON r.id = ap.result_id
      JOIN attempts a ON a.id = r.attempt_id
      JOIN session_enrollments se ON se.id = a.enrollment_id
      JOIN users u ON u.id = ap.student_id
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN exam_sessions s ON s.id = se.session_id
      JOIN exams e ON e.id = s.exam_id
      LEFT JOIN question_versions qv ON qv.id = ap.question_version_id
      LEFT JOIN users u_admin ON u_admin.id = ap.responded_by
      ${whereClause}
      ORDER BY ap.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(dataQuery, params);
    return reply.send({ data: rows, meta: { total, limit, offset } });
  });

  // PATCH /appeals/:id (A, FR-R07)
  fastify.patch('/appeals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = respondAppealSchema.safeParse(request.body);
    if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Data tanggapan sanggah tidak valid', parse.error.format());

    const { status, response } = parse.data;
    const adminId = request.user!.id;

    const { rows } = await pool.query(
      `UPDATE appeals
       SET status = $1,
           response = $2,
           responded_by = $3,
           responded_at = now()
       WHERE id = $4
       RETURNING id, student_id, result_id, status, response, responded_at;`,
      [status, response.trim(), adminId, id]
    );

    if (rows.length === 0) throw new AppError('NOT_FOUND');
    const appeal = rows[0];

    // Kirim notifikasi ke mahasiswa
    await sendNotification({
      recipientId: appeal.student_id,
      type: 'appeal_response',
      title: `Tanggapan Pengajuan Sanggah: ${status === 'accepted' ? 'Diterima' : 'Ditolak'}`,
      body: response,
      entityType: 'appeals',
      entityId: appeal.id,
      dedupeKey: `appeal_${appeal.id}_response`,
    });

    await logAudit({
      actorId: adminId,
      actorRole: 'admin',
      action: 'appeals.respond',
      entityType: 'appeals',
      entityId: id,
      afterData: appeal,
      ipAddress: request.ip,
    });

    return reply.send({ success: true, appeal });
  });
};
