import { describe, it, expect } from 'vitest';
import {
  calculateDeadline,
  calculateAttemptDeadline,
  isWithinGracePeriod,
  isWithinSessionWindow,
  isWithinSessionStartWindow,
} from '../../src/lib/time.js';

describe('Zero-Trust Timer & Grace Period (INV-02, INV-03, BR-03)', () => {
  it('should calculate attempt deadline capped by session ends_at', () => {
    const startedAt = new Date('2026-10-15T08:00:00Z');
    const durationMinutes = 60; // 1 hour -> ends at 09:00:00

    // Kasus 1: Sesi selesai pukul 10:00 -> deadline adalah 09:00
    const sessionEndsAtLate = new Date('2026-10-15T10:00:00Z');
    const deadline1 = calculateAttemptDeadline(startedAt, durationMinutes, sessionEndsAtLate);
    expect(deadline1.toISOString()).toBe('2026-10-15T09:00:00.000Z');

    // Kasus 2: Peserta telat mulai, sesi selesai pukul 08:45 -> deadline dipotong menjadi 08:45
    const sessionEndsAtEarly = new Date('2026-10-15T08:45:00Z');
    const deadline2 = calculateAttemptDeadline(startedAt, durationMinutes, sessionEndsAtEarly);
    expect(deadline2.toISOString()).toBe('2026-10-15T08:45:00.000Z');
  });

  it('should enforce 5-second grace period strictly on submission (INV-03)', () => {
    const deadline = new Date('2026-10-15T09:00:00Z');

    // 1 detik sebelum deadline -> valid
    expect(isWithinGracePeriod(new Date('2026-10-15T08:59:59Z'), deadline, 5)).toBe(true);

    // Tepat pada deadline -> valid
    expect(isWithinGracePeriod(new Date('2026-10-15T09:00:00Z'), deadline, 5)).toBe(true);

    // +4 detik setelah deadline (masih dalam grace period) -> valid
    expect(isWithinGracePeriod(new Date('2026-10-15T09:00:04Z'), deadline, 5)).toBe(true);

    // +5 detik setelah deadline (batas akhir grace period) -> valid
    expect(isWithinGracePeriod(new Date('2026-10-15T09:00:05Z'), deadline, 5)).toBe(true);

    // +6 detik setelah deadline -> expired
    expect(isWithinGracePeriod(new Date('2026-10-15T09:00:06Z'), deadline, 5)).toBe(false);
  });

  it('should validate session start window', () => {
    const startsAt = new Date('2026-10-15T08:00:00Z');
    const endsAt = new Date('2026-10-15T10:00:00Z');
    const durationMinutes = 60; // latest start = 09:00

    // Sebelum sesi buka -> NOT_STARTED
    const early = isWithinSessionStartWindow(startsAt, endsAt, durationMinutes, new Date('2026-10-15T07:59:00Z'));
    expect(early.allowed).toBe(false);
    expect(early.reason).toBe('NOT_STARTED');

    // Saat sesi buka -> allowed
    const valid = isWithinSessionStartWindow(startsAt, endsAt, durationMinutes, new Date('2026-10-15T08:30:00Z'));
    expect(valid.allowed).toBe(true);

    // Terlalu mepet (setelah 09:00) -> SESSION_ENDING_SOON
    const late = isWithinSessionStartWindow(startsAt, endsAt, durationMinutes, new Date('2026-10-15T09:01:00Z'));
    expect(late.allowed).toBe(false);
    expect(late.reason).toBe('SESSION_ENDING_SOON');
  });
});
