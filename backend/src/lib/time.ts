import { pool } from '../db/connection.js';
import { CONSTANTS } from '../config/constants.js';

/**
 * INV-02: Waktu mulai dan batas ujian bersumber murni dari jam database (now() / clock_timestamp()).
 * Browser/klien tidak boleh menjadi sumber kebenaran waktu.
 */
export async function getDatabaseTime(): Promise<Date> {
  const result = await pool.query('SELECT clock_timestamp() as db_time;');
  return new Date(result.rows[0].db_time);
}

/**
 * BR-03: deadline_at = started_at + durasi_menit + extra_seconds
 */
export function calculateDeadline(startedAt: Date, durationMinutes: number, extraSeconds: number = 0): Date {
  const deadlineMs = startedAt.getTime() + (durationMinutes * 60 * 1000) + (extraSeconds * 1000);
  return new Date(deadlineMs);
}

/**
 * INV-03: Batas pengerjaan adalah minimum antara (waktu mulai + durasi) dan waktu selesai sesi (ends_at).
 */
export function calculateAttemptDeadline(startedAt: Date, durationMinutes: number, sessionEndsAt: Date): Date {
  const theoreticalDeadline = calculateDeadline(startedAt, durationMinutes);
  return theoreticalDeadline.getTime() < sessionEndsAt.getTime() ? theoreticalDeadline : sessionEndsAt;
}

/**
 * BR-03 & INV-03: Jawaban atau kumpul diterima bila sekarang <= deadline_at + 5 detik grace period.
 */
export function isWithinGracePeriod(
  currentTime: Date,
  deadlineAt: Date,
  graceSeconds: number = CONSTANTS.ANSWER_GRACE_SECONDS
): boolean {
  const maxAllowedMs = deadlineAt.getTime() + (graceSeconds * 1000);
  return currentTime.getTime() <= maxAllowedMs;
}

/**
 * BR-03: Cek apakah waktu saat ini berada di dalam jendela pengerjaan sesi.
 */
export function isWithinSessionWindow(currentTime: Date, startsAt: Date, endsAt: Date): boolean {
  return currentTime.getTime() >= startsAt.getTime() && currentTime.getTime() <= endsAt.getTime();
}

/**
 * BR-03: Mulai ujian diperbolehkan bila starts_at <= sekarang <= ends_at - durasi.
 */
export function isWithinSessionStartWindow(
  startsAt: Date,
  endsAt: Date,
  durationMinutes: number,
  currentTime: Date
): { allowed: boolean; reason?: 'NOT_STARTED' | 'SESSION_ENDING_SOON' } {
  const nowMs = currentTime.getTime();
  const startsMs = startsAt.getTime();
  const latestStartMs = endsAt.getTime() - (durationMinutes * 60 * 1000);

  if (nowMs < startsMs) {
    return { allowed: false, reason: 'NOT_STARTED' };
  }
  if (nowMs > latestStartMs) {
    return { allowed: false, reason: 'SESSION_ENDING_SOON' };
  }
  return { allowed: true };
}

export interface ClockDriftReport {
  nodeTime: string;
  dbTime: string;
  driftMs: number;
  isSynced: boolean;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  message: string;
}

/**
 * Memeriksa deviasi / drift waktu antara Node.js runtime dan PostgreSQL clock_timestamp().
 * Mengidentifikasi apakah server host mengalami masalah sinkronisasi NTP.
 */
export async function checkClockDrift(): Promise<ClockDriftReport> {
  const nodeBefore = Date.now();
  const dbTime = await getDatabaseTime();
  const nodeAfter = Date.now();
  const roundTripMs = nodeAfter - nodeBefore;
  const estimatedNodeTime = new Date(nodeBefore + Math.floor(roundTripMs / 2));
  const driftMs = Math.abs(estimatedNodeTime.getTime() - dbTime.getTime());

  let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  let message = 'Jam server Node.js dan PostgreSQL tersinkronisasi presisi.';

  if (driftMs > 3000) {
    status = 'CRITICAL';
    message = `Perbedaan jam database dan server sangat tinggi (${driftMs}ms). Segera jalankan sinkronisasi NTP (w32tm /resync).`;
  } else if (driftMs > 1000) {
    status = 'WARNING';
    message = `Terdeteksi deviasi waktu (${driftMs}ms). Pastikan layanan NTP Windows (W32Time) aktif.`;
  }

  return {
    nodeTime: estimatedNodeTime.toISOString(),
    dbTime: dbTime.toISOString(),
    driftMs,
    isSynced: driftMs <= 1000,
    status,
    message,
  };
}
