import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { pool } from '../../db/connection.js';
import { authenticate, requireRoles } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import { publishSessionResults } from '../sessions/sessions.service.js';

export const resultRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // GET /results (A, FR-L02)
  fastify.get('/results', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
    const query = request.query as {
      session_id?: string;
      exam_id?: string;
      status?: string;
      passed?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(Math.max(parseInt(query.limit || '25', 10), 1), 100);
    const offset = Math.max(parseInt(query.offset || '0', 10), 0);

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (query.session_id) {
      conditions.push(`s.id = $${idx++}`);
      params.push(query.session_id);
    }
    if (query.exam_id) {
      conditions.push(`e.id = $${idx++}`);
      params.push(query.exam_id);
    }
    if (query.status) {
      conditions.push(`r.status = $${idx++}`);
      params.push(query.status);
    }
    if (query.passed !== undefined) {
      conditions.push(`r.passed = $${idx++}`);
      params.push(query.passed === 'true');
    }
    if (query.search) {
      conditions.push(`(sp.identifier ILIKE $${idx} OR sp.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      params.push(`%${query.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total
       FROM results r
       JOIN attempts a ON a.id = r.attempt_id
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN users u ON u.id = se.student_id
       JOIN student_profiles sp ON sp.user_id = u.id
       JOIN exam_sessions s ON s.id = se.session_id
       JOIN exams e ON e.id = s.exam_id
       ${whereClause};`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const dataQuery = `
      SELECT 
        r.id, r.raw_score, r.max_score, r.score, r.passing_score, r.passed,
        r.status, r.revision_no, r.graded_at, r.published_at,
        a.id AS attempt_id, a.attempt_no, a.started_at, a.submitted_at, a.submit_reason,
        sp.identifier, sp.full_name, sp.full_name AS student_name, sp.institution, u.email,
        s.id AS session_id, s.name AS session_name, s.code AS session_code,
        e.id AS exam_id, e.title AS exam_title,
        c.id AS certificate_id, c.certificate_no, c.status AS cert_status
      FROM results r
      JOIN attempts a ON a.id = r.attempt_id
      JOIN session_enrollments se ON se.id = a.enrollment_id
      JOIN users u ON u.id = se.student_id
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN exam_sessions s ON s.id = se.session_id
      JOIN exams e ON e.id = s.exam_id
      LEFT JOIN certificates c ON c.result_id = r.id AND c.status = 'valid'
      ${whereClause}
      ORDER BY r.graded_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(dataQuery, params);
    return reply.send({ data: rows, meta: { total, limit, offset } });
  },
});

  // GET /results/:id (A, M)
  fastify.get('/results/:id', {
    preHandler: [requireRoles(['admin', 'student'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const { rows } = await pool.query(
        `SELECT 
          r.*,
          a.id AS attempt_id, a.attempt_no, a.started_at, a.submitted_at, a.submit_reason, a.extra_seconds,
          sp.identifier, sp.full_name, sp.full_name AS student_name, sp.institution, sp.phone, u.email,
          s.id AS session_id, s.name AS session_name, s.code AS session_code,
          e.id AS exam_id, e.title AS exam_title, e.allow_review,
          c.id AS certificate_id, c.certificate_no, c.verification_code, c.status AS cert_status,
          se.student_id
         FROM results r
         JOIN attempts a ON a.id = r.attempt_id
         JOIN session_enrollments se ON se.id = a.enrollment_id
         JOIN users u ON u.id = se.student_id
         JOIN student_profiles sp ON sp.user_id = u.id
         JOIN exam_sessions s ON s.id = se.session_id
         JOIN exams e ON e.id = s.exam_id
         LEFT JOIN certificates c ON c.result_id = r.id AND c.status = 'valid'
         WHERE r.id = $1;`,
        [id]
      );

      if (rows.length === 0) throw new AppError('NOT_FOUND');
      const result = rows[0];

      if (user.role === 'student' && result.student_id !== user.id) {
        throw new AppError('NOT_FOUND');
      }

      // Detail jawaban butir soal
      const { rows: answers } = await pool.query(
        `SELECT 
          aq.position, qv.stem, qv.weight, qv.explanation,
          ans.selected_option_id, ans.is_correct, ans.points_awarded, ans.answered_at,
          CASE WHEN qo.position IS NOT NULL THEN chr(64 + qo.position) ELSE NULL END AS selected_label, qo.option_text AS selected_text,
          chr(64 + qo_correct.position) AS correct_label, qo_correct.option_text AS correct_text
         FROM attempt_questions aq
         JOIN question_versions qv ON qv.id = aq.question_version_id
         JOIN question_options qo_correct ON qo_correct.question_version_id = qv.id AND qo_correct.is_correct = true
         LEFT JOIN attempt_answers ans ON ans.attempt_question_id = aq.id
         LEFT JOIN question_options qo ON qo.id = ans.selected_option_id
         WHERE aq.attempt_id = $1
         ORDER BY aq.position ASC;`,
        [result.attempt_id]
      );

      if (user.role === 'student' && !result.allow_review) {
        for (const ans of answers) {
          delete ans.correct_label;
          delete ans.correct_text;
          delete ans.explanation;
        }
      }

      return reply.send({ result: { ...result, answers } });
    },
  });

  // POST /results/:id/publish (A)
  fastify.post('/results/:id/publish', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { rows } = await pool.query(
        `UPDATE results SET status = 'published', published_at = now() WHERE id = $1 RETURNING id, status, published_at;`,
        [id]
      );
      if (rows.length === 0) throw new AppError('NOT_FOUND');
      return reply.send({ success: true, result: rows[0] });
    },
  });

  // POST /results/publish-session/:sessionId (A)
  fastify.post('/results/publish-session/:sessionId', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const result = await publishSessionResults(sessionId, request.user!.id, request.ip);
      return reply.send({ success: true, result });
    },
  });
};
