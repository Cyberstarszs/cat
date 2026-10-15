import { pool } from './connection.js';
import { seedAdmin } from './seeds/seed-admin.js';

export async function cleanDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('[CLEAN] Cleaning all test logs and trial data from database...');

    const tables = [
      'audit_logs',
      'attempt_events',
      'attempt_answers',
      'attempt_questions',
      'attempts',
      'results',
      'certificates',
      'certificate_counters',
      'appeals',
      'notifications',
      'session_enrollments',
      'exam_sessions',
      'exam_question_rules',
      'exams',
      'question_corrections',
      'question_options',
      'question_versions',
      'questions',
      'question_categories',
      'auth_sessions',
      'user_settings',
      'student_profiles',
      'users',
    ];

    await client.query('BEGIN;');
    await client.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`);
    await client.query('COMMIT;');

    console.log('[CLEAN] Successfully cleared all test data and trial logs.');

    // Freshly seed administrator
    await seedAdmin();

    console.log('[CLEAN] Database is now pristine and 100% ready for production!');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[CLEAN] Failed to clean database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Auto-run if executed directly via CLI
if (process.argv[1]?.includes('clean')) {
  cleanDatabase()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
