import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../../db/connection.js';
import { authenticate, requireRoles, isStudentRole } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import {
  createExam,
  updateExam,
  deleteExam,
  copyExam,
  addExamRule,
  updateExamRule,
  deleteExamRule,
  validateQuestionPoolSufficiency,
} from './exams.service.js';

const examSchema = z.object({
  code: z.string().min(2).max(30),
  title: z.string().min(3).max(200),
  description: z.string().optional().nullable(),
  duration_minutes: z.number().int().positive(),
  question_count: z.number().int().positive(),
  passing_score: z.number().min(0).max(100),
  shuffle_questions: z.boolean().optional(),
  shuffle_options: z.boolean().optional(),
  max_attempts_per_student: z.number().int().min(1).optional(),
  allow_review: z.boolean().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

const examRuleSchema = z.object({
  category_id: z.string().uuid(),
  difficulty: z.number().int().min(1).max(3).optional().nullable(),
  question_count: z.number().int().positive(),
});

export const examRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // GET /exams (A, M terbatas)
  fastify.get('/exams', async (request, reply) => {
    const user = request.user!;

    if (isStudentRole(user.role)) {
      const { rows } = await pool.query(
        `SELECT id, code, title, description, duration_minutes, question_count, passing_score
         FROM exams
         WHERE status = 'active'
         ORDER BY title ASC;`
      );
      return reply.send({ data: rows });
    }

    // Admin view
    const { rows } = await pool.query(
      `SELECT 
        e.*,
        COUNT(DISTINCT s.id) AS session_count,
        COALESCE(SUM(r.question_count), 0) AS total_rules_count
       FROM exams e
       LEFT JOIN exam_sessions s ON s.exam_id = e.id
       LEFT JOIN exam_question_rules r ON r.exam_id = e.id
       GROUP BY e.id
       ORDER BY e.created_at DESC;`
    );

    return reply.send({ data: rows });
  });

  // POST /exams (A)
  fastify.post('/exams', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const parse = examSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Data ujian tidak valid', parse.error.format());

      const result = await createExam(parse.data, request.user!.id, request.ip);
      return reply.status(201).send({ success: true, exam: result });
    },
  });

  // GET /exams/:id (A, M)
  fastify.get('/exams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const { rows } = await pool.query(`SELECT * FROM exams WHERE id = $1;`, [id]);
    if (rows.length === 0) throw new AppError('NOT_FOUND');

    const exam = rows[0];
    if (isStudentRole(user.role)) {
      if (exam.status !== 'active') throw new AppError('NOT_FOUND');
      return reply.send({
        exam: {
          id: exam.id,
          code: exam.code,
          title: exam.title,
          description: exam.description,
          duration_minutes: exam.duration_minutes,
          question_count: exam.question_count,
          passing_score: exam.passing_score,
        },
      });
    }

    const { rows: rules } = await pool.query(
      `SELECT r.*, c.name AS category_name
       FROM exam_question_rules r
       JOIN question_categories c ON c.id = r.category_id
       WHERE r.exam_id = $1
       ORDER BY c.name ASC;`,
      [id]
    );

    return reply.send({ exam: { ...exam, rules } });
  });

  // PATCH /exams/:id (A)
  fastify.patch('/exams/:id', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = examSchema.partial().safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format data tidak valid', parse.error.format());

      const result = await updateExam(id, parse.data, request.user!.id, request.ip);
      return reply.send({ success: true, exam: result });
    },
  });

  // DELETE /exams/:id (A)
  fastify.delete('/exams/:id', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await deleteExam(id, request.user!.id, request.ip);
      return reply.send({ success: true, deleted: result });
    },
  });

  // POST /exams/:id/copy (A, FR-E04)
  fastify.post('/exams/:id/copy', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await copyExam(id, request.user!.id, request.ip);
      return reply.status(201).send({ success: true, exam: result });
    },
  });

  // GET /exams/:id/rules (A, FR-E02)
  fastify.get('/exams/:id/rules', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { rows } = await pool.query(
        `SELECT r.*, c.name AS category_name
         FROM exam_question_rules r
         JOIN question_categories c ON c.id = r.category_id
         WHERE r.exam_id = $1
         ORDER BY c.name ASC;`,
        [id]
      );
      return reply.send({ data: rows });
    },
  });

  // POST /exams/:id/rules (A, FR-E02)
  fastify.post('/exams/:id/rules', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = examRuleSchema.safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format aturan salah', parse.error.format());

      const result = await addExamRule(id, parse.data, request.user!.id, request.ip);
      return reply.status(201).send({ success: true, rule: result });
    },
  });

  // PATCH /exams/:id/rules/:ruleId (A, FR-E02)
  fastify.patch('/exams/:id/rules/:ruleId', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id, ruleId } = request.params as { id: string; ruleId: string };
      const parse = z.object({ question_count: z.number().int().positive() }).safeParse(request.body);
      if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format jumlah soal salah', parse.error.format());

      const result = await updateExamRule(id, ruleId, parse.data.question_count, request.user!.id, request.ip);
      return reply.send({ success: true, rule: result });
    },
  });

  // DELETE /exams/:id/rules/:ruleId (A, FR-E02)
  fastify.delete('/exams/:id/rules/:ruleId', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id, ruleId } = request.params as { id: string; ruleId: string };
      const result = await deleteExamRule(id, ruleId, request.user!.id, request.ip);
      return reply.send({ success: true, deleted: result });
    },
  });

  // POST /exams/:id/validate-pool (A)
  fastify.post('/exams/:id/validate-pool', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await validateQuestionPoolSufficiency(id);
      return reply.send({ success: true, message: 'Stok bank soal aktif mencukupi seluruh aturan komposisi ujian.' });
    },
  });
};
