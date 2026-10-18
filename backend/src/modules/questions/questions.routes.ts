import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../../db/connection.js';
import { authenticate, requireRoles } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import {
  createCategory,
  deleteCategory,
  createQuestion,
  createNewVersion,
  addQuestionCorrection,
  previewCorrectionImpact,
  getQuestionPreview,
  parseAndPreviewQuestionsCSV,
  parseAndPreviewQuestionsDocx,
  parseAndPreviewQuestionsDoc,
  commitQuestionsImport,
} from './questions.service.js';

const categorySchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const questionOptionSchema = z
  .object({
    position: z.number().int().min(1).optional(),
    label: z.string().optional(),
    option_text: z.string().optional(),
    text: z.string().optional(),
    is_correct: z.boolean(),
  })
  .transform((val, ctx) => {
    const text = val.option_text || val.text;
    if (!text || !text.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Teks opsi harus diisi',
      });
    }
    let pos = val.position;
    if (!pos && val.label) {
      const charCode = val.label.toUpperCase().charCodeAt(0);
      if (charCode >= 65 && charCode <= 90) {
        pos = charCode - 64;
      }
    }
    return {
      position: pos || 1,
      option_text: (text || '').trim(),
      is_correct: !!val.is_correct,
    };
  });

const createQuestionSchema = z.object({
  category_id: z.string().uuid(),
  code: z.string().optional(),
  stem: z.string().min(3),
  difficulty: z.coerce.number().int().min(1).max(3).optional().default(1),
  weight: z.coerce.number().positive().optional().default(1.0),
  explanation: z.string().optional().nullable(),
  options: z.array(questionOptionSchema).min(2),
  status: z.enum(['draft', 'active']).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
});

const updateQuestionSchema = z.object({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
});

const correctionSchema = z.object({
  type: z.enum(['also_accept', 'key_changed', 'annulled']),
  old_option_id: z.string().uuid().optional().nullable(),
  new_option_id: z.string().uuid().optional().nullable(),
  reason: z.string().min(3),
});

export const questionRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRoles(['admin']));

  // --- KATEGORI / SUBTES SOAL (Support both /categories and /question-categories) ---
  const getCategoriesHandler = async (_request: any, reply: any) => {
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.description, c.created_at,
              COUNT(q.id) AS question_count
       FROM question_categories c
       LEFT JOIN questions q ON q.category_id = c.id AND q.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.name ASC;`
    );
    const data = rows.map((r: any) => ({
      ...r,
      code: r.name.split(' ').map((w: string) => w[0]).join('').substring(0, 4).toUpperCase() || 'SUB',
    }));
    return reply.send({ data });
  };

  const createCategoryHandler = async (request: any, reply: any) => {
    const parse = categorySchema.safeParse(request.body);
    if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format nama kategori tidak valid', parse.error.format());

    const result = await createCategory(parse.data.name, parse.data.description, request.user!.id, request.ip);
    const cat = {
      ...result,
      code: parse.data.code || result.name.split(' ').map((w: string) => w[0]).join('').substring(0, 4).toUpperCase() || 'SUB',
    };
    return reply.status(201).send({ success: true, category: cat });
  };

  const updateCategoryHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const parse = categorySchema.partial().safeParse(request.body);
    if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Data tidak valid', parse.error.format());

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (parse.data.name !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(parse.data.name.trim());
    }
    if (parse.data.description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(parse.data.description?.trim() || null);
    }

    if (updates.length === 0) return reply.send({ success: true });

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE question_categories SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, description, created_at;`,
      params
    );

    if (rows.length === 0) throw new AppError('NOT_FOUND');
    const cat = {
      ...rows[0],
      code: parse.data.code || rows[0].name.split(' ').map((w: string) => w[0]).join('').substring(0, 4).toUpperCase() || 'SUB',
    };
    return reply.send({ success: true, category: cat });
  };

  const deleteCategoryHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await deleteCategory(id, request.user!.id, request.ip);
    return reply.send({ success: true, deleted: result });
  };

  fastify.get('/question-categories', getCategoriesHandler);
  fastify.get('/categories', getCategoriesHandler);

  fastify.post('/question-categories', createCategoryHandler);
  fastify.post('/categories', createCategoryHandler);

  fastify.patch('/question-categories/:id', updateCategoryHandler);
  fastify.patch('/categories/:id', updateCategoryHandler);

  fastify.delete('/question-categories/:id', deleteCategoryHandler);
  fastify.delete('/categories/:id', deleteCategoryHandler);

  // --- BANK SOAL ---
  fastify.get('/questions/years', async (_request, reply) => {
    const { rows } = await pool.query(
      `SELECT DISTINCT year FROM questions WHERE deleted_at IS NULL ORDER BY year DESC;`
    );
    const years = rows.map((r: any) => r.year).filter((y: any) => y !== null && y !== undefined);
    return reply.send({ data: years });
  });

  fastify.get('/questions', async (request, reply) => {
    const query = request.query as {
      category_id?: string;
      status?: string;
      difficulty?: string;
      search?: string;
      year?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(Math.max(parseInt(query.limit || '1000', 10), 1), 5000);
    const offset = Math.max(parseInt(query.offset || '0', 10), 0);

    const conditions: string[] = ['q.deleted_at IS NULL'];
    const params: any[] = [];
    let idx = 1;

    if (query.category_id) {
      conditions.push(`q.category_id = $${idx++}`);
      params.push(query.category_id);
    }
    if (query.status) {
      conditions.push(`q.status = $${idx++}`);
      params.push(query.status);
    }
    if (query.difficulty) {
      conditions.push(`qv.difficulty = $${idx++}`);
      params.push(parseInt(query.difficulty, 10));
    }
    if (query.year) {
      conditions.push(`q.year = $${idx++}`);
      params.push(parseInt(query.year, 10));
    }
    if (query.search) {
      conditions.push(`qv.stem ILIKE $${idx++}`);
      params.push(`%${query.search}%`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total
       FROM questions q
       LEFT JOIN question_versions qv ON qv.id = q.current_version_id
       ${whereClause};`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const dataQuery = `
      SELECT 
        q.id, q.category_id, q.status, q.year, q.created_at,
        c.name AS category_name,
        COALESCE('Q-' || UPPER(SUBSTRING(q.id::text, 1, 8)), 'Q-0000') AS code,
        qv.id AS current_version_id,
        qv.id AS version_id,
        qv.version_no AS version_number,
        qv.version_no,
        qv.stem, qv.difficulty, qv.weight, qv.explanation
      FROM questions q
      JOIN question_categories c ON c.id = q.category_id
      LEFT JOIN question_versions qv ON qv.id = q.current_version_id
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(dataQuery, params);
    return reply.send({ data: rows, meta: { total, limit, offset } });
  });

  fastify.post('/questions', async (request, reply) => {
    const parse = createQuestionSchema.safeParse(request.body);
    if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format pembuatan soal salah', parse.error.format());

    const result = await createQuestion(parse.data, request.user!.id, request.ip);
    return reply.status(201).send({ success: true, question: result });
  });

  fastify.get('/questions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows } = await pool.query(
      `SELECT 
        q.id, q.category_id, q.status, q.year, q.created_at,
        c.name AS category_name,
        COALESCE('Q-' || UPPER(SUBSTRING(q.id::text, 1, 8)), 'Q-0000') AS code,
        qv.id AS current_version_id,
        qv.id AS version_id,
        qv.version_no AS version_number,
        qv.version_no,
        qv.stem, qv.difficulty, qv.weight, qv.explanation
       FROM questions q
       JOIN question_categories c ON c.id = q.category_id
       JOIN question_versions qv ON qv.id = q.current_version_id
       WHERE q.id = $1 AND q.deleted_at IS NULL;`,
      [id]
    );

    if (rows.length === 0) throw new AppError('NOT_FOUND');
    const question = rows[0];

    const { rows: options } = await pool.query(
      `SELECT id, position, option_text, is_correct
       FROM question_options
       WHERE question_version_id = $1
       ORDER BY position ASC;`,
      [question.current_version_id]
    );

    const formattedOptions = options.map((opt: any, idx: number) => ({
      id: opt.id,
      position: opt.position,
      label: String.fromCharCode(65 + idx),
      text: opt.option_text,
      option_text: opt.option_text,
      is_correct: opt.is_correct,
    }));

    return reply.send({ question: { ...question, options: formattedOptions } });
  });

  fastify.patch('/questions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = updateQuestionSchema.safeParse(request.body);
    if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format pembaruan butir soal salah', parse.error.format());

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (parse.data.status !== undefined) {
      updates.push(`status = $${idx++}`);
      params.push(parse.data.status);
    }
    if (parse.data.year !== undefined) {
      updates.push(`year = $${idx++}`);
      params.push(parse.data.year);
    }

    if (updates.length === 0) return reply.send({ success: true });

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE questions SET ${updates.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id, status, year;`,
      params
    );
    if (rows.length === 0) throw new AppError('NOT_FOUND');

    return reply.send({ success: true, question: rows[0] });
  });

  fastify.delete('/questions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows } = await pool.query(
      `UPDATE questions SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id;`,
      [id]
    );
    if (rows.length === 0) throw new AppError('NOT_FOUND');

    return reply.send({ success: true, message: 'Soal berhasil diarsipkan/dihapus.' });
  });

  fastify.get('/questions/:id/versions', async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows: versions } = await pool.query(
      `SELECT qv.id, qv.version_no, qv.stem, qv.difficulty, qv.weight, qv.explanation, qv.created_at,
              u.email AS created_by_email
       FROM question_versions qv
       JOIN users u ON u.id = qv.created_by
       WHERE qv.question_id = $1
       ORDER BY qv.version_no DESC;`,
      [id]
    );

    return reply.send({ data: versions });
  });

  fastify.post('/questions/:id/versions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = createQuestionSchema.omit({ category_id: true }).safeParse(request.body);
    if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format versi baru salah', parse.error.format());

    const result = await createNewVersion(id, parse.data, request.user!.id, request.ip);
    return reply.status(201).send({ success: true, version: result });
  });

  // GET /questions/:id/preview (A, FR-Q07)
  fastify.get('/questions/:id/preview', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await getQuestionPreview(id);
    return reply.send(result);
  });

  // --- KOREKSI SOAL (FR-Q08) ---
  fastify.post('/question-versions/:id/corrections/preview', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = correctionSchema.safeParse(request.body);
    if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format koreksi tidak valid', parse.error.format());

    const { type, old_option_id, new_option_id } = parse.data;
    const impact = await previewCorrectionImpact(id, type, old_option_id || null, new_option_id || null);
    return reply.send({ preview: impact });
  });
  fastify.get('/question-versions/:id/corrections', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `SELECT qc.id, qc.type, qc.old_option_id, qc.new_option_id, qc.reason, qc.created_at,
              u.email AS created_by_email
       FROM question_corrections qc
       JOIN users u ON u.id = qc.created_by
       WHERE qc.question_version_id = $1
       ORDER BY qc.created_at DESC;`,
      [id]
    );
    return reply.send({ data: rows });
  });

  fastify.post('/question-versions/:id/corrections', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = correctionSchema.safeParse(request.body);
    if (!parse.success) throw new AppError('VALIDATION_FAILED', 'Format koreksi tidak valid', parse.error.format());

    const { type, old_option_id, new_option_id, reason } = parse.data;
    const result = await addQuestionCorrection(id, type, old_option_id || null, new_option_id || null, reason, request.user!.id, request.ip);

    return reply.status(201).send({ success: true, correction: result });
  });

  // --- IMPOR SOAL CSV & DOCX / DOC (FR-Q06) ---
  fastify.post('/questions/import/preview', async (request, reply) => {
    const data = await request.file();
    if (!data) throw new AppError('VALIDATION_FAILED', 'Berkas impor (.docx / .doc / .csv) tidak ditemukan.');

    const filename = (data.filename || '').toLowerCase();
    const buffer = await data.toBuffer();

    let preview;
    let fileType: 'docx' | 'doc' | 'csv' = 'docx';

    if (filename.endsWith('.docx')) {
      fileType = 'docx';
      try {
        preview = parseAndPreviewQuestionsDocx(buffer);
      } catch {
        preview = await parseAndPreviewQuestionsDoc(buffer);
      }
    } else if (filename.endsWith('.doc')) {
      fileType = 'doc';
      preview = await parseAndPreviewQuestionsDoc(buffer);
    } else if (filename.endsWith('.csv') || filename.endsWith('.txt')) {
      fileType = 'csv';
      preview = parseAndPreviewQuestionsCSV(buffer);
    } else {
      throw new AppError('VALIDATION_FAILED', 'Format berkas tidak didukung. Harap unggah berkas bertipe .DOC, .DOCX, atau .CSV.');
    }

    return reply.send({
      success: true,
      filename: data.filename,
      file_type: fileType,
      total_rows: preview.totalRows,
      valid_rows: preview.validRows,
      invalid_rows: preview.invalidRows,
      rows: preview.rows,
      valid_payload: preview.parsedPayload,
    });
  });

  fastify.post('/questions/import/commit', async (request, reply) => {
    const body = request.body as { questions?: any[]; items?: any[]; year?: number | string };
    const payload = body?.questions || body?.items;
    if (!payload || !Array.isArray(payload) || payload.length === 0) {
      throw new AppError('VALIDATION_FAILED', 'Daftar butir soal untuk diimpor tidak boleh kosong.');
    }

    const importYear = body.year ? parseInt(String(body.year), 10) : undefined;
    const result = await commitQuestionsImport(payload, request.user!.id, request.ip, importYear);
    return reply.send({
      success: true,
      total_imported: result.totalImported,
      imported_count: result.totalImported,
    });
  });
};
