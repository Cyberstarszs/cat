import { pool } from '../db/connection.js';
import { submitExamAttempt } from '../modules/attempts/attempts.service.js';
import { CONSTANTS } from '../config/constants.js';

/**
 * INV-03 & BR-03: Sweeper pengerjaan ujian yang melebihi batas waktu deadline + 5 detik grace period.
 * Menjamin zero-trust timer tetap berlaku meskipun browser peserta ditutup atau koneksi terputus.
 */
export async function sweepTimeoutAttempts(): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    const graceSeconds = CONSTANTS.ANSWER_GRACE_SECONDS;

    // Cari attempt yang kedaluwarsa dengan SKIP LOCKED untuk konkurensi aman
    const query = `
      SELECT id
      FROM attempts
      WHERE status = 'in_progress'
        AND now() >= deadline_at + ($1 || ' seconds')::interval
      FOR UPDATE SKIP LOCKED
      LIMIT 50;
    `;

    const { rows: expired } = await client.query(query, [graceSeconds]);
    await client.query('COMMIT;');

    if (expired.length === 0) return 0;

    let autoSubmittedCount = 0;
    for (const att of expired) {
      try {
        await submitExamAttempt(att.id, 'timeout');
        autoSubmittedCount++;
      } catch (err) {
        console.error(`[SWEEPER] Failed to auto-submit attempt ${att.id}:`, err);
      }
    }

    return autoSubmittedCount;
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[SWEEPER] Error during timeout sweep:', err);
    return 0;
  } finally {
    client.release();
  }
}

export function startTimeoutSweeper(intervalMs: number = 10000): () => void {
  let isRunning = false;

  const timer = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const count = await sweepTimeoutAttempts();
      if (count > 0) {
        console.log(`[SWEEPER] Auto-submitted ${count} expired exam attempt(s).`);
      }
    } finally {
      isRunning = false;
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
