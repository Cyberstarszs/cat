import { parse } from 'csv-parse/sync';
import { pool } from '../../db/connection.js';
import { AppError } from '../../lib/errors.js';
import { logAudit } from '../audit/audit.service.js';
import { parseDocxQuestions } from './docx-parser.js';
import { parseDocQuestions } from './doc-parser.js';
import { detectCsvDelimiter } from '../users/users.service.js';

export interface QuestionOptionInput {
  position: number;
  option_text: string;
  is_correct: boolean;
}

export interface CreateQuestionInput {
  category_id: string;
  stem: string;
  difficulty: number; // 1-3
  weight?: number;
  explanation?: string | null;
  options: QuestionOptionInput[];
  status?: 'draft' | 'active';
  year?: number;
}

export async function createCategory(name: string, description?: string | null, actorId?: string, ipAddress?: string) {
  const cleanName = name.trim();
  const existing = await pool.query('SELECT id FROM question_categories WHERE lower(name) = lower($1);', [cleanName]);
  if (existing.rows.length > 0) {
    throw new AppError('VALIDATION_FAILED', `Kategori "${cleanName}" sudah ada.`);
  }

  const { rows } = await pool.query(
    `INSERT INTO question_categories (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at;`,
    [cleanName, description || null]
  );

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'categories.create',
    entityType: 'question_categories',
    entityId: rows[0].id,
    afterData: rows[0],
    ipAddress,
  });

  return rows[0];
}

export async function deleteCategory(id: string, actorId?: string, ipAddress?: string) {
  const check = await pool.query('SELECT COUNT(*) AS total FROM questions WHERE category_id = $1;', [id]);
  if (parseInt(check.rows[0].total, 10) > 0) {
    throw new AppError('VALIDATION_FAILED', 'Kategori tidak dapat dihapus karena masih memiliki soal.');
  }

  const { rows } = await pool.query('DELETE FROM question_categories WHERE id = $1 RETURNING id, name;', [id]);
  if (rows.length === 0) {
    throw new AppError('NOT_FOUND');
  }

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'categories.delete',
    entityType: 'question_categories',
    entityId: id,
    beforeData: rows[0],
    ipAddress,
  });

  return rows[0];
}

export async function createQuestion(data: CreateQuestionInput, actorId: string, ipAddress?: string) {
  if (!data.options || data.options.length < 2) {
    throw new AppError('VALIDATION_FAILED', 'Soal minimal harus memiliki 2 pilihan opsi jawaban.');
  }

  const correctOptions = data.options.filter((o) => o.is_correct);
  if (correctOptions.length !== 1) {
    throw new AppError('VALIDATION_FAILED', 'Soal harus memiliki tepat satu kunci jawaban yang benar.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    const questionYear = data.year || new Date().getFullYear();

    const { rows: qRows } = await client.query(
      `INSERT INTO questions (category_id, status, created_by, year)
       VALUES ($1, $2, $3, $4)
       RETURNING id, year;`,
      [data.category_id, data.status || 'draft', actorId, questionYear]
    );
    const questionId = qRows[0].id;

    const { rows: vRows } = await client.query(
      `INSERT INTO question_versions (question_id, version_no, stem, difficulty, weight, explanation, created_by)
       VALUES ($1, 1, $2, $3, $4, $5, $6)
       RETURNING id;`,
      [questionId, data.stem.trim(), data.difficulty, data.weight || 1.0, data.explanation?.trim() || null, actorId]
    );
    const versionId = vRows[0].id;

    for (const opt of data.options) {
      await client.query(
        `INSERT INTO question_options (question_version_id, position, option_text, is_correct)
         VALUES ($1, $2, $3, $4);`,
        [versionId, opt.position, opt.option_text.trim(), opt.is_correct]
      );
    }

    await client.query(`UPDATE questions SET current_version_id = $1 WHERE id = $2;`, [versionId, questionId]);

    await logAudit(
      {
        actorId,
        actorRole: 'admin',
        action: 'questions.create',
        entityType: 'questions',
        entityId: questionId,
        afterData: { version_id: versionId, stem: data.stem, year: questionYear },
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');

    return {
      id: questionId,
      current_version_id: versionId,
      version_no: 1,
      year: questionYear,
    };
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

export async function createNewVersion(
  questionId: string,
  data: Omit<CreateQuestionInput, 'category_id'>,
  actorId: string,
  ipAddress?: string
) {
  if (!data.options || data.options.length < 2) {
    throw new AppError('VALIDATION_FAILED', 'Soal minimal harus memiliki 2 pilihan opsi jawaban.');
  }

  const correctOptions = data.options.filter((o) => o.is_correct);
  if (correctOptions.length !== 1) {
    throw new AppError('VALIDATION_FAILED', 'Soal harus memiliki tepat satu kunci jawaban yang benar.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    const { rows: qRows } = await client.query(
      `SELECT id, current_version_id FROM questions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE;`,
      [questionId]
    );
    if (qRows.length === 0) {
      throw new AppError('NOT_FOUND');
    }

    const { rows: maxV } = await client.query(
      `SELECT COALESCE(MAX(version_no), 0) AS max_v FROM question_versions WHERE question_id = $1;`,
      [questionId]
    );
    const nextVersionNo = parseInt(maxV[0].max_v, 10) + 1;

    const { rows: vRows } = await client.query(
      `INSERT INTO question_versions (question_id, version_no, stem, difficulty, weight, explanation, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id;`,
      [questionId, nextVersionNo, data.stem.trim(), data.difficulty, data.weight || 1.0, data.explanation?.trim() || null, actorId]
    );
    const newVersionId = vRows[0].id;

    for (const opt of data.options) {
      await client.query(
        `INSERT INTO question_options (question_version_id, position, option_text, is_correct)
         VALUES ($1, $2, $3, $4);`,
        [newVersionId, opt.position, opt.option_text.trim(), opt.is_correct]
      );
    }

    await client.query(
      `UPDATE questions SET current_version_id = $1, status = COALESCE($2, status) WHERE id = $3;`,
      [newVersionId, data.status || null, questionId]
    );

    await logAudit(
      {
        actorId,
        actorRole: 'admin',
        action: 'questions.new_version',
        entityType: 'questions',
        entityId: questionId,
        afterData: { version_id: newVersionId, version_no: nextVersionNo },
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');

    return {
      id: questionId,
      current_version_id: newVersionId,
      version_no: nextVersionNo,
    };
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

export async function addQuestionCorrection(
  questionVersionId: string,
  type: 'also_accept' | 'key_changed' | 'annulled',
  oldOptionId: string | null,
  newOptionId: string | null,
  reason: string,
  actorId: string,
  ipAddress?: string
) {
  // Verifikasi versi soal ada
  const { rows: vRows } = await pool.query(
    `SELECT qv.id, qv.question_id, qv.weight, qo.id AS correct_option_id
     FROM question_versions qv
     LEFT JOIN question_options qo ON qo.question_version_id = qv.id AND qo.is_correct = true
     WHERE qv.id = $1;`,
    [questionVersionId]
  );
  if (vRows.length === 0) {
    throw new AppError('NOT_FOUND');
  }

  const v = vRows[0];
  const actualOldOptionId = oldOptionId || v.correct_option_id;

  if (type === 'key_changed' && !newOptionId) {
    throw new AppError('VALIDATION_FAILED', 'Koreksi "key_changed" memerlukan opsi pengganti yang valid.');
  }

  if (type === 'also_accept' && !newOptionId) {
    throw new AppError('VALIDATION_FAILED', 'Koreksi "also_accept" memerlukan opsi tambahan yang diakui benar.');
  }

  const { rows } = await pool.query(
    `INSERT INTO question_corrections (question_version_id, type, old_option_id, new_option_id, reason, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, question_version_id, type, old_option_id, new_option_id, reason, created_at;`,
    [questionVersionId, type, actualOldOptionId, newOptionId || null, reason.trim(), actorId]
  );

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'questions.correction',
    entityType: 'question_corrections',
    entityId: rows[0].id,
    afterData: rows[0],
    reason,
    ipAddress,
  });

  return rows[0];
}

export function parseAndPreviewQuestionsCSV(csvBuffer: Buffer): {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: any[];
  parsedPayload: any[];
} {
  let records: any[];
  try {
    records = parse(csvBuffer, {
      columns: true,
      delimiter: detectCsvDelimiter(csvBuffer),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err: any) {
    throw new AppError('VALIDATION_FAILED', `Gagal membaca format CSV: ${err.message}`);
  }

  const previewRows: any[] = [];
  const parsedPayload: any[] = [];

  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const rowNum = i + 2;
    const errors: string[] = [];

    const categoryName = (raw.kategori || '').trim();
    const difficulty = parseInt(raw.tingkat || '1', 10);
    const weight = parseFloat(raw.bobot || '1.0');
    const stem = (raw.soal || '').trim();
    const key = (raw.kunci || '').trim().toUpperCase();
    const explanation = (raw.pembahasan || '').trim() || null;

    if (!categoryName) errors.push('kategori wajib diisi');
    if (!stem) errors.push('soal wajib diisi');
    if (isNaN(difficulty) || difficulty < 1 || difficulty > 3) errors.push('tingkat harus antara 1 sampai 3');
    if (isNaN(weight) || weight <= 0) errors.push('bobot harus > 0');

    // Collect options A-F
    const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const options: QuestionOptionInput[] = [];

    optionLetters.forEach((letter, idx) => {
      const optKey = `opsi_${letter.toLowerCase()}`;
      const optVal = (raw[optKey] || '').trim();
      if (optVal) {
        options.push({
          position: idx + 1,
          option_text: optVal,
          is_correct: letter === key,
        });
      }
    });

    if (options.length < 2) {
      errors.push('minimal opsi_a dan opsi_b harus terisi');
    }

    const correctCount = options.filter((o) => o.is_correct).length;
    if (correctCount !== 1) {
      errors.push(`kunci "${key}" tidak cocok dengan opsi yang tersedia`);
    }

    const formattedOptions = options.map((opt) => ({
      position: opt.position,
      letter: String.fromCharCode(64 + opt.position),
      text: opt.option_text,
      is_correct: opt.is_correct,
    }));

    previewRows.push({
      rowNumber: rowNum,
      category: categoryName,
      difficulty,
      weight,
      stem,
      options: formattedOptions,
      options_count: options.length,
      key,
      explanation,
      errors,
    });

    if (errors.length === 0) {
      parsedPayload.push({
        categoryName,
        difficulty,
        weight,
        stem,
        explanation,
        options,
      });
    }
  }

  return {
    totalRows: previewRows.length,
    validRows: parsedPayload.length,
    invalidRows: previewRows.filter((r) => r.errors.length > 0).length,
    rows: previewRows,
    parsedPayload,
  };
}

function formatAndValidateParsedQuestions(parsed: any[]): {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: any[];
  parsedPayload: any[];
} {
  const previewRows: any[] = [];
  const parsedPayload: any[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const q = parsed[i];
    const errors: string[] = [];

    if (!q.category) errors.push('kategori tidak terdeteksi');
    if (!q.stem) errors.push('teks soal kosong');
    if (!q.options || q.options.length < 2) errors.push('minimal 2 opsi jawaban diperlukan');

    const correctCount = (q.options || []).filter((o: any) => o.is_correct).length;
    if (correctCount !== 1) {
      errors.push(`kunci jawaban tidak valid (ditemukan ${correctCount} kunci)`);
    }

    const optionsInput = (q.options || []).map((opt: any) => ({
      position: opt.position,
      option_text: opt.option_text,
      is_correct: opt.is_correct,
    }));

    const formattedOptions = (q.options || []).map((opt: any) => ({
      position: opt.position,
      letter: opt.letter || String.fromCharCode(64 + opt.position),
      text: opt.option_text,
      is_correct: opt.is_correct,
    }));

    previewRows.push({
      rowNumber: i + 1,
      category: q.category,
      difficulty: q.difficulty || 2,
      weight: q.weight || 5.0,
      stem: q.stem,
      options: formattedOptions,
      options_count: (q.options || []).length,
      key: q.correct_key,
      explanation: null,
      errors,
    });

    if (errors.length === 0) {
      parsedPayload.push({
        categoryName: q.category,
        difficulty: q.difficulty || 2,
        weight: q.weight || 5.0,
        stem: q.stem,
        explanation: null,
        options: optionsInput,
      });
    }
  }

  return {
    totalRows: previewRows.length,
    validRows: parsedPayload.length,
    invalidRows: previewRows.filter((r) => r.errors.length > 0).length,
    rows: previewRows,
    parsedPayload,
  };
}

export function parseAndPreviewQuestionsDocx(
  docxBuffer: Buffer,
  defaultCategory: string = 'Umum'
): {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: any[];
  parsedPayload: any[];
} {
  let parsed: any[];
  try {
    parsed = parseDocxQuestions(docxBuffer, defaultCategory);
  } catch (err: any) {
    throw new AppError('VALIDATION_FAILED', `Gagal membaca format DOCX: ${err.message}`);
  }

  return formatAndValidateParsedQuestions(parsed);
}

export async function parseAndPreviewQuestionsDoc(
  docBuffer: Buffer,
  defaultCategory: string = 'Umum'
): Promise<{
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: any[];
  parsedPayload: any[];
}> {
  let parsed: any[];
  try {
    parsed = await parseDocQuestions(docBuffer, defaultCategory);
  } catch (err: any) {
    throw new AppError('VALIDATION_FAILED', `Gagal membaca format DOC: ${err.message}`);
  }

  return formatAndValidateParsedQuestions(parsed);
}

export async function commitQuestionsImport(
  parsedQuestions: any[],
  actorId: string,
  ipAddress?: string,
  importYear?: number
): Promise<{ totalImported: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    let imported = 0;
    // Cache categories to avoid redundant queries
    const catCache = new Map<string, string>();

    for (const q of parsedQuestions) {
      let catId = catCache.get(q.categoryName.toLowerCase());
      if (!catId) {
        const catRes = await client.query(
          `SELECT id FROM question_categories WHERE lower(name) = lower($1);`,
          [q.categoryName]
        );
        if (catRes.rows.length > 0) {
          catId = catRes.rows[0].id;
        } else {
          const newCat = await client.query(
            `INSERT INTO question_categories (name) VALUES ($1) RETURNING id;`,
            [q.categoryName]
          );
          catId = newCat.rows[0].id;
        }
        catCache.set(q.categoryName.toLowerCase(), catId!);
      }

      const qYear = q.year || importYear || new Date().getFullYear();

      const { rows: qRows } = await client.query(
        `INSERT INTO questions (category_id, status, created_by, year)
         VALUES ($1, 'active', $2, $3)
         RETURNING id;`,
        [catId, actorId, qYear]
      );
      const questionId = qRows[0].id;

      const { rows: vRows } = await client.query(
        `INSERT INTO question_versions (question_id, version_no, stem, difficulty, weight, explanation, created_by)
         VALUES ($1, 1, $2, $3, $4, $5, $6)
         RETURNING id;`,
        [questionId, q.stem, q.difficulty, q.weight, q.explanation, actorId]
      );
      const versionId = vRows[0].id;

      for (const opt of q.options) {
        await client.query(
          `INSERT INTO question_options (question_version_id, position, option_text, is_correct)
           VALUES ($1, $2, $3, $4);`,
          [versionId, opt.position, opt.option_text, opt.is_correct]
        );
      }

      await client.query(`UPDATE questions SET current_version_id = $1 WHERE id = $2;`, [versionId, questionId]);
      imported++;
    }

    await logAudit(
      {
        actorId,
        actorRole: 'admin',
        action: 'questions.import_csv',
        entityType: 'questions',
        reason: `Bulk imported ${imported} questions from CSV`,
        afterData: { total_imported: imported },
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');
    return { totalImported: imported };
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

export async function previewCorrectionImpact(
  questionVersionId: string,
  type: 'also_accept' | 'key_changed' | 'annulled',
  oldOptionId: string | null,
  newOptionId: string | null
) {
  const { evaluateScore, calculateQuestionPoints } = await import('../../lib/grading.js');

  const { rows: vRows } = await pool.query(
    `SELECT qv.id, qv.weight, qo.id AS correct_option_id
     FROM question_versions qv
     JOIN question_options qo ON qo.question_version_id = qv.id AND qo.is_correct = true
     WHERE qv.id = $1;`,
    [questionVersionId]
  );
  if (vRows.length === 0) throw new AppError('NOT_FOUND');
  const originalCorrectId = vRows[0].correct_option_id;

  const query = `
    SELECT 
      a.id AS attempt_id,
      r.id AS result_id, r.score AS current_score, r.passed AS current_passed, r.passing_score,
      sp.identifier, sp.full_name
    FROM attempt_questions aq
    JOIN attempts a ON a.id = aq.attempt_id
    JOIN results r ON r.attempt_id = a.id
    JOIN session_enrollments se ON se.id = a.enrollment_id
    JOIN student_profiles sp ON sp.user_id = se.student_id
    WHERE aq.question_version_id = $1 AND a.status <> 'void';
  `;
  const { rows: attempts } = await pool.query(query, [questionVersionId]);

  const { rows: existingCorrections } = await pool.query(
    `SELECT question_version_id, type, old_option_id, new_option_id, created_at
     FROM question_corrections
     WHERE question_version_id = $1;`,
    [questionVersionId]
  );

  const candidateCorrections = [
    ...existingCorrections,
    {
      type,
      old_option_id: oldOptionId || originalCorrectId,
      new_option_id: newOptionId || null,
      created_at: new Date(),
    },
  ];

  let improvedCount = 0;
  let droppedCount = 0;
  let newlyPassing = 0;
  let newlyFailing = 0;
  const sampleDiffs = [];

  for (const att of attempts) {
    const { rows: ansRows } = await pool.query(
      `SELECT 
        aq.id, aq.question_version_id, qv.weight,
        qo_correct.id AS correct_option_id,
        ans.selected_option_id
       FROM attempt_questions aq
       JOIN question_versions qv ON qv.id = aq.question_version_id
       JOIN question_options qo_correct ON qo_correct.question_version_id = qv.id AND qo_correct.is_correct = true
       LEFT JOIN attempt_answers ans ON ans.attempt_question_id = aq.id
       WHERE aq.attempt_id = $1;`,
      [att.attempt_id]
    );

    const gradingItems = [];
    for (const q of ansRows) {
      const isTargetQ = q.question_version_id === questionVersionId;
      const rules = isTargetQ ? candidateCorrections : [];
      const res = calculateQuestionPoints(q.selected_option_id, q.correct_option_id, parseFloat(q.weight), rules);
      gradingItems.push(res);
    }

    const evalResult = evaluateScore(gradingItems, parseFloat(att.passing_score));
    const scoreDiff = parseFloat((evalResult.score - parseFloat(att.current_score)).toFixed(2));

    if (scoreDiff > 0) improvedCount++;
    if (scoreDiff < 0) droppedCount++;
    if (!att.current_passed && evalResult.passed) newlyPassing++;
    if (att.current_passed && !evalResult.passed) newlyFailing++;

    if (scoreDiff !== 0 && sampleDiffs.length < 10) {
      sampleDiffs.push({
        identifier: att.identifier,
        name: att.full_name,
        current_score: parseFloat(att.current_score),
        simulated_score: evalResult.score,
        score_diff: scoreDiff,
        current_passed: att.current_passed,
        simulated_passed: evalResult.passed,
      });
    }
  }

  return {
    total_evaluated_attempts: attempts.length,
    students_improved: improvedCount,
    students_dropped: droppedCount,
    newly_passing: newlyPassing,
    newly_failing: newlyFailing,
    sample_diffs: sampleDiffs,
  };
}

export async function getQuestionPreview(questionId: string) {
  const { rows } = await pool.query(
    `SELECT 
      q.id, q.status, q.year, c.name AS category_name,
      qv.id AS version_id, qv.version_no, qv.stem, qv.difficulty, qv.weight, qv.explanation, qv.created_at
     FROM questions q
     JOIN question_categories c ON c.id = q.category_id
     JOIN question_versions qv ON qv.id = q.current_version_id
     WHERE q.id = $1 AND q.deleted_at IS NULL;`,
    [questionId]
  );
  if (rows.length === 0) throw new AppError('NOT_FOUND');
  const q = rows[0];

  const { rows: options } = await pool.query(
    `SELECT id, position, option_text, is_correct
     FROM question_options
     WHERE question_version_id = $1
     ORDER BY position ASC;`,
    [q.version_id]
  );

  const formattedOptions = options.map((opt, idx) => ({
    id: opt.id,
    label: String.fromCharCode(65 + idx),
    text: opt.option_text,
    is_correct: opt.is_correct,
  }));

  return {
    question: {
      ...q,
      options: formattedOptions,
    },
  };
}

