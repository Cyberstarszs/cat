import { pool } from '../../db/connection.js';
import { AppError } from '../../lib/errors.js';
import { hashPassword, comparePassword } from '../../lib/hash.js';
import { logAudit } from '../audit/audit.service.js';
import { validateQuestionPoolSufficiency } from '../exams/exams.service.js';
import { CONSTANTS } from '../../config/constants.js';

export interface CreateSessionInput {
  exam_id: string;
  code: string;
  name: string;
  starts_at: string;
  ends_at: string;
  capacity?: number | null;
  access_code?: string | null;
  question_year?: number | null;
}

export async function createSession(data: CreateSessionInput, actorId: string, ipAddress?: string) {
  const cleanCode = data.code.trim().toUpperCase();
  const startsAt = new Date(data.starts_at);
  const endsAt = new Date(data.ends_at);

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new AppError('VALIDATION_FAILED', 'Waktu selesai harus lebih besar dari waktu mulai sesi.');
  }

  // Cek apakah exam ada
  const { rows: exams } = await pool.query('SELECT id, duration_minutes FROM exams WHERE id = $1;', [data.exam_id]);
  if (exams.length === 0) throw new AppError('NOT_FOUND');

  const exam = exams[0];
  const sessionDurationMinutes = (endsAt.getTime() - startsAt.getTime()) / (60 * 1000);
  if (sessionDurationMinutes < exam.duration_minutes) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Rentang waktu sesi (${sessionDurationMinutes} menit) kurang dari durasi ujian (${exam.duration_minutes} menit).`
    );
  }

  const dup = await pool.query('SELECT id FROM exam_sessions WHERE code = $1;', [cleanCode]);
  if (dup.rows.length > 0) {
    throw new AppError('VALIDATION_FAILED', `Kode sesi "${cleanCode}" sudah digunakan.`);
  }

  let accessCodeHash: string | null = null;
  if (data.access_code) {
    accessCodeHash = await hashPassword(data.access_code.trim());
  }

  const { rows } = await pool.query(
    `INSERT INTO exam_sessions (
      exam_id, code, name, starts_at, ends_at, capacity, access_code_hash, question_year, status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', $9)
    RETURNING *;`,
    [
      data.exam_id,
      cleanCode,
      data.name.trim(),
      startsAt.toISOString(),
      endsAt.toISOString(),
      data.capacity ? parseInt(String(data.capacity), 10) : 27,
      accessCodeHash,
      data.question_year ? parseInt(String(data.question_year), 10) : null,
      actorId,
    ]
  );

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'sessions.create',
    entityType: 'exam_sessions',
    entityId: rows[0].id,
    afterData: rows[0],
    ipAddress,
  });

  return rows[0];
}

export async function publishSession(sessionId: string, actorId: string, ipAddress?: string) {
  const { rows: sessions } = await pool.query(
    `SELECT s.*, e.question_count AS exam_question_count, e.duration_minutes
     FROM exam_sessions s
     JOIN exams e ON e.id = s.exam_id
     WHERE s.id = $1;`,
    [sessionId]
  );
  if (sessions.length === 0) throw new AppError('NOT_FOUND');

  const s = sessions[0];
  if (s.status !== 'draft') {
    throw new AppError('INVALID_TRANSITION', 'Hanya sesi berstatus draft yang dapat dipublikasikan.');
  }

  // 1. Validasi aturan komposisi soal
  const { rows: ruleSum } = await pool.query(
    `SELECT COALESCE(SUM(question_count), 0) AS total_rules
     FROM exam_question_rules
     WHERE exam_id = $1;`,
    [s.exam_id]
  );
  const totalRules = parseInt(ruleSum[0].total_rules, 10);
  if (totalRules !== s.exam_question_count) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Total jumlah soal pada aturan komposisi (${totalRules}) tidak sesuai dengan jumlah soal ujian (${s.exam_question_count}).`
    );
  }

  // 2. Validasi kecukupan bank soal (memperhitungkan tahun soal jika disetel pada sesi)
  await validateQuestionPoolSufficiency(s.exam_id, s.question_year);

  // 3. Update status to published
  const { rows } = await pool.query(
    `UPDATE exam_sessions SET status = 'published', updated_at = now() WHERE id = $1 RETURNING *;`,
    [sessionId]
  );

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'sessions.publish',
    entityType: 'exam_sessions',
    entityId: sessionId,
    ipAddress,
  });

  return rows[0];
}

export async function cancelSession(sessionId: string, actorId: string, ipAddress?: string) {
  // Cek apakah ada pengerjaan yang sedang berjalan
  const { rows: check } = await pool.query(
    `SELECT COUNT(*) AS active_attempts
     FROM session_enrollments se
     JOIN attempts a ON a.enrollment_id = se.id
     WHERE se.session_id = $1 AND a.status IN ('in_progress', 'submitted', 'auto_submitted');`,
    [sessionId]
  );

  if (parseInt(check[0].active_attempts, 10) > 0) {
    throw new AppError('SESSION_LOCKED', 'Sesi tidak dapat dibatalkan karena sudah memiliki pengerjaan aktif/selesai.');
  }

  const { rows } = await pool.query(
    `UPDATE exam_sessions SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING *;`,
    [sessionId]
  );
  if (rows.length === 0) throw new AppError('NOT_FOUND');

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'sessions.cancel',
    entityType: 'exam_sessions',
    entityId: sessionId,
    ipAddress,
  });

  return rows[0];
}

export async function setSessionAccessCode(sessionId: string, accessCode: string | null, actorId: string, ipAddress?: string) {
  let accessCodeHash: string | null = null;
  if (accessCode) {
    accessCodeHash = await hashPassword(accessCode.trim());
  }

  const { rows } = await pool.query(
    `UPDATE exam_sessions SET access_code_hash = $1, updated_at = now() WHERE id = $2 RETURNING id, code, name;`,
    [accessCodeHash, sessionId]
  );
  if (rows.length === 0) throw new AppError('NOT_FOUND');

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'sessions.access_code',
    entityType: 'exam_sessions',
    entityId: sessionId,
    reason: accessCode ? 'Set access code' : 'Cleared access code',
    ipAddress,
  });

  return { success: true };
}

export async function enrollStudents(
  sessionId: string,
  studentIdentifiers: string[],
  adminActorId: string,
  ipAddress?: string
): Promise<{
  enrolled: number;
  skipped: Array<{ identifier: string; reason: string }>;
}> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    // 1. Lock session row (anti-collision)
    const { rows: sessionRows } = await client.query(
      `SELECT s.*, e.id AS exam_id, e.max_attempts_per_student, e.passing_score
       FROM exam_sessions s
       JOIN exams e ON e.id = s.exam_id
       WHERE s.id = $1 FOR UPDATE;`,
      [sessionId]
    );

    if (sessionRows.length === 0) throw new AppError('NOT_FOUND');
    const s = sessionRows[0];

    if (s.status === 'cancelled') {
      throw new AppError('INVALID_TRANSITION', 'Tidak dapat mendaftarkan peserta ke sesi yang dibatalkan.');
    }

    // Get current enrollment count
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) AS total FROM session_enrollments WHERE session_id = $1;`,
      [sessionId]
    );
    let currentEnrolled = parseInt(countRows[0].total, 10);

    const skipped: Array<{ identifier: string; reason: string }> = [];
    let enrolledCount = 0;

    for (const ident of studentIdentifiers) {
      const cleanIdent = ident.trim();
      if (!cleanIdent) continue;

      // Check capacity (Default max 27 per lab session)
      const maxCapacity = s.capacity ?? 27;
      if (currentEnrolled >= maxCapacity) {
        skipped.push({ identifier: cleanIdent, reason: `Kapasitas sesi penuh (maksimal ${maxCapacity} peserta)` });
        continue;
      }

      // Find student user
      const { rows: studentRows } = await client.query(
        `SELECT u.id, u.status, sp.identifier, sp.full_name
         FROM student_profiles sp
         JOIN users u ON u.id = sp.user_id
         WHERE sp.identifier = $1 AND u.deleted_at IS NULL;`,
        [cleanIdent]
      );

      if (studentRows.length === 0) {
        skipped.push({ identifier: cleanIdent, reason: 'Peserta tidak ditemukan' });
        continue;
      }

      const st = studentRows[0];
      if (st.status === 'suspended') {
        skipped.push({ identifier: cleanIdent, reason: 'Akun peserta dinonaktifkan' });
        continue;
      }

      // Check ALREADY_ENROLLED
      const { rows: enrolledCheck } = await client.query(
        `SELECT id FROM session_enrollments WHERE session_id = $1 AND student_id = $2;`,
        [sessionId, st.id]
      );
      if (enrolledCheck.length > 0) {
        skipped.push({ identifier: cleanIdent, reason: 'Sudah terdaftar di sesi ini' });
        continue;
      }

      // Check SCHEDULE_OVERLAP (INV-09, TC-09)
      const { rows: overlapCheck } = await client.query(
        `SELECT s2.name, s2.starts_at, s2.ends_at
         FROM session_enrollments se2
         JOIN exam_sessions s2 ON s2.id = se2.session_id
         WHERE se2.student_id = $1
           AND s2.status <> 'cancelled'
           AND s2.id <> $2
           AND (s2.starts_at < $3 AND s2.ends_at > $4);`,
        [st.id, sessionId, s.ends_at, s.starts_at]
      );
      if (overlapCheck.length > 0) {
        skipped.push({ identifier: cleanIdent, reason: `Jadwal tumpang tindih dengan sesi "${overlapCheck[0].name}"` });
        continue;
      }

      // Check ALREADY_PASSED (TC-41)
      const { rows: passedCheck } = await client.query(
        `SELECT r.id FROM results r
         JOIN attempts a ON a.id = r.attempt_id
         JOIN session_enrollments se ON se.id = a.enrollment_id
         JOIN exam_sessions es ON es.id = se.session_id
         WHERE se.student_id = $1 AND es.exam_id = $2 AND r.passed = true AND r.status = 'published';`,
        [st.id, s.exam_id]
      );
      if (passedCheck.length > 0) {
        skipped.push({ identifier: cleanIdent, reason: 'Peserta sudah lulus ujian ini' });
        continue;
      }

      // Check QUOTA_EXCEEDED
      const { rows: attemptsCount } = await client.query(
        `SELECT COUNT(*) AS total FROM attempts a
         JOIN session_enrollments se ON se.id = a.enrollment_id
         JOIN exam_sessions es ON es.id = se.session_id
         WHERE se.student_id = $1 AND es.exam_id = $2 AND a.status <> 'void';`,
        [st.id, s.exam_id]
      );
      if (parseInt(attemptsCount[0].total, 10) >= s.max_attempts_per_student) {
        skipped.push({ identifier: cleanIdent, reason: 'Batas kesempatan percobaan ujian sudah habis' });
        continue;
      }

      // Check PREVIOUS_RESULT_PENDING (TC-44)
      const { rows: pendingResult } = await client.query(
        `SELECT r.id FROM results r
         JOIN attempts a ON a.id = r.attempt_id
         JOIN session_enrollments se ON se.id = a.enrollment_id
         JOIN exam_sessions es ON es.id = se.session_id
         WHERE se.student_id = $1 AND es.exam_id = $2 AND r.status = 'pending_publication';`,
        [st.id, s.exam_id]
      );
      if (pendingResult.length > 0) {
        skipped.push({ identifier: cleanIdent, reason: 'Hasil percobaan sebelumnya belum dipublikasikan' });
        continue;
      }

      // Insert enrollment
      await client.query(
        `INSERT INTO session_enrollments (session_id, student_id, registered_by)
         VALUES ($1, $2, $3);`,
        [sessionId, st.id, adminActorId]
      );

      currentEnrolled++;
      enrolledCount++;
    }

    await logAudit(
      {
        actorId: adminActorId,
        actorRole: 'admin',
        action: 'sessions.enroll_students',
        entityType: 'exam_sessions',
        entityId: sessionId,
        afterData: { enrolled_count: enrolledCount, skipped_count: skipped.length },
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');

    return {
      enrolled: enrolledCount,
      skipped,
    };
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

export async function extendAllAttempts(
  sessionId: string,
  extraMinutes: number,
  adminActorId: string,
  ipAddress?: string
) {
  if (extraMinutes <= 0 || extraMinutes > CONSTANTS.MAX_EXTEND_PER_ACTION_MINUTES) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Penambahan waktu harus antara 1 sampai ${CONSTANTS.MAX_EXTEND_PER_ACTION_MINUTES} menit.`
    );
  }

  const extraSeconds = extraMinutes * 60;

  const { rows: updated } = await pool.query(
    `UPDATE attempts
     SET deadline_at = deadline_at + ($1 || ' seconds')::interval,
         extra_seconds = extra_seconds + $1,
         extension_reason = COALESCE(extension_reason || '; ', '') || 'Mass extension of ' || $2 || ' mins'
     WHERE enrollment_id IN (SELECT id FROM session_enrollments WHERE session_id = $3)
       AND status = 'in_progress'
     RETURNING id, deadline_at, extra_seconds;`,
    [extraSeconds, extraMinutes, sessionId]
  );

  await logAudit({
    actorId: adminActorId,
    actorRole: 'admin',
    action: 'sessions.extend_all',
    entityType: 'exam_sessions',
    entityId: sessionId,
    reason: `Added ${extraMinutes} mins to all ${updated.length} active attempts`,
    ipAddress,
  });

  return {
    extended_attempts_count: updated.length,
    extra_minutes: extraMinutes,
  };
}

export async function publishSessionResults(
  sessionId: string,
  adminActorId: string,
  ipAddress?: string,
  forceFinalize = false
) {
  // 1. Verifikasi sesi
  const { rows: sRows } = await pool.query(
    `SELECT s.*, e.passing_score FROM exam_sessions s JOIN exams e ON e.id = s.exam_id WHERE s.id = $1;`,
    [sessionId]
  );
  if (sRows.length === 0) throw new AppError('NOT_FOUND');
  const session = sRows[0];

  // 2. Cek apakah ada yang masih in_progress
  const { rows: activeAttempts } = await pool.query(
    `SELECT a.id, a.deadline_at
     FROM attempts a
     JOIN session_enrollments se ON se.id = a.enrollment_id
     WHERE se.session_id = $1 AND a.status = 'in_progress';`,
    [sessionId]
  );

  const { rows: timeRows } = await pool.query("SELECT clock_timestamp() AS db_now;");
  const serverNow = new Date(timeRows[0].db_now);
  const sessionEndsAt = new Date(session.ends_at);

  if (activeAttempts.length > 0) {
    if (!forceFinalize && serverNow.getTime() < sessionEndsAt.getTime() + CONSTANTS.ANSWER_GRACE_SECONDS * 1000) {
      throw new AppError(
        'SESSION_NOT_FINISHED',
        `Sesi belum selesai. Masih terdapat ${activeAttempts.length} peserta yang sedang mengerjakan ujian.`
      );
    }

    // Auto-submit seluruh attempt yang masih in_progress
    const { submitExamAttempt } = await import('../attempts/attempts.service.js');
    for (const att of activeAttempts) {
      await submitExamAttempt(att.id, forceFinalize ? 'forced' : 'timeout', undefined, ipAddress);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    // 3. Update status results menjadi published
    const { rows: publishedResults } = await client.query(
      `UPDATE results
       SET status = 'published',
           published_at = now(),
           published_by = $1
       WHERE attempt_id IN (
         SELECT a.id FROM attempts a
         JOIN session_enrollments se ON se.id = a.enrollment_id
         WHERE se.session_id = $2 AND a.status <> 'void'
       ) AND status = 'pending_publication'
       RETURNING id, passed, score;`,
      [adminActorId, sessionId]
    );

    // 4. Terbitkan sertifikat untuk hasil yang LULUS (passed = true)
    const { issueCertificateForResult } = await import('../certificates/certificates.service.js');
    let certCount = 0;
    for (const res of publishedResults) {
      if (res.passed) {
        await issueCertificateForResult(res.id, adminActorId, client);
        certCount++;
      }
    }

    await logAudit(
      {
        actorId: adminActorId,
        actorRole: 'admin',
        action: 'sessions.publish_results',
        entityType: 'exam_sessions',
        entityId: sessionId,
        afterData: {
          total_published: publishedResults.length,
          certificates_issued: certCount,
        },
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');

    return {
      published_count: publishedResults.length,
      certificates_issued: certCount,
    };
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

export async function finalizeSession(
  sessionId: string,
  adminActorId: string,
  ipAddress?: string
) {
  // 1. Verifikasi sesi
  const { rows: sRows } = await pool.query(
    `SELECT s.* FROM exam_sessions s WHERE s.id = $1;`,
    [sessionId]
  );
  if (sRows.length === 0) throw new AppError('NOT_FOUND', 'Sesi ujian tidak ditemukan.');
  const session = sRows[0];

  if (session.status === 'cancelled') {
    throw new AppError('VALIDATION_FAILED', 'Sesi yang telah dibatalkan tidak dapat difinalisasi.');
  }

  // 2. Submit paksa seluruh attempt in_progress & terbitkan hasil (forceFinalize = true)
  const pubResult = await publishSessionResults(sessionId, adminActorId, ipAddress, true);

  // 3. Majukan ends_at ke waktu sekarang (dan sesuaikan starts_at jika belum mulai agar tidak melanggar chk_sessions_time)
  await pool.query(
    `UPDATE exam_sessions
     SET starts_at = CASE 
                       WHEN starts_at >= now() THEN now() - interval '1 second' 
                       ELSE starts_at 
                     END,
         ends_at = CASE 
                     WHEN starts_at >= now() THEN now() 
                     ELSE LEAST(ends_at, now()) 
                   END,
         status = 'published',
         updated_at = now()
     WHERE id = $1;`,
    [sessionId]
  );

  // 4. Catat audit log
  await logAudit({
    actorId: adminActorId,
    actorRole: 'admin',
    action: 'sessions.finalize',
    entityType: 'exam_sessions',
    entityId: sessionId,
    afterData: {
      ...pubResult,
    },
    ipAddress,
  });

  return {
    success: true,
    message: 'Sesi berhasil difinalisasi dan seluruh attempt telah dinilai.',
    ...pubResult,
  };
}

export async function regradeSession(
  sessionId: string,
  commit: boolean,
  adminActorId: string,
  ipAddress?: string
) {
  const { evaluateScore, calculateQuestionPoints } = await import('../../lib/grading.js');
  const { issueCertificateForResult, revokeCertificate } = await import('../certificates/certificates.service.js');

  const client = await pool.connect();
  try {
    if (commit) await client.query('BEGIN;');

    // Ambil data ujian & passing score
    const { rows: sessionInfo } = await client.query(
      `SELECT s.id, e.id AS exam_id, e.passing_score
       FROM exam_sessions s
       JOIN exams e ON e.id = s.exam_id
       WHERE s.id = $1;`,
      [sessionId]
    );
    if (sessionInfo.length === 0) throw new AppError('NOT_FOUND');
    const passingScore = parseFloat(sessionInfo[0].passing_score);

    // Ambil seluruh attempt yang memiliki result
    const { rows: attempts } = await client.query(
      `SELECT 
        a.id AS attempt_id, a.status,
        r.id AS result_id, r.raw_score AS old_raw_score, r.score AS old_score, r.passed AS old_passed, r.revision_no,
        sp.identifier, sp.full_name,
        c.id AS certificate_id, c.status AS cert_status
       FROM attempts a
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN student_profiles sp ON sp.user_id = se.student_id
       JOIN results r ON r.attempt_id = a.id
       LEFT JOIN certificates c ON c.result_id = r.id AND c.status = 'valid'
       WHERE se.session_id = $1 AND a.status <> 'void';`,
      [sessionId]
    );

    const changes = [];

    for (const att of attempts) {
      // Ambil soal dan jawaban attempt
      const { rows: questions } = await client.query(
        `SELECT 
          aq.id AS attempt_question_id,
          qv.id AS question_version_id,
          qv.weight,
          qo_correct.id AS correct_option_id,
          ans.selected_option_id
         FROM attempt_questions aq
         JOIN question_versions qv ON qv.id = aq.question_version_id
         JOIN question_options qo_correct ON qo_correct.question_version_id = qv.id AND qo_correct.is_correct = true
         LEFT JOIN attempt_answers ans ON ans.attempt_question_id = aq.id
         WHERE aq.attempt_id = $1;`,
        [att.attempt_id]
      );

      // Ambil koreksi soal
      const qvIds = questions.map((q) => q.question_version_id);
      const { rows: corrections } = await client.query(
        `SELECT question_version_id, type, old_option_id, new_option_id
         FROM question_corrections
         WHERE question_version_id = ANY($1::uuid[]);`,
        [qvIds]
      );

      const correctionsMap = new Map();
      for (const c of corrections) {
        const list = correctionsMap.get(c.question_version_id) || [];
        list.push(c);
        correctionsMap.set(c.question_version_id, list);
      }

      const gradingItems = [];
      for (const q of questions) {
        const qRules = correctionsMap.get(q.question_version_id) || [];
        const itemScore = calculateQuestionPoints(
          q.selected_option_id,
          q.correct_option_id,
          parseFloat(q.weight),
          qRules
        );

        if (commit) {
          await client.query(
            `UPDATE attempt_answers
             SET points_awarded = $1, is_correct = $2
             WHERE attempt_question_id = $3;`,
            [itemScore.pointsAwarded, itemScore.isCorrect, q.attempt_question_id]
          );
        }

        gradingItems.push(itemScore);
      }

      const evaluated = evaluateScore(gradingItems, passingScore);
      const scoreChanged = evaluated.score !== parseFloat(att.old_score);
      const passChanged = evaluated.passed !== att.old_passed;

      changes.push({
        attempt_id: att.attempt_id,
        identifier: att.identifier,
        name: att.full_name,
        old_score: parseFloat(att.old_score),
        new_score: evaluated.score,
        old_passed: att.old_passed,
        new_passed: evaluated.passed,
        score_diff: parseFloat((evaluated.score - parseFloat(att.old_score)).toFixed(2)),
        status_changed: passChanged,
      });

      if (commit && (scoreChanged || passChanged)) {
        await client.query(
          `UPDATE results
           SET raw_score = $1,
               max_score = $2,
               score = $3,
               passed = $4,
               revision_no = revision_no + 1,
               graded_at = now()
           WHERE id = $5;`,
          [evaluated.rawScore, evaluated.maxScore, evaluated.score, evaluated.passed, att.result_id]
        );

        // Jika sebelumnya lulus lalu jadi tidak lulus -> cabut sertifikat
        if (att.old_passed && !evaluated.passed && att.certificate_id) {
          await revokeCertificate(
            att.certificate_id,
            'Nilai berubah setelah koreksi kunci jawaban (regrade)',
            'regrade',
            adminActorId,
            client
          );
        }

        // Jika sebelumnya tidak lulus lalu jadi lulus -> terbitkan sertifikat baru
        if (!att.old_passed && evaluated.passed) {
          await issueCertificateForResult(att.result_id, adminActorId, client);
        }
      }
    }

    if (commit) {
      await logAudit(
        {
          actorId: adminActorId,
          actorRole: 'admin',
          action: 'sessions.regrade_commit',
          entityType: 'exam_sessions',
          entityId: sessionId,
          reason: `Regraded ${changes.length} attempts`,
          afterData: { total_regraded: changes.length },
          ipAddress,
        },
        client
      );
      await client.query('COMMIT;');
    }

    return {
      committed: commit,
      total_attempts: attempts.length,
      affected_count: changes.filter((c) => c.score_diff !== 0).length,
      status_changed_count: changes.filter((c) => c.status_changed).length,
      diffs: changes,
    };
  } catch (err) {
    if (commit) await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

export async function previewEnrollStudents(
  sessionId: string,
  studentIdentifiers: string[]
): Promise<{
  total_submitted: number;
  valid_to_enroll: number;
  skipped_count: number;
  valid_students: Array<{ identifier: string; full_name: string }>;
  skipped_students: Array<{ identifier: string; reason: string }>;
}> {
  const { rows: sessionRows } = await pool.query(
    `SELECT s.*, e.id AS exam_id, e.max_attempts_per_student
     FROM exam_sessions s
     JOIN exams e ON e.id = s.exam_id
     WHERE s.id = $1;`,
    [sessionId]
  );
  if (sessionRows.length === 0) throw new AppError('NOT_FOUND');
  const s = sessionRows[0];

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM session_enrollments WHERE session_id = $1;`,
    [sessionId]
  );
  let simulatedEnrolled = parseInt(countRows[0].total, 10);

  const validStudents: Array<{ identifier: string; full_name: string }> = [];
  const skippedStudents: Array<{ identifier: string; reason: string }> = [];

  for (const ident of studentIdentifiers) {
    const cleanIdent = ident.trim();
    if (!cleanIdent) continue;

    const maxCapacity = s.capacity ?? 27;
    if (simulatedEnrolled >= maxCapacity) {
      skippedStudents.push({ identifier: cleanIdent, reason: `Kapasitas sesi penuh (maksimal ${maxCapacity} peserta)` });
      continue;
    }

    const { rows: studentRows } = await pool.query(
      `SELECT u.id, u.status, sp.identifier, sp.full_name
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.identifier = $1 AND u.deleted_at IS NULL;`,
      [cleanIdent]
    );

    if (studentRows.length === 0) {
      skippedStudents.push({ identifier: cleanIdent, reason: 'Peserta tidak ditemukan' });
      continue;
    }

    const st = studentRows[0];
    if (st.status === 'suspended') {
      skippedStudents.push({ identifier: cleanIdent, reason: 'Akun peserta dinonaktifkan' });
      continue;
    }

    const { rows: enrolledCheck } = await pool.query(
      `SELECT id FROM session_enrollments WHERE session_id = $1 AND student_id = $2;`,
      [sessionId, st.id]
    );
    if (enrolledCheck.length > 0) {
      skippedStudents.push({ identifier: cleanIdent, reason: 'Sudah terdaftar di sesi ini' });
      continue;
    }

    const { rows: overlapCheck } = await pool.query(
      `SELECT s2.name
       FROM session_enrollments se2
       JOIN exam_sessions s2 ON s2.id = se2.session_id
       WHERE se2.student_id = $1
         AND s2.status <> 'cancelled'
         AND s2.id <> $2
         AND (s2.starts_at < $3 AND s2.ends_at > $4);`,
      [st.id, sessionId, s.ends_at, s.starts_at]
    );
    if (overlapCheck.length > 0) {
      skippedStudents.push({ identifier: cleanIdent, reason: `Jadwal tumpang tindih dengan sesi "${overlapCheck[0].name}"` });
      continue;
    }

    const { rows: passedCheck } = await pool.query(
      `SELECT r.id FROM results r
       JOIN attempts a ON a.id = r.attempt_id
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN exam_sessions es ON es.id = se.session_id
       WHERE se.student_id = $1 AND es.exam_id = $2 AND r.passed = true AND r.status = 'published';`,
      [st.id, s.exam_id]
    );
    if (passedCheck.length > 0) {
      skippedStudents.push({ identifier: cleanIdent, reason: 'Peserta sudah lulus ujian ini' });
      continue;
    }

    const { rows: attemptsCount } = await pool.query(
      `SELECT COUNT(*) AS total FROM attempts a
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN exam_sessions es ON es.id = se.session_id
       WHERE se.student_id = $1 AND es.exam_id = $2 AND a.status <> 'void';`,
      [st.id, s.exam_id]
    );
    if (parseInt(attemptsCount[0].total, 10) >= s.max_attempts_per_student) {
      skippedStudents.push({ identifier: cleanIdent, reason: 'Batas kesempatan percobaan ujian sudah habis' });
      continue;
    }

    const { rows: pendingResult } = await pool.query(
      `SELECT r.id FROM results r
       JOIN attempts a ON a.id = r.attempt_id
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN exam_sessions es ON es.id = se.session_id
       WHERE se.student_id = $1 AND es.exam_id = $2 AND r.status = 'pending_publication';`,
      [st.id, s.exam_id]
    );
    if (pendingResult.length > 0) {
      skippedStudents.push({ identifier: cleanIdent, reason: 'Hasil percobaan sebelumnya belum dipublikasikan' });
      continue;
    }

    simulatedEnrolled++;
    validStudents.push({ identifier: st.identifier, full_name: st.full_name });
  }

  return {
    total_submitted: studentIdentifiers.length,
    valid_to_enroll: validStudents.length,
    skipped_count: skippedStudents.length,
    valid_students: validStudents,
    skipped_students: skippedStudents,
  };
}

export interface CandidateStudent {
  identifier: string;
  full_name: string;
  institution: string | null;
  role?: string;
  email: string;
  status:
    | 'available'
    | 'already_enrolled'
    | 'enrolled_other_session'
    | 'schedule_overlap'
    | 'already_passed'
    | 'quota_exceeded'
    | 'suspended';
  status_reason: string;
  is_eligible: boolean;
  other_session_name?: string | null;
}

export interface CandidateResponse {
  session: {
    id: string;
    name: string;
    code: string;
    starts_at: string;
    ends_at: string;
    capacity: number;
    current_enrolled: number;
    remaining_slots: number;
  };
  candidates: CandidateStudent[];
  stats: {
    total_students: number;
    available_count: number;
    enrolled_this_session: number;
    enrolled_other_session: number;
    ineligible_count: number;
  };
}

export async function getCandidateStudents(sessionId: string): Promise<CandidateResponse> {
  const { rows: sessionRows } = await pool.query(
    `SELECT s.*, e.id AS exam_id, e.title AS exam_title, e.max_attempts_per_student
     FROM exam_sessions s
     JOIN exams e ON e.id = s.exam_id
     WHERE s.id = $1;`,
    [sessionId]
  );
  if (sessionRows.length === 0) throw new AppError('NOT_FOUND', 'Sesi ujian tidak ditemukan');
  const s = sessionRows[0];

  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*) AS total FROM session_enrollments WHERE session_id = $1;',
    [sessionId]
  );
  const current_enrolled = parseInt(countRows[0].total, 10);
  const capacity = s.capacity ?? 27;
  const remaining_slots = Math.max(0, capacity - current_enrolled);

  const query = `
    SELECT 
      sp.identifier,
      sp.full_name,
      sp.institution,
      u.id AS user_id,
      u.role AS user_role,
      u.email,
      u.status AS user_status,
      EXISTS(
        SELECT 1 FROM session_enrollments se 
        WHERE se.session_id = $1 AND se.student_id = u.id
      ) AS is_enrolled_here,
      (
        SELECT es2.name FROM session_enrollments se2
        JOIN exam_sessions es2 ON es2.id = se2.session_id
        WHERE se2.student_id = u.id AND es2.exam_id = $2 AND es2.id <> $1 AND es2.status <> 'cancelled'
        ORDER BY es2.starts_at ASC
        LIMIT 1
      ) AS other_session_name,
      (
        SELECT es3.name FROM session_enrollments se3
        JOIN exam_sessions es3 ON es3.id = se3.session_id
        WHERE se3.student_id = u.id 
          AND es3.id <> $1 
          AND es3.status <> 'cancelled'
          AND (es3.starts_at < $4 AND es3.ends_at > $3)
        LIMIT 1
      ) AS overlap_session_name,
      EXISTS(
        SELECT 1 FROM results r
        JOIN attempts a ON a.id = r.attempt_id
        JOIN session_enrollments se4 ON se4.id = a.enrollment_id
        JOIN exam_sessions es4 ON es4.id = se4.session_id
        WHERE se4.student_id = u.id AND es4.exam_id = $2 AND r.passed = true AND r.status = 'published'
      ) AS has_passed,
      (
        SELECT COUNT(*) FROM attempts a
        JOIN session_enrollments se5 ON se5.id = a.enrollment_id
        JOIN exam_sessions es5 ON es5.id = se5.session_id
        WHERE se5.student_id = u.id AND es5.exam_id = $2 AND a.status <> 'void'
      ) AS attempts_used
    FROM student_profiles sp
    JOIN users u ON u.id = sp.user_id
    WHERE u.deleted_at IS NULL AND u.role IN ('student', 'mahasiswa', 'umum')
    ORDER BY sp.identifier ASC;
  `;

  const { rows } = await pool.query(query, [s.id, s.exam_id, s.starts_at, s.ends_at]);

  let available_count = 0;
  let enrolled_this_session = 0;
  let enrolled_other_session = 0;
  let ineligible_count = 0;

  const candidates: CandidateStudent[] = rows.map((row) => {
    let status: CandidateStudent['status'] = 'available';
    let status_reason = 'Siap dialokasikan';
    let is_eligible = true;

    if (row.is_enrolled_here) {
      status = 'already_enrolled';
      status_reason = 'Sudah terdaftar di sesi ini';
      is_eligible = false;
      enrolled_this_session++;
    } else if (row.user_status === 'suspended') {
      status = 'suspended';
      status_reason = 'Akun peserta dinonaktifkan';
      is_eligible = false;
      ineligible_count++;
    } else if (row.has_passed) {
      status = 'already_passed';
      status_reason = 'Sudah lulus ujian ini';
      is_eligible = false;
      ineligible_count++;
    } else if (parseInt(row.attempts_used || '0', 10) >= (s.max_attempts_per_student || 1)) {
      status = 'quota_exceeded';
      status_reason = 'Batas kesempatan ujian habis';
      is_eligible = false;
      ineligible_count++;
    } else if (row.overlap_session_name) {
      status = 'schedule_overlap';
      status_reason = `Jadwal bentrok dengan sesi "${row.overlap_session_name}"`;
      is_eligible = false;
      ineligible_count++;
    } else if (row.other_session_name) {
      status = 'enrolled_other_session';
      status_reason = `Sudah terjadwal di sesi "${row.other_session_name}"`;
      is_eligible = false;
      enrolled_other_session++;
    } else {
      available_count++;
    }

    return {
      identifier: row.identifier,
      full_name: row.full_name,
      institution: row.institution || null,
      role: row.user_role || 'mahasiswa',
      email: row.email,
      status,
      status_reason,
      is_eligible,
      other_session_name: row.other_session_name || null,
    };
  });

  return {
    session: {
      id: s.id,
      name: s.name,
      code: s.code,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      capacity,
      current_enrolled,
      remaining_slots,
    },
    candidates,
    stats: {
      total_students: candidates.length,
      available_count,
      enrolled_this_session,
      enrolled_other_session,
      ineligible_count,
    },
  };
}



