import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { pool } from '../../db/connection.js';
import { authenticate, requireRoles } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import {
  getDashboardMetrics,
  getSessionReport,
  getExamReport,
  getInstitutionsReport,
  exportSessionResultsCSV,
  exportExamResultsCSV,
} from './reports.service.js';
import { generateSessionCredentialsPDF } from '../sessions/sessions.pdf.js';

export const reportRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRoles(['admin']));

  // GET /dashboard (A, FR-L01)
  fastify.get('/dashboard', async (_request, reply) => {
    const metrics = await getDashboardMetrics();
    return reply.send({ dashboard: metrics });
  });

  // GET /reports/sessions/:id (A, FR-L02)
  fastify.get('/reports/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = await getSessionReport(id);
    return reply.send(report);
  });

  // GET /reports/exams/:id (A, FR-L02)
  fastify.get('/reports/exams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = await getExamReport(id);
    return reply.send(report);
  });

  // GET /reports/institutions (A, FR-L02)
  fastify.get('/reports/institutions', async (_request, reply) => {
    const report = await getInstitutionsReport();
    return reply.send(report);
  });

  // GET /reports/sessions/:id/export (A, FR-L03)
  fastify.get('/reports/sessions/:id/export', async (request, reply) => {
    const { id } = request.params as { id: string };
    const csvContent = await exportSessionResultsCSV(id, request.user!.id, request.ip);

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="hasil_sesi_${id.slice(0, 8)}.csv"`);
    return reply.send(csvContent);
  });

  // GET /reports/sessions/:id/credentials-pdf
  fastify.get('/reports/sessions/:id/credentials-pdf', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { pdfBuffer, sessionCode } = await generateSessionCredentialsPDF(
      id,
      request.user!.id,
      request.ip
    );

    reply.header('Content-Type', 'application/pdf');
    reply.header(
      'Content-Disposition',
      `attachment; filename="Kredensial_Peserta_${sessionCode}.pdf"`
    );
    return reply.send(pdfBuffer);
  });

  // GET /reports/exams/:id/export (A, FR-L03)
  fastify.get('/reports/exams/:id/export', async (request, reply) => {
    const { id } = request.params as { id: string };
    const csvContent = await exportExamResultsCSV(id, request.user!.id, request.ip);

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="hasil_ujian_${id.slice(0, 8)}.csv"`);
    return reply.send(csvContent);
  });

  // GET /reports/items/:questionVersionId (A, FR-L04)
  fastify.get('/reports/items/:questionVersionId', async (request, reply) => {
    const { questionVersionId } = request.params as { questionVersionId: string };

    const { rows: versionRows } = await pool.query(
      `SELECT qv.id, qv.stem, qv.weight, qv.difficulty, qo_correct.id AS correct_option_id
       FROM question_versions qv
       JOIN question_options qo_correct ON qo_correct.question_version_id = qv.id AND qo_correct.is_correct = true
       WHERE qv.id = $1;`,
      [questionVersionId]
    );

    if (versionRows.length === 0) throw new AppError('NOT_FOUND');
    const version = versionRows[0];

    // Stats across all attempts
    const { rows: stats } = await pool.query(
      `SELECT 
        COUNT(*) AS total_administered,
        COUNT(CASE WHEN ans.is_correct = true THEN 1 END) AS correct_count
       FROM attempt_answers ans
       WHERE ans.question_version_id = $1 AND ans.selected_option_id IS NOT NULL;`,
      [questionVersionId]
    );

    const total = parseInt(stats[0].total_administered, 10);
    const correct = parseInt(stats[0].correct_count, 10);
    const difficultyIndex = total > 0 ? parseFloat((correct / total).toFixed(2)) : 0;

    // Option distribution
    const { rows: optionDist } = await pool.query(
      `SELECT 
        qo.id, qo.position, qo.option_text, qo.is_correct,
        COUNT(ans.selected_option_id) AS selection_count
       FROM question_options qo
       LEFT JOIN attempt_answers ans ON ans.selected_option_id = qo.id AND ans.question_version_id = $1
       WHERE qo.question_version_id = $1
       GROUP BY qo.id
       ORDER BY qo.position ASC;`,
      [questionVersionId]
    );

    return reply.send({
      item_analysis: {
        question_version_id: version.id,
        stem: version.stem,
        difficulty: version.difficulty,
        weight: version.weight,
        total_administered: total,
        correct_count: correct,
        difficulty_index: difficultyIndex,
        option_distribution: optionDist,
      },
    });
  });
};
