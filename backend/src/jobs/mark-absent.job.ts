import { pool } from '../db/connection.js';

/**
 * Background worker: Menandai peserta yang terdaftar ('registered') tetapi tidak hadir
 * mengikuti ujian sampai sesi selesai menjadi 'absent'.
 */
export async function sweepAbsentEnrollments(): Promise<number> {
  const query = `
    UPDATE session_enrollments
    SET status = 'absent'
    WHERE status = 'registered'
      AND session_id IN (
        SELECT id FROM exam_sessions
        WHERE status = 'published'
          AND ends_at + interval '1 minute' <= now()
      )
    RETURNING id;
  `;

  try {
    const { rowCount } = await pool.query(query);
    return rowCount || 0;
  } catch (err) {
    console.error('[ABSENT_SWEEPER] Error marking absent enrollments:', err);
    return 0;
  }
}

export function startAbsentSweeper(intervalMs: number = 60000): () => void {
  let isRunning = false;

  const timer = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const count = await sweepAbsentEnrollments();
      if (count > 0) {
        console.log(`[ABSENT_SWEEPER] Marked ${count} unattempted enrollment(s) as absent.`);
      }
    } finally {
      isRunning = false;
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
