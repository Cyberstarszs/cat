import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../../db/connection.js';
import { authenticate, requireRoles, isStudentRole } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import {
  getAttemptState,
  getAttemptQuestions,
  saveAttemptAnswer,
  submitExamAttempt,
  voidExamAttempt,
  extendSingleAttempt,
  recordAttemptEvent,
} from './attempts.service.js';

const saveAnswerSchema = z.object({
  selected_option_id: z.string().uuid().optional().nullable(),
  is_flagged: z.boolean().default(false),
  client_seq: z.number().int().min(0),
});

const submitSchema = z.object({
  reason: z.enum(['manual', 'timeout', 'forced']).default('manual'),
});

const voidSchema = z.object({
  reason: z.string().min(3, 'Alasan pembatalan (void) wajib diisi.'),
});

const extendSchema = z.object({
  extra_minutes: z.number().int().min(1).max(60),
  reason: z.string().min(3, 'Alasan penambahan waktu wajib diisi.'),
});

const eventSchema = z.object({
  event_type: z.string().min(1).max(30),
  client_time: z.string().optional().nullable(),
  detail: z.record(z.string(), z.any()).optional().nullable(),
});

export const attemptRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // GET /attempts/:id/state (M, FR-T07, T08)
  fastify.get('/attempts/:id/state', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const state = await getAttemptState(id, user.id);
      return reply.send({ state });
    },
  });

  // GET /attempts/:id/questions (M, FR-T04)
  fastify.get('/attempts/:id/questions', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const result = await getAttemptQuestions(id, user.id);
      return reply.send(result);
    },
  });

  // PUT /attempts/:id/answers/:position (M, FR-T05)
  fastify.put('/attempts/:id/answers/:position', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const { id, position } = request.params as { id: string; position: string };
      const user = request.user!;
      const posNum = parseInt(position, 10);
      if (isNaN(posNum) || posNum < 1) {
        throw new AppError('VALIDATION_FAILED', 'Nomor posisi soal tidak valid.');
      }

      const parse = saveAnswerSchema.safeParse(request.body);
      if (!parse.success) {
        throw new AppError('VALIDATION_FAILED', 'Format data jawaban salah', parse.error.format());
      }

      const { selected_option_id, is_flagged, client_seq } = parse.data;

      const result = await saveAttemptAnswer(
        id,
        posNum,
        selected_option_id || null,
        is_flagged,
        client_seq,
        user.id
      );

      return reply.send(result);
    },
  });

  // PUT /attempts/:id/answers (M, FR-T05 - Frontend autosave compatibility)
  fastify.put('/attempts/:id/answers', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const body = (request.body || {}) as {
        attempt_question_id?: string;
        selected_option_id?: string | null;
        is_flagged?: boolean;
        client_seq?: number;
      };

      const { attempt_question_id, selected_option_id, client_seq, is_flagged } = body;
      if (!attempt_question_id) {
        throw new AppError('VALIDATION_FAILED', 'attempt_question_id wajib diisi.');
      }

      // Cari nomor position berdasarkan attempt_question_id
      const { rows: aqRows } = await pool.query(
        `SELECT position FROM attempt_questions WHERE id = $1 AND attempt_id = $2;`,
        [attempt_question_id, id]
      );
      if (aqRows.length === 0) {
        throw new AppError('NOT_FOUND', 'Soal tidak ditemukan pada attempt ini.');
      }

      const result = await saveAttemptAnswer(
        id,
        aqRows[0].position,
        selected_option_id || null,
        is_flagged ?? false,
        client_seq || 1,
        user.id
      );

      return reply.send(result);
    },
  });

  // POST /attempts/:id/submit (M, FR-T09)
  fastify.post('/attempts/:id/submit', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const parse = submitSchema.safeParse(request.body || {});
      const reason = parse.success ? parse.data.reason : 'manual';

      const result = await submitExamAttempt(id, reason, user.id, request.ip);
      return reply.send(result);
    },
  });

  // POST /attempts/:id/finish (Frontend alias for submit)
  fastify.post('/attempts/:id/finish', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const parse = submitSchema.safeParse(request.body || {});
      const reason = parse.success ? parse.data.reason : 'manual';

      const result = await submitExamAttempt(id, reason, user.id, request.ip);
      return reply.send(result);
    },
  });

  // GET /attempts/:id/result (M, FR-T12)
  fastify.get('/attempts/:id/result', {
    preHandler: [requireRoles(['student', 'admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const { rows } = await pool.query(
        `SELECT 
          r.*,
          a.id AS attempt_id, a.attempt_no, a.started_at, a.submitted_at, a.submit_reason,
          sp.identifier, sp.full_name, sp.institution, u.email,
          s.id AS session_id, s.name AS session_name, s.code AS session_code,
          e.id AS exam_id, e.title AS exam_title, e.allow_review,
          c.id AS certificate_id, c.certificate_no, c.verification_code,
          se.student_id
         FROM results r
         JOIN attempts a ON a.id = r.attempt_id
         JOIN session_enrollments se ON se.id = a.enrollment_id
         JOIN users u ON u.id = se.student_id
         JOIN student_profiles sp ON sp.user_id = u.id
         JOIN exam_sessions s ON s.id = se.session_id
         JOIN exams e ON e.id = s.exam_id
         LEFT JOIN certificates c ON c.result_id = r.id AND c.status = 'valid'
         WHERE a.id = $1;`,
        [id]
      );

      if (rows.length === 0) throw new AppError('NOT_FOUND', 'Hasil ujian belum tersedia.');
      const resData = rows[0];

      if (isStudentRole(user.role) && resData.student_id !== user.id) {
        throw new AppError('NOT_FOUND');
      }

      return reply.send({ result: resData });
    },
  });

  // POST /attempts/:id/events (M, FR-T11)
  fastify.post('/attempts/:id/events', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = eventSchema.safeParse(request.body);
      if (!parse.success) {
        throw new AppError('VALIDATION_FAILED', 'Format peristiwa integritas salah', parse.error.format());
      }

      const { event_type, client_time, detail } = parse.data;
      const result = await recordAttemptEvent(id, event_type, client_time, detail);

      return reply.status(201).send({ success: true, event: result });
    },
  });

  // --- ATTEMPT DETAIL ENDPOINT (ADMIN & STUDENT ANTI-IDOR) ---

  // GET /attempts/:id (A & M, FR-T12, FR-T04)
  fastify.get('/attempts/:id', {
    preHandler: [requireRoles(['admin', 'student'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const { rows } = await pool.query(
        `SELECT 
          a.*,
          se.student_id,
          sp.identifier, sp.full_name, sp.institution, u.email,
          s.id AS session_id, s.name AS session_name, s.code AS session_code,
          e.id AS exam_id, e.title AS exam_title, e.duration_minutes, e.passing_score
         FROM attempts a
         JOIN session_enrollments se ON se.id = a.enrollment_id
         JOIN student_profiles sp ON sp.user_id = se.student_id
         JOIN users u ON u.id = sp.user_id
         JOIN exam_sessions s ON s.id = se.session_id
         JOIN exams e ON e.id = s.exam_id
         WHERE a.id = $1;`,
        [id]
      );

      if (rows.length === 0) throw new AppError('NOT_FOUND');
      const att = rows[0];

      // Anti-IDOR: Peserta hanya dapat melihat percobaan miliknya sendiri
      if (isStudentRole(user.role) && att.student_id !== user.id) {
        throw new AppError('NOT_FOUND');
      }

      // Jika diakses oleh siswa: kembalikan struktur soal dan opsi teracak tanpa membocorkan is_correct
      if (isStudentRole(user.role)) {
        const { questions: rawQuestions } = await getAttemptQuestions(id, user.id);
        const now = new Date();
        const deadline = new Date(att.deadline_at);
        const timeRemainingSeconds = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));

        const formattedQuestions = rawQuestions.map((q) => ({
          id: q.attempt_question_id,
          question_version_id: q.attempt_question_id,
          order_seq: q.position,
          stem: q.stem,
          weight: q.weight,
          selected_option_id: q.selected_option_id,
          is_doubtful: q.is_flagged,
          options: q.options,
        }));

        return reply.send({
          attempt: {
            id: att.id,
            session_id: att.session_id,
            exam_title: att.exam_title,
            status: att.status,
            started_at: att.started_at,
            duration_minutes: att.duration_minutes,
            time_remaining_seconds: timeRemainingSeconds,
            questions: formattedQuestions,
          },
        });
      }

      // Admin view: sertakan detail jawaban, kunci, dan skor
      const { rows: answers } = await pool.query(
        `SELECT 
          aq.position, qv.stem, qv.weight,
          ans.selected_option_id, ans.is_flagged, ans.client_seq, ans.answered_at,
          ans.is_correct, ans.points_awarded,
          CASE WHEN qo.position IS NOT NULL THEN chr(64 + qo.position) ELSE NULL END AS option_label, qo.option_text
         FROM attempt_questions aq
         JOIN question_versions qv ON qv.id = aq.question_version_id
         LEFT JOIN attempt_answers ans ON ans.attempt_question_id = aq.id
         LEFT JOIN question_options qo ON qo.id = ans.selected_option_id
         WHERE aq.attempt_id = $1
         ORDER BY aq.position ASC;`,
        [id]
      );

      return reply.send({ attempt: { ...att, answers } });
    },
  });

  // GET /attempts/:id/events (A, FR-T11)
  fastify.get('/attempts/:id/events', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { rows } = await pool.query(
        `SELECT * FROM attempt_events WHERE attempt_id = $1 ORDER BY occurred_at DESC;`,
        [id]
      );
      return reply.send({ data: rows });
    },
  });

  // POST /attempts/:id/void (A, FR-R05)
  fastify.post('/attempts/:id/void', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = voidSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Alasan pembatalan wajib diisi', parse.error.format());

      const result = await voidExamAttempt(id, parse.data.reason, request.user!.id, request.ip);
      return reply.send(result);
    },
  });

  // POST /attempts/:id/extend (A, FR-R05)
  fastify.post('/attempts/:id/extend', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = extendSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format perpanjangan salah', parse.error.format());

      const result = await extendSingleAttempt(
        id,
        parse.data.extra_minutes,
        parse.data.reason,
        request.user!.id,
        request.ip
      );
      return reply.send({ success: true, attempt: result });
    },
  });
};
