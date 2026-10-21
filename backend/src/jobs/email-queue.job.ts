import { pool } from '../db/connection.js';
import { getSmtpSettings } from '../modules/settings/settings.service.js';
import { sendOutboxEmail, EmailOutboxItem } from '../modules/email/email.service.js';

/**
 * Worker pemroses antrean email sertifikat mahasiswa.
 * Menjalankan pengiriman bertahap dengan throttling (jeda waktu teratur)
 * untuk mencegah penolakan dari server email kampus atau filter spam.
 */
export async function processEmailOutboxBatch(): Promise<number> {
  const smtp = await getSmtpSettings();
  if (!smtp.enabled) {
    return 0;
  }

  let client: any;
  try {
    client = await pool.connect();
    await client.query('BEGIN;');

    // Ambil maksimal 5 email yang siap dikirim dengan SKIP LOCKED untuk konkurensi aman
    const query = `
      SELECT 
        o.id, o.certificate_id, o.recipient_email, o.recipient_name,
        o.subject, o.body_html, o.body_text, o.status, o.attempts,
        o.max_attempts, o.last_error, o.next_retry_at, o.created_at,
        sp.identifier, c.certificate_no
      FROM email_outbox o
      LEFT JOIN certificates c ON c.id = o.certificate_id
      LEFT JOIN results r ON r.id = c.result_id
      LEFT JOIN attempts a ON a.id = r.attempt_id
      LEFT JOIN session_enrollments se ON se.id = a.enrollment_id
      LEFT JOIN student_profiles sp ON sp.user_id = se.student_id
      WHERE o.status = 'pending'
        AND o.next_retry_at <= now()
      ORDER BY o.created_at ASC
      LIMIT 5
      FOR UPDATE OF o SKIP LOCKED;
    `;

    const { rows } = await client.query(query);

    // Kunci status menjadi 'sending' sementara di dalam transaksi
    if (rows.length > 0) {
      const ids = rows.map((r: any) => r.id);
      await client.query(
        `UPDATE email_outbox SET status = 'sending' WHERE id = ANY($1::uuid[]);`,
        [ids]
      );
    }

    await client.query('COMMIT;');

    if (rows.length === 0) return 0;

    let processedCount = 0;
    const delayBetweenMs = Math.max(500, smtp.delay_between_emails_ms || 2000);

    for (const item of rows as EmailOutboxItem[]) {
      await sendOutboxEmail(item, smtp);
      processedCount++;

      // Jeda terkontrol antar-email (Anti-Spam Throttling)
      if (processedCount < rows.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenMs));
      }
    }

    return processedCount;
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK;').catch(() => {});
    }
    console.error('[EMAIL_QUEUE_JOB] Kesalahan saat memproses antrean email:', err);
    return 0;
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Menjalankan background worker antrean email dengan interval tertentu.
 */
export function startEmailQueueWorker(intervalMs: number = 4000): () => void {
  let isRunning = false;

  const timer = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const count = await processEmailOutboxBatch();
      if (count > 0) {
        console.log(`[EMAIL_QUEUE_JOB] Berhasil memproses ${count} email sertifikat.`);
      }
    } catch (err) {
      console.error('[EMAIL_QUEUE_JOB] Error di loop worker:', err);
    } finally {
      isRunning = false;
    }
  }, intervalMs);

  return () => {
    clearInterval(timer);
    console.log('[EMAIL_QUEUE_JOB] Worker antrean email dihentikan.');
  };
}
