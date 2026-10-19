import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../../db/connection.js';
import { authenticate, requireRoles } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import {
  createSession,
  publishSession,
  cancelSession,
  setSessionAccessCode,
  previewEnrollStudents,
  enrollStudents,
  getCandidateStudents,
  extendAllAttempts,
  publishSessionResults,
  finalizeSession,
  regradeSession,
} from './sessions.service.js';
import { startExamAttempt } from '../attempts/attempts.service.js';
import { logAudit } from '../audit/audit.service.js';

const createSessionSchema = z.object({
  exam_id: z.string().uuid(),
  code: z.string().min(2).max(30),
  name: z.string().min(3).max(200),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  capacity: z.number().int().positive().optional().nullable(),
  access_code: z.string().min(4).max(30).optional().nullable(),
  question_year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
});

const updateSessionSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  capacity: z.number().int().positive().optional().nullable(),
  question_year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
});

const accessCodeSchema = z.object({
  access_code: z.string().optional().nullable(),
});


const extendEndSchema = z.object({
  extra_minutes: z.number().int().min(1).max(180),
  reason: z.string().min(3),
});

const enrollSchema = z.object({
  student_identifiers: z.array(z.string().min(1)).min(1),
});

const extendAllSchema = z.object({
  extra_minutes: z.number().int().min(1).max(60),
});

const startAttemptSchema = z.object({
  access_code: z.string().optional(),
});

export const sessionRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // GET /sessions (A)
  fastify.get('/sessions', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const query = request.query as {
        exam_id?: string;
        status?: string;
        limit?: string;
        offset?: string;
      };

      const limit = Math.min(Math.max(parseInt(query.limit || '25', 10), 1), 100);
      const offset = Math.max(parseInt(query.offset || '0', 10), 0);

      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (query.exam_id) {
        conditions.push(`s.exam_id = $${idx++}`);
        params.push(query.exam_id);
      }
      if (query.status) {
        conditions.push(`s.status = $${idx++}`);
        params.push(query.status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await pool.query(
        `SELECT COUNT(*) AS total FROM exam_sessions s ${whereClause};`,
        params
      );
      const total = parseInt(countRes.rows[0].total, 10);

      const dataQuery = `
        SELECT 
          s.id, s.exam_id, s.code, s.name, s.starts_at, s.ends_at, s.capacity,
          CASE 
            WHEN s.status = 'cancelled' THEN 'cancelled'
            WHEN s.status = 'draft' THEN 'draft'
            WHEN now() < s.starts_at THEN 'scheduled'
            WHEN now() >= s.ends_at OR EXISTS (
              SELECT 1 FROM results r 
              JOIN attempts a ON a.id = r.attempt_id 
              JOIN session_enrollments se ON se.id = a.enrollment_id 
              WHERE se.session_id = s.id AND r.status = 'published'
            ) THEN 'completed'
            ELSE 'active'
          END AS status,
          s.status AS raw_status,
          s.question_year, (s.access_code_hash IS NOT NULL) AS has_access_code, s.created_at,
          e.title AS exam_title, e.duration_minutes,
          COUNT(DISTINCT se.id) AS enrolled_count
        FROM exam_sessions s
        JOIN exams e ON e.id = s.exam_id
        LEFT JOIN session_enrollments se ON se.session_id = s.id
        ${whereClause}
        GROUP BY s.id, e.id
        ORDER BY s.starts_at DESC
        LIMIT $${idx++} OFFSET $${idx++};
      `;
      params.push(limit, offset);

      const { rows } = await pool.query(dataQuery, params);
      return reply.send({ data: rows, meta: { total, limit, offset } });
    },
  });

  // POST /sessions (A, FR-S01)
  fastify.post('/sessions', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const parse = createSessionSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format data sesi salah', parse.error.format());

      const result = await createSession(parse.data, request.user!.id, request.ip);
      return reply.status(201).send({ success: true, session: result });
    },
  });

  // GET /sessions/:id (A)
  fastify.get('/sessions/:id', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      const { rows } = await pool.query(
        `SELECT 
          s.id, s.exam_id, s.code, s.name, s.starts_at, s.ends_at, s.capacity,
          CASE 
            WHEN s.status = 'cancelled' THEN 'cancelled'
            WHEN s.status = 'draft' THEN 'draft'
            WHEN now() < s.starts_at THEN 'scheduled'
            WHEN now() >= s.ends_at OR EXISTS (
              SELECT 1 FROM results r 
              JOIN attempts a ON a.id = r.attempt_id 
              JOIN session_enrollments se ON se.id = a.enrollment_id 
              WHERE se.session_id = s.id AND r.status = 'published'
            ) THEN 'completed'
            ELSE 'active'
          END AS status,
          s.status AS raw_status,
          s.question_year, (s.access_code_hash IS NOT NULL) AS has_access_code,
          s.created_at, s.updated_at,
          e.title AS exam_title, e.duration_minutes, e.passing_score, e.question_count,
          COUNT(DISTINCT se.id) AS enrolled_count
         FROM exam_sessions s
         JOIN exams e ON e.id = s.exam_id
         LEFT JOIN session_enrollments se ON se.session_id = s.id
         WHERE s.id = $1
         GROUP BY s.id, e.id;`,
        [id]
      );

      if (rows.length === 0) throw new AppError('NOT_FOUND');
      return reply.send({ session: rows[0] });
    },
  });

  // PATCH /sessions/:id (A)
  fastify.patch('/sessions/:id', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = updateSessionSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format pembaruan sesi salah', parse.error.format());

      // Cek apakah sudah ada attempt (SESSION_LOCKED)
      const { rows: check } = await pool.query(
        `SELECT COUNT(*) AS count FROM attempts a JOIN session_enrollments se ON se.id = a.enrollment_id WHERE se.session_id = $1;`,
        [id]
      );
      if (parseInt(check[0].count, 10) > 0) {
        throw new AppError('SESSION_LOCKED', 'Jadwal sesi tidak dapat diubah karena sudah memiliki percobaan ujian.');
      }

      const updates: string[] = ['updated_at = now()'];
      const params: any[] = [];
      let idx = 1;

      if (parse.data.name !== undefined) {
        updates.push(`name = $${idx++}`);
        params.push(parse.data.name.trim());
      }
      if (parse.data.starts_at !== undefined) {
        updates.push(`starts_at = $${idx++}`);
        params.push(new Date(parse.data.starts_at).toISOString());
      }
      if (parse.data.ends_at !== undefined) {
        updates.push(`ends_at = $${idx++}`);
        params.push(new Date(parse.data.ends_at).toISOString());
      }
      if (parse.data.capacity !== undefined) {
        updates.push(`capacity = $${idx++}`);
        params.push(parse.data.capacity || null);
      }
      if (parse.data.question_year !== undefined) {
        updates.push(`question_year = $${idx++}`);
        params.push(parse.data.question_year || null);
      }

      params.push(id);
      const { rows } = await pool.query(
        `UPDATE exam_sessions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *;`,
        params
      );
      if (rows.length === 0) throw new AppError('NOT_FOUND');

      await logAudit({
        actorId: request.user!.id,
        actorRole: 'admin',
        action: 'sessions.update',
        entityType: 'exam_sessions',
        entityId: id,
        afterData: rows[0],
        ipAddress: request.ip,
      });

      return reply.send({ success: true, session: rows[0] });
    },
  });

  // POST /sessions/:id/publish (A, FR-S02)
  fastify.post('/sessions/:id/publish', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await publishSession(id, request.user!.id, request.ip);
      return reply.send({ success: true, session: result });
    },
  });

  // POST /sessions/:id/cancel (A, FR-S03)
  fastify.post('/sessions/:id/cancel', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await cancelSession(id, request.user!.id, request.ip);
      return reply.send({ success: true, session: result });
    },
  });

  // POST /sessions/:id/access-code (A, FR-S06)
  fastify.post('/sessions/:id/access-code', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = accessCodeSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format kode akses salah');

      const result = await setSessionAccessCode(id, parse.data.access_code || null, request.user!.id, request.ip);
      return reply.send(result);
    },
  });

  // POST /sessions/:id/extend-end (A, FR-S07)
  fastify.post('/sessions/:id/extend-end', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = extendEndSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format perpanjangan salah', parse.error.format());

      const { extra_minutes, reason } = parse.data;

      const { rows } = await pool.query(
        `UPDATE exam_sessions
         SET ends_at = ends_at + ($1 || ' minutes')::interval,
             updated_at = now()
         WHERE id = $2
         RETURNING id, name, starts_at, ends_at;`,
        [extra_minutes, id]
      );
      if (rows.length === 0) throw new AppError('NOT_FOUND');

      await logAudit({
        actorId: request.user!.id,
        actorRole: 'admin',
        action: 'sessions.extend_end',
        entityType: 'exam_sessions',
        entityId: id,
        reason: `Extended session end by ${extra_minutes} mins: ${reason}`,
        afterData: rows[0],
        ipAddress: request.ip,
      });

      return reply.send({ success: true, session: rows[0] });
    },
  });

  // GET /sessions/:id/enrollments (A, FR-S04)
  fastify.get('/sessions/:id/enrollments', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      const { rows } = await pool.query(
        `SELECT 
          se.id AS enrollment_id, se.status AS enrollment_status, se.registered_at,
          sp.identifier, sp.full_name, sp.institution, sp.phone, u.email,
          a.id AS attempt_id, a.attempt_no, a.status AS attempt_status,
          r.id AS result_id, r.score, r.passed
         FROM session_enrollments se
         JOIN users u ON u.id = se.student_id
         JOIN student_profiles sp ON sp.user_id = u.id
         LEFT JOIN attempts a ON a.enrollment_id = se.id AND a.status <> 'void'
         LEFT JOIN results r ON r.attempt_id = a.id
         WHERE se.session_id = $1
         ORDER BY sp.identifier ASC;`,
        [id]
      );

      return reply.send({ data: rows });
    },
  });

  // GET /sessions/:id/candidates (Admin - FR-S04 List Candidates & Auto Allocation)
  fastify.get('/sessions/:id/candidates', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await getCandidateStudents(id);
      return reply.send(result);
    },
  });

  // POST /sessions/:id/enrollments/preview (A, FR-S04)
  fastify.post('/sessions/:id/enrollments/preview', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = enrollSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format daftar peserta salah', parse.error.format());

      const result = await previewEnrollStudents(id, parse.data.student_identifiers);
      return reply.send({ success: true, preview: result });
    },
  });

  // POST /sessions/:id/enrollments (A, FR-S04)
  fastify.post('/sessions/:id/enrollments', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = enrollSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format pendaftaran salah', parse.error.format());

      const result = await enrollStudents(id, parse.data.student_identifiers, request.user!.id, request.ip);
      return reply.send({ success: true, ...result });
    },
  });

  // DELETE /sessions/:id/enrollments/:enrollmentId (A, FR-S05)
  fastify.delete('/sessions/:id/enrollments/:enrollmentId', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id, enrollmentId } = request.params as { id: string; enrollmentId: string };

      // Cek apakah sudah pernah attempt
      const { rows: check } = await pool.query('SELECT COUNT(*) AS total FROM attempts WHERE enrollment_id = $1;', [
        enrollmentId,
      ]);
      if (parseInt(check[0].total, 10) > 0) {
        throw new AppError('SESSION_LOCKED', 'Pendaftaran tidak dapat dihapus karena sudah memiliki data ujian.');
      }

      const { rows } = await pool.query(
        'DELETE FROM session_enrollments WHERE id = $1 AND session_id = $2 RETURNING id;',
        [enrollmentId, id]
      );
      if (rows.length === 0) throw new AppError('NOT_FOUND');

      await logAudit({
        actorId: request.user!.id,
        actorRole: 'admin',
        action: 'sessions.unenroll',
        entityType: 'session_enrollments',
        entityId: enrollmentId,
        ipAddress: request.ip,
      });

      return reply.send({ success: true, message: 'Peserta berhasil dibatalkan dari pendaftaran sesi.' });
    },
  });

  // GET /sessions/:id/monitor (A, FR-T12)
  fastify.get('/sessions/:id/monitor', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      // Detail sesi
      const { rows: sRows } = await pool.query(
        `SELECT s.id, s.name, s.code, s.starts_at, s.ends_at, s.capacity, s.status, e.title AS exam_title
         FROM exam_sessions s JOIN exams e ON e.id = s.exam_id WHERE s.id = $1;`,
        [id]
      );
      if (sRows.length === 0) throw new AppError('NOT_FOUND');

      // Daftar peserta & status real-time
      const { rows: participants } = await pool.query(
        `SELECT 
          se.id AS enrollment_id, se.status AS enrollment_status,
          sp.identifier, sp.full_name, sp.institution,
          a.id AS attempt_id, a.status AS attempt_status, a.started_at, a.deadline_at, a.extra_seconds,
          a.submitted_at, a.submit_reason,
          r.score, r.passed,
          COUNT(ans.selected_option_id) AS answered_count,
          COUNT(CASE WHEN ans.is_flagged = true THEN 1 END) AS flagged_count
         FROM session_enrollments se
         JOIN student_profiles sp ON sp.user_id = se.student_id
         LEFT JOIN attempts a ON a.enrollment_id = se.id AND a.status <> 'void'
         LEFT JOIN attempt_questions aq ON aq.attempt_id = a.id
         LEFT JOIN attempt_answers ans ON ans.attempt_question_id = aq.id
         LEFT JOIN results r ON r.attempt_id = a.id
         WHERE se.session_id = $1
         GROUP BY se.id, sp.identifier, sp.full_name, sp.institution, a.id, r.id
         ORDER BY sp.identifier ASC;`,
        [id]
      );

      const totalEnrolled = participants.length;
      const inProgressCount = participants.filter((p) => p.attempt_status === 'in_progress').length;
      const submittedCount = participants.filter(
        (p) => p.attempt_status === 'submitted' || p.attempt_status === 'auto_submitted'
      ).length;
      const absentCount = participants.filter((p) => p.enrollment_status === 'absent').length;

      return reply.send({
        session: sRows[0],
        summary: {
          total_enrolled: totalEnrolled,
          in_progress: inProgressCount,
          submitted: submittedCount,
          absent: absentCount,
        },
        participants,
      });
    },
  });

  // POST /sessions/:id/extend-all (A, FR-R06)
  fastify.post('/sessions/:id/extend-all', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = extendAllSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format perpanjangan salah', parse.error.format());

      const result = await extendAllAttempts(id, parse.data.extra_minutes, request.user!.id, request.ip);
      return reply.send({ success: true, ...result });
    },
  });

  // POST /sessions/:id/publish-results (A, FR-R02)
  fastify.post('/sessions/:id/publish-results', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await publishSessionResults(id, request.user!.id, request.ip);
      return reply.send({ success: true, ...result });
    },
  });

  // POST /sessions/:id/finalize (A, FR-R02)
  fastify.post('/sessions/:id/finalize', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await finalizeSession(id, request.user!.id, request.ip);
      return reply.send(result);
    },
  });

  // POST /sessions/:id/regrade/preview (A, FR-R04)
  fastify.post('/sessions/:id/regrade/preview', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await regradeSession(id, false, request.user!.id, request.ip);
      return reply.send({ success: true, ...result });
    },
  });

  // POST /sessions/:id/regrade (A, FR-R04)
  fastify.post('/sessions/:id/regrade', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await regradeSession(id, true, request.user!.id, request.ip);
      return reply.send({ success: true, ...result });
    },
  });

  // POST /sessions/:id/start (M, FR-T03)
  fastify.post('/sessions/:id/start', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const parse = startAttemptSchema.safeParse(request.body || {});
      const accessCode = parse.success ? parse.data.access_code : undefined;

      const result = await startExamAttempt(id, user.id, accessCode, request.ip);
      return reply.send({ success: true, ...result });
    },
  });

  // POST /sessions/:id/start-attempt (Frontend alias)
  fastify.post('/sessions/:id/start-attempt', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const parse = startAttemptSchema.safeParse(request.body || {});
      const accessCode = parse.success ? parse.data.access_code : undefined;

      const result = await startExamAttempt(id, user.id, accessCode, request.ip);
      return reply.send({ success: true, ...result });
    },
  });
};
