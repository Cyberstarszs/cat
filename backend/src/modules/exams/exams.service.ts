import { pool } from '../../db/connection.js';
import { AppError } from '../../lib/errors.js';
import { logAudit } from '../audit/audit.service.js';

export interface ExamInput {
  code: string;
  title: string;
  description?: string | null;
  duration_minutes: number;
  question_count: number;
  passing_score: number;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  max_attempts_per_student?: number;
  allow_review?: boolean;
  status?: 'draft' | 'active' | 'archived';
}

export interface ExamRuleInput {
  category_id: string;
  difficulty?: number | null; // 1-3 or null for any
  question_count: number;
}

/**
 * INV-10: Cek apakah konfigurasi ujian terkunci karena sudah ada sesi yang dipublikasikan atau ada percobaan.
 */
export async function assertExamNotLocked(examId: string): Promise<void> {
  const query = `
    SELECT COUNT(*) AS count
    FROM exam_sessions s
    WHERE s.exam_id = $1 AND (
      s.status = 'published' OR 
      EXISTS (
        SELECT 1 FROM session_enrollments se
        JOIN attempts a ON a.enrollment_id = se.id
        WHERE se.session_id = s.id
      )
    );
  `;
  const { rows } = await pool.query(query, [examId]);
  if (parseInt(rows[0].count, 10) > 0) {
    throw new AppError(
      'CONFIG_LOCKED',
      'Konfigurasi ujian sudah terkunci karena sudah memiliki sesi yang dipublikasikan atau memiliki riwayat ujian.'
    );
  }
}

/**
 * Validasi kecukupan bank soal aktif terhadap aturan komposisi (QUESTION_POOL_INSUFFICIENT)
 */
export async function validateQuestionPoolSufficiency(
  examId: string,
  questionYear?: number | null
): Promise<void> {
  const rulesQuery = `
    SELECT r.id, r.category_id, r.difficulty, r.question_count, c.name AS category_name
    FROM exam_question_rules r
    JOIN question_categories c ON c.id = r.category_id
    WHERE r.exam_id = $1;
  `;
  const { rows: rules } = await pool.query(rulesQuery, [examId]);

  for (const rule of rules) {
    const diffCondition = rule.difficulty ? `AND qv.difficulty = ${rule.difficulty}` : '';
    const yearCondition = questionYear ? `AND q.year = ${parseInt(String(questionYear), 10)}` : '';
    const poolCheck = `
      SELECT COUNT(DISTINCT q.id) AS available
      FROM questions q
      JOIN question_versions qv ON qv.id = q.current_version_id
      WHERE q.category_id = $1 
        AND q.status = 'active'
        AND q.deleted_at IS NULL
        ${diffCondition}
        ${yearCondition};
    `;
    const { rows: poolRows } = await pool.query(poolCheck, [rule.category_id]);
    let available = parseInt(poolRows[0].available, 10);

    // Jika tahun spesifik kurang, cek ketersediaan lintas tahun
    if (available < rule.question_count && questionYear) {
      const fallbackCheck = `
        SELECT COUNT(DISTINCT q.id) AS available
        FROM questions q
        JOIN question_versions qv ON qv.id = q.current_version_id
        WHERE q.category_id = $1 
          AND q.status = 'active'
          AND q.deleted_at IS NULL
          ${diffCondition};
      `;
      const { rows: fbRows } = await pool.query(fallbackCheck, [rule.category_id]);
      available = parseInt(fbRows[0].available, 10);
    }

    if (available < rule.question_count) {
      const yearText = questionYear ? ` tahun ${questionYear}` : '';
      throw new AppError(
        'QUESTION_POOL_INSUFFICIENT',
        `Bank soal untuk kategori "${rule.category_name}"${rule.difficulty ? ` (tingkat ${rule.difficulty})` : ''}${yearText} tidak mencukupi (dibutuhkan ${rule.question_count}, tersedia ${available}).`
      );
    }
  }
}

export async function createExam(data: ExamInput, actorId: string, ipAddress?: string) {
  const cleanCode = data.code.trim().toUpperCase();

  const dup = await pool.query('SELECT id FROM exams WHERE code = $1;', [cleanCode]);
  if (dup.rows.length > 0) {
    throw new AppError('VALIDATION_FAILED', `Kode ujian "${cleanCode}" sudah digunakan.`);
  }

  const { rows } = await pool.query(
    `INSERT INTO exams (
      code, title, description, duration_minutes, question_count,
      passing_score, shuffle_questions, shuffle_options,
      max_attempts_per_student, allow_review, status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *;`,
    [
      cleanCode,
      data.title.trim(),
      data.description?.trim() || null,
      data.duration_minutes,
      data.question_count,
      data.passing_score,
      data.shuffle_questions !== undefined ? data.shuffle_questions : true,
      data.shuffle_options !== undefined ? data.shuffle_options : true,
      data.max_attempts_per_student || 3,
      data.allow_review || false,
      data.status || 'draft',
      actorId,
    ]
  );

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'exams.create',
    entityType: 'exams',
    entityId: rows[0].id,
    afterData: rows[0],
    ipAddress,
  });

  return rows[0];
}

export async function updateExam(
  examId: string,
  data: Partial<ExamInput>,
  actorId: string,
  ipAddress?: string
) {
  // Cek apakah konfigurasi terkunci jika mengubah parameter inti
  if (
    data.duration_minutes !== undefined ||
    data.question_count !== undefined ||
    data.passing_score !== undefined ||
    data.shuffle_questions !== undefined ||
    data.shuffle_options !== undefined ||
    data.max_attempts_per_student !== undefined
  ) {
    await assertExamNotLocked(examId);
  }

  const updates: string[] = ['updated_at = now()'];
  const params: any[] = [];
  let idx = 1;

  if (data.title !== undefined) {
    updates.push(`title = $${idx++}`);
    params.push(data.title.trim());
  }
  if (data.description !== undefined) {
    updates.push(`description = $${idx++}`);
    params.push(data.description?.trim() || null);
  }
  if (data.duration_minutes !== undefined) {
    updates.push(`duration_minutes = $${idx++}`);
    params.push(data.duration_minutes);
  }
  if (data.question_count !== undefined) {
    updates.push(`question_count = $${idx++}`);
    params.push(data.question_count);
  }
  if (data.passing_score !== undefined) {
    updates.push(`passing_score = $${idx++}`);
    params.push(data.passing_score);
  }
  if (data.shuffle_questions !== undefined) {
    updates.push(`shuffle_questions = $${idx++}`);
    params.push(data.shuffle_questions);
  }
  if (data.shuffle_options !== undefined) {
    updates.push(`shuffle_options = $${idx++}`);
    params.push(data.shuffle_options);
  }
  if (data.max_attempts_per_student !== undefined) {
    updates.push(`max_attempts_per_student = $${idx++}`);
    params.push(data.max_attempts_per_student);
  }
  if (data.allow_review !== undefined) {
    updates.push(`allow_review = $${idx++}`);
    params.push(data.allow_review);
  }
  if (data.status !== undefined) {
    updates.push(`status = $${idx++}`);
    params.push(data.status);
  }

  params.push(examId);
  const { rows } = await pool.query(
    `UPDATE exams SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *;`,
    params
  );

  if (rows.length === 0) {
    throw new AppError('NOT_FOUND');
  }

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'exams.update',
    entityType: 'exams',
    entityId: examId,
    afterData: rows[0],
    ipAddress,
  });

  return rows[0];
}

export async function copyExam(examId: string, actorId: string, ipAddress?: string) {
  const { rows: source } = await pool.query('SELECT * FROM exams WHERE id = $1;', [examId]);
  if (source.length === 0) throw new AppError('NOT_FOUND');

  const src = source[0];
  const newCode = `${src.code}_COPY_${Date.now().toString().slice(-4)}`;
  const newTitle = `[Salinan] ${src.title}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    const { rows: newExamRows } = await client.query(
      `INSERT INTO exams (
        code, title, description, duration_minutes, question_count,
        passing_score, shuffle_questions, shuffle_options,
        max_attempts_per_student, allow_review, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11)
      RETURNING *;`,
      [
        newCode,
        newTitle,
        src.description,
        src.duration_minutes,
        src.question_count,
        src.passing_score,
        src.shuffle_questions,
        src.shuffle_options,
        src.max_attempts_per_student,
        src.allow_review,
        actorId,
      ]
    );

    const newExamId = newExamRows[0].id;

    // Copy rules
    await client.query(
      `INSERT INTO exam_question_rules (exam_id, category_id, difficulty, question_count)
       SELECT $1, category_id, difficulty, question_count
       FROM exam_question_rules
       WHERE exam_id = $2;`,
      [newExamId, examId]
    );

    await logAudit(
      {
        actorId,
        actorRole: 'admin',
        action: 'exams.copy',
        entityType: 'exams',
        entityId: newExamId,
        reason: `Copied from exam ${examId}`,
        afterData: newExamRows[0],
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');
    return newExamRows[0];
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

export async function addExamRule(
  examId: string,
  rule: ExamRuleInput,
  actorId: string,
  ipAddress?: string
) {
  await assertExamNotLocked(examId);

  const { rows } = await pool.query(
    `INSERT INTO exam_question_rules (exam_id, category_id, difficulty, question_count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (exam_id, category_id, difficulty)
     DO UPDATE SET question_count = $4
     RETURNING *;`,
    [examId, rule.category_id, rule.difficulty || null, rule.question_count]
  );

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'exams.add_rule',
    entityType: 'exam_question_rules',
    entityId: rows[0].id,
    afterData: rows[0],
    ipAddress,
  });

  return rows[0];
}

export async function deleteExamRule(
  examId: string,
  ruleId: string,
  actorId: string,
  ipAddress?: string
) {
  await assertExamNotLocked(examId);

  const { rows } = await pool.query(
    `DELETE FROM exam_question_rules WHERE id = $1 AND exam_id = $2 RETURNING *;`,
    [ruleId, examId]
  );

  if (rows.length === 0) throw new AppError('NOT_FOUND');

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'exams.delete_rule',
    entityType: 'exam_question_rules',
    entityId: ruleId,
    beforeData: rows[0],
    ipAddress,
  });

  return rows[0];
}

export async function updateExamRule(
  examId: string,
  ruleId: string,
  questionCount: number,
  actorId: string,
  ipAddress?: string
) {
  await assertExamNotLocked(examId);

  const { rows } = await pool.query(
    `UPDATE exam_question_rules
     SET question_count = $1
     WHERE id = $2 AND exam_id = $3
     RETURNING *;`,
    [questionCount, ruleId, examId]
  );

  if (rows.length === 0) throw new AppError('NOT_FOUND');

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'exams.update_rule',
    entityType: 'exam_question_rules',
    entityId: ruleId,
    afterData: rows[0],
    ipAddress,
  });

  return rows[0];
}

export async function deleteExam(examId: string, actorId: string, ipAddress?: string) {
  await assertExamNotLocked(examId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query('DELETE FROM exam_question_rules WHERE exam_id = $1;', [examId]);
    const { rows } = await client.query('DELETE FROM exams WHERE id = $1 RETURNING id, title, code;', [examId]);
    if (rows.length === 0) throw new AppError('NOT_FOUND');
    await client.query('COMMIT;');

    await logAudit({
      actorId,
      actorRole: 'admin',
      action: 'exams.delete',
      entityType: 'exams',
      entityId: examId,
      beforeData: rows[0],
      ipAddress,
    });

    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

