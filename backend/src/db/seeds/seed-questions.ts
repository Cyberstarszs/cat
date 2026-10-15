import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RawOption {
  position: number;
  letter: string;
  option_text: string;
  is_correct: boolean;
}

interface RawQuestion {
  number: number;
  category: string;
  stem: string;
  difficulty: number;
  weight: number;
  correct_key: string;
  options: RawOption[];
}

export async function seedQuestions(): Promise<void> {
  const jsonPath = path.resolve(__dirname, 'questions_lg_assessment.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Data file not found at ${jsonPath}`);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const questions: RawQuestion[] = JSON.parse(rawData);

  console.log(`[SEED] Loaded ${questions.length} questions from Tabulasi Soal Assessment LG.`);

  const client = await pool.connect();
  try {
    // 1. Get an admin user
    const { rows: adminRows } = await client.query(
      `SELECT id, email FROM users WHERE role = 'admin' AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;`
    );

    if (adminRows.length === 0) {
      throw new Error('No administrator user found in database. Run seed:admin first.');
    }

    const adminId = adminRows[0].id;
    console.log(`[SEED] Using administrator account: ${adminRows[0].email} (${adminId})`);

    await client.query('BEGIN;');

    // 2. Ensure categories exist
    const categoryMap = new Map<string, string>();
    const requiredCategories = [
      { name: 'Tes Wawasan Kebangsaan', desc: 'Asesmen penguasaan wawasan kebangsaan, integritas, dan pilar negara' },
      { name: 'Tes Inteligensia Umum', desc: 'Asesmen kemampuan logika, analogi, penalaran, dan numerik' },
      { name: 'Tes Karakteristik Pribadi', desc: 'Asesmen integritas pelayanan publik, etika, dan orientasi kerja' },
    ];

    for (const cat of requiredCategories) {
      const { rows: existingCat } = await client.query(
        `SELECT id FROM question_categories WHERE lower(name) = lower($1);`,
        [cat.name]
      );

      if (existingCat.length > 0) {
        categoryMap.set(cat.name, existingCat[0].id);
      } else {
        const { rows: newCat } = await client.query(
          `INSERT INTO question_categories (name, description) VALUES ($1, $2) RETURNING id;`,
          [cat.name, cat.desc]
        );
        categoryMap.set(cat.name, newCat[0].id);
        console.log(`[SEED] Created question category: ${cat.name}`);
      }
    }

    let insertedCount = 0;
    let skippedCount = 0;

    for (const q of questions) {
      const categoryId = categoryMap.get(q.category);
      if (!categoryId) {
        throw new Error(`Category not found for: ${q.category}`);
      }

      // Check if question stem already exists under this category to avoid duplicate seeding
      const { rows: existingQ } = await client.query(
        `SELECT q.id
         FROM questions q
         JOIN question_versions qv ON qv.question_id = q.id
         WHERE q.category_id = $1 AND q.deleted_at IS NULL AND qv.stem = $2;`,
        [categoryId, q.stem]
      );

      if (existingQ.length > 0) {
        skippedCount++;
        continue;
      }

      // Insert question
      const { rows: qRows } = await client.query(
        `INSERT INTO questions (category_id, status, created_by)
         VALUES ($1, 'active', $2)
         RETURNING id;`,
        [categoryId, adminId]
      );
      const questionId = qRows[0].id;

      // Insert question version
      const { rows: vRows } = await client.query(
        `INSERT INTO question_versions (question_id, version_no, stem, difficulty, weight, explanation, created_by)
         VALUES ($1, 1, $2, $3, $4, null, $5)
         RETURNING id;`,
        [questionId, q.stem, q.difficulty || 2, q.weight || 1.0, adminId]
      );
      const versionId = vRows[0].id;

      // Insert options
      for (const opt of q.options) {
        await client.query(
          `INSERT INTO question_options (question_version_id, position, option_text, is_correct)
           VALUES ($1, $2, $3, $4);`,
          [versionId, opt.position, opt.option_text, opt.is_correct]
        );
      }

      // Update current version
      await client.query(`UPDATE questions SET current_version_id = $1 WHERE id = $2;`, [versionId, questionId]);
      insertedCount++;
    }

    // 3. Ensure a comprehensive Exam exists: "Assessment LG - Ujian Kompetensi Umum"
    const examCode = 'EXAM-LG-2026';
    const { rows: existingExam } = await client.query(`SELECT id FROM exams WHERE code = $1;`, [examCode]);

    let examId: string;
    if (existingExam.length === 0) {
      const { rows: examRows } = await client.query(
        `INSERT INTO exams (
           code, title, description, duration_minutes, question_count, passing_score,
           shuffle_questions, shuffle_options, max_attempts_per_student, allow_review, status, created_by
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11
         )
         RETURNING id;`,
        [
          examCode,
          'Assessment LG - Ujian Kompetensi Tata Kelola & Karakteristik Pribadi',
          'Paket soal resmi komprehensif terdiri dari Tes Wawasan Kebangsaan (TWK), Tes Inteligensia Umum (TIU), dan Tes Karakteristik Pribadi (TKP) Fakultas Ilmu Administrasi Universitas Madura.',
          100, // 100 minutes
          questions.length, // total questions
          65.0, // passing score standard
          true,
          true,
          3,
          true,
          adminId,
        ]
      );
      examId = examRows[0].id;
      console.log(`[SEED] Created default Exam: ${examCode}`);

      // Add exam rules for the 3 categories
      for (const [catName, catId] of categoryMap.entries()) {
        const catQCount = questions.filter((q) => q.category === catName).length;
        if (catQCount > 0) {
          await client.query(
            `INSERT INTO exam_question_rules (exam_id, category_id, difficulty, question_count)
             VALUES ($1, $2, 2, $3)
             ON CONFLICT DO NOTHING;`,
            [examId, catId, catQCount]
          );
        }
      }
    } else {
      examId = existingExam[0].id;
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, reason, after_data)
       VALUES ($1, 'admin', 'questions.seed_lg_assessment', 'questions', $1, 'Seeded 99 questions from Tabulasi Soal Assessment LG.docx', $2);`,
      [adminId, JSON.stringify({ total_inserted: insertedCount, skipped: skippedCount })]
    );

    await client.query('COMMIT;');
    console.log(`[SEED] Questions Seeding Completed Successfully!`);
    console.log(` - Inserted: ${insertedCount} questions`);
    console.log(` - Skipped (already existed): ${skippedCount} questions`);
    console.log(` - Total questions now available in Bank Soal.`);
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[SEED] Failed to seed questions:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Auto-run if executed directly via CLI
if (process.argv[1]?.includes('seed-questions')) {
  seedQuestions()
    .then(() => {
      console.log('[SEED] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[SEED] Fatal error:', err);
      process.exit(1);
    });
}
