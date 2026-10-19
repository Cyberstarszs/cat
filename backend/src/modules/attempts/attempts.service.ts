import { pool } from '../../db/connection.js';
import { AppError } from '../../lib/errors.js';
import { calculateAttemptDeadline, isWithinSessionWindow, isWithinGracePeriod } from '../../lib/time.js';
import { evaluateScore, calculateQuestionPoints, CorrectionRule } from '../../lib/grading.js';
import { comparePassword } from '../../lib/hash.js';
import { logAudit } from '../audit/audit.service.js';
import { CONSTANTS } from '../../config/constants.js';

export async function startExamAttempt(
  sessionId: string,
  studentUserId: string,
  accessCodeInput?: string,
  ipAddress?: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    // 1. Dapatkan database time saat ini (INV-02)
    const { rows: timeRows } = await client.query('SELECT clock_timestamp() AS db_now;');
    const serverNow = new Date(timeRows[0].db_now);

    // 2. Kunci sesi & pendaftaran
    const { rows: sessionRows } = await client.query(
      `SELECT s.*, e.id AS exam_id, e.title AS exam_title, e.duration_minutes,
              e.question_count, e.shuffle_questions, e.shuffle_options,
              e.passing_score, e.max_attempts_per_student,
              se.id AS enrollment_id, se.status AS enrollment_status
       FROM exam_sessions s
       JOIN exams e ON e.id = s.exam_id
       JOIN session_enrollments se ON se.session_id = s.id AND se.student_id = $1
       WHERE s.id = $2
       FOR UPDATE;`,
      [studentUserId, sessionId]
    );

    if (sessionRows.length === 0) {
      throw new AppError('NOT_FOUND', 'Anda tidak terdaftar dalam sesi ujian ini.');
    }

    const s = sessionRows[0];

    // Cek apakah sesi aktif
    if (s.status === 'cancelled') {
      throw new AppError('SESSION_NOT_OPEN', 'Sesi ujian telah dibatalkan.');
    }
    if (s.status === 'draft') {
      await client.query(`UPDATE exam_sessions SET status = 'published', updated_at = now() WHERE id = $1;`, [sessionId]);
      s.status = 'published';
    }

    // Cek jadwal jendela mulai (BR-03)
    const startsAt = new Date(s.starts_at);
    const endsAt = new Date(s.ends_at);
    if (!isWithinSessionWindow(serverNow, startsAt, endsAt)) {
      throw new AppError('SESSION_NOT_OPEN', 'Sesi ujian belum dibuka atau sudah berakhir.');
    }

    // Cek SESSION_ENDING_SOON: jika sisa waktu sesi kurang dari durasi ujian
    const remainingSessionSeconds = Math.floor((endsAt.getTime() - serverNow.getTime()) / 1000);
    const requiredSeconds = s.duration_minutes * 60;
    if (remainingSessionSeconds < requiredSeconds) {
      // Menurut SRS, jika terlambat, sisa waktu disesuaikan atau jika terlalu mepet (SESSION_ENDING_SOON)
      if (remainingSessionSeconds <= 5 * 60) {
        throw new AppError(
          'SESSION_ENDING_SOON',
          'Sisa waktu sesi kurang dari 5 menit. Anda tidak dapat memulai ujian.'
        );
      }
    }

    // Cek access_code_hash jika sesi memiliki kode akses
    if (s.access_code_hash) {
      if (!accessCodeInput) {
        throw new AppError('ACCESS_CODE_INVALID', 'Kode akses sesi wajib diisi.');
      }
      const isCodeValid = await comparePassword(accessCodeInput.trim(), s.access_code_hash);
      if (!isCodeValid) {
        throw new AppError('ACCESS_CODE_INVALID', 'Kode akses sesi yang Anda masukkan salah.');
      }
    }

    // Cek apakah sudah ada attempt non-void (INV-01)
    const { rows: existingAttempt } = await client.query(
      `SELECT id, status, deadline_at FROM attempts WHERE enrollment_id = $1 AND status <> 'void';`,
      [s.enrollment_id]
    );

    if (existingAttempt.length > 0) {
      const att = existingAttempt[0];
      if (att.status === 'in_progress') {
        // Return existing attempt resume
        await client.query('COMMIT;');
        return {
          attempt_id: att.id,
          resumed: true,
          deadline_at: att.deadline_at,
        };
      }
      throw new AppError('QUOTA_EXCEEDED', 'Anda telah menyelesaikan percobaan ujian pada sesi ini.');
    }

    // Hitung nomor percobaan (attempt_no)
    const { rows: countAttempts } = await client.query(
      `SELECT COALESCE(MAX(attempt_no), 0) AS max_no FROM attempts WHERE enrollment_id = $1;`,
      [s.enrollment_id]
    );
    const nextAttemptNo = parseInt(countAttempts[0].max_no, 10) + 1;

    // Hitung deadline (INV-03)
    const deadlineAt = calculateAttemptDeadline(serverNow, s.duration_minutes, endsAt);

    // Buat attempt baru
    const { rows: newAttemptRows } = await client.query(
      `INSERT INTO attempts (enrollment_id, attempt_no, status, started_at, deadline_at)
       VALUES ($1, $2, 'in_progress', $3, $4)
       RETURNING id, started_at, deadline_at;`,
      [s.enrollment_id, nextAttemptNo, serverNow.toISOString(), deadlineAt.toISOString()]
    );
    const attemptId = newAttemptRows[0].id;

    // Update session_enrollments status = 'attended'
    await client.query(`UPDATE session_enrollments SET status = 'attended' WHERE id = $1;`, [s.enrollment_id]);

    // Snapshot soal dari aturan komposisi (INV-04)
    const { rows: rules } = await client.query(
      `SELECT category_id, difficulty, question_count FROM exam_question_rules WHERE exam_id = $1;`,
      [s.exam_id]
    );

    const selectedQuestionVersions: Array<{ questionVersionId: string }> = [];

    if (rules.length > 0) {
      for (const rule of rules) {
        const alreadySelected = selectedQuestionVersions.map((q) => q.questionVersionId);
        const diffCond = rule.difficulty ? `AND qv.difficulty = ${rule.difficulty}` : '';
        const yearCond = s.question_year ? `AND q.year = ${parseInt(s.question_year, 10)}` : '';
        const excludeCond = alreadySelected.length > 0 ? `AND qv.id <> ALL($3::uuid[])` : '';
        const sampleQuery = `
          SELECT qv.id AS question_version_id
          FROM questions q
          JOIN question_versions qv ON qv.id = q.current_version_id
          WHERE q.category_id = $1 
            AND q.status = 'active'
            AND q.deleted_at IS NULL
            ${diffCond}
            ${yearCond}
            ${excludeCond}
          ORDER BY RANDOM()
          LIMIT $2;
        `;
        const queryParams: any[] = [rule.category_id, rule.question_count];
        if (alreadySelected.length > 0) {
          queryParams.push(alreadySelected);
        }
        const { rows: sampled } = await client.query(sampleQuery, queryParams);

        if (sampled.length < rule.question_count) {
          const yearMsg = s.question_year ? ` untuk tahun ${s.question_year}` : '';
          throw new AppError(
            'QUESTION_POOL_INSUFFICIENT',
            `Stok bank soal aktif${yearMsg} tidak mencukupi untuk komposisi ujian saat ini.`
          );
        }

        for (const q of sampled) {
          selectedQuestionVersions.push({ questionVersionId: q.question_version_id });
        }
      }
    } else {
      // Fallback jika belum ada aturan komposisi subtes: ambil soal aktif sesuai tahun sesi
      const yearCond = s.question_year ? `AND q.year = ${parseInt(s.question_year, 10)}` : '';
      const limitCount = s.question_count || 100;
      const { rows: allQuestions } = await client.query(
        `SELECT qv.id AS question_version_id
         FROM questions q
         JOIN question_versions qv ON qv.id = q.current_version_id
         WHERE q.status = 'active'
           AND q.deleted_at IS NULL
           ${yearCond}
         ORDER BY RANDOM()
         LIMIT $1;`,
        [limitCount]
      );
      for (const q of allQuestions) {
        selectedQuestionVersions.push({ questionVersionId: q.question_version_id });
      }
    }

    // Pastikan urutan soal SELALU diacak secara unik untuk setiap peserta (Fisher-Yates shuffle)
    // Menjamin urutan soal berbeda untuk setiap peserta meskipun bersumber dari tahun/bank soal yang sama
    for (let i = selectedQuestionVersions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selectedQuestionVersions[i], selectedQuestionVersions[j]] = [selectedQuestionVersions[j], selectedQuestionVersions[i]];
    }

    // Insert attempt_questions dan opsi
    for (let pos = 0; pos < selectedQuestionVersions.length; pos++) {
      const qvId = selectedQuestionVersions[pos].questionVersionId;

      const { rows: options } = await client.query(
        `SELECT id FROM question_options WHERE question_version_id = $1 ORDER BY position ASC;`,
        [qvId]
      );

      let optionIds = options.map((o) => o.id);
      // Pastikan urutan opsi A-E juga diacak secara unik per peserta
      for (let i = optionIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionIds[i], optionIds[j]] = [optionIds[j], optionIds[i]];
      }

      const { rows: aqRows } = await client.query(
        `INSERT INTO attempt_questions (attempt_id, question_version_id, position, option_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [attemptId, qvId, pos + 1, JSON.stringify(optionIds)]
      );

      const aqId = aqRows[0].id;

      // Inisialisasi baris jawaban kosong
      await client.query(
        `INSERT INTO attempt_answers (attempt_question_id, question_version_id, is_flagged, client_seq)
         VALUES ($1, $2, false, 0);`,
        [aqId, qvId]
      );
    }

    // Catat log audit pengerjaan dimulai
    await logAudit(
      {
        actorId: studentUserId,
        actorRole: 'student',
        action: 'attempts.start',
        entityType: 'attempts',
        entityId: attemptId,
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');

    return {
      attempt_id: attemptId,
      resumed: false,
      started_at: newAttemptRows[0].started_at,
      deadline_at: newAttemptRows[0].deadline_at,
    };
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

export async function getAttemptState(attemptId: string, studentUserId: string) {
  const { rows } = await pool.query(
    `SELECT 
      a.id, a.status, a.started_at, a.deadline_at, a.extra_seconds,
      e.duration_minutes, e.title AS exam_title,
      se.student_id
     FROM attempts a
     JOIN session_enrollments se ON se.id = a.enrollment_id
     JOIN exam_sessions s ON s.id = se.session_id
     JOIN exams e ON e.id = s.exam_id
     WHERE a.id = $1;`,
    [attemptId]
  );

  if (rows.length === 0 || rows[0].student_id !== studentUserId) {
    throw new AppError('NOT_FOUND'); // Anti-IDOR (INV-14)
  }

  const att = rows[0];

  // Hitung jawaban terisi & ditandai
  const { rows: statRows } = await pool.query(
    `SELECT 
      COUNT(*) AS total_questions,
      COUNT(ans.selected_option_id) AS answered_count,
      COUNT(CASE WHEN ans.is_flagged = true THEN 1 END) AS flagged_count
     FROM attempt_questions aq
     LEFT JOIN attempt_answers ans ON ans.attempt_question_id = aq.id
     WHERE aq.attempt_id = $1;`,
    [attemptId]
  );

  const stats = statRows[0];
  const { rows: timeRows } = await pool.query('SELECT now() AT TIME ZONE \'UTC\' AS server_time;');

  return {
    attempt_id: att.id,
    status: att.status,
    server_time: timeRows[0].server_time,
    started_at: att.started_at,
    deadline_at: att.deadline_at,
    extra_seconds: att.extra_seconds,
    total_questions: parseInt(stats.total_questions, 10),
    answered_count: parseInt(stats.answered_count, 10),
    flagged_count: parseInt(stats.flagged_count, 10),
  };
}

export async function getAttemptQuestions(attemptId: string, studentUserId: string) {
  const { rows: check } = await pool.query(
    `SELECT se.student_id, a.status
     FROM attempts a
     JOIN session_enrollments se ON se.id = a.enrollment_id
     WHERE a.id = $1;`,
    [attemptId]
  );

  if (check.length === 0 || check[0].student_id !== studentUserId) {
    throw new AppError('NOT_FOUND');
  }

  if (check[0].status !== 'in_progress') {
    throw new AppError('ATTEMPT_NOT_ACTIVE');
  }

  // Ambil daftar soal dan opsi, TIDAK MENAMPILKAN is_correct (INV-15)
  const query = `
    SELECT 
      aq.id AS attempt_question_id,
      aq.position,
      aq.option_order,
      qv.stem,
      qv.weight,
      ans.selected_option_id,
      ans.is_flagged,
      ans.client_seq
    FROM attempt_questions aq
    JOIN question_versions qv ON qv.id = aq.question_version_id
    LEFT JOIN attempt_answers ans ON ans.attempt_question_id = aq.id
    WHERE aq.attempt_id = $1
    ORDER BY aq.position ASC;
  `;
  const { rows: questions } = await pool.query(query, [attemptId]);

  // Untuk setiap soal, ambil teks opsi sesuai urutan option_order
  const resultQuestions = [];
  for (const q of questions) {
    const optionIds: string[] = typeof q.option_order === 'string' ? JSON.parse(q.option_order) : q.option_order;
    const { rows: optRows } = await pool.query(
      `SELECT id, option_text FROM question_options WHERE id = ANY($1::uuid[]);`,
      [optionIds]
    );

    // Urutkan opsi persis sesuai option_order
    const optMap = new Map(optRows.map((o) => [o.id, o.option_text]));
    const orderedOptions = optionIds.map((id, index) => ({
      id,
      label: String.fromCharCode(65 + index), // A, B, C, D, ...
      text: optMap.get(id) || '',
    }));

    resultQuestions.push({
      attempt_question_id: q.attempt_question_id,
      position: q.position,
      stem: q.stem,
      weight: q.weight,
      selected_option_id: q.selected_option_id,
      is_flagged: q.is_flagged,
      client_seq: q.client_seq,
      options: orderedOptions,
    });
  }

  return { questions: resultQuestions };
}

export async function saveAttemptAnswer(
  attemptId: string,
  position: number,
  selectedOptionId: string | null,
  isFlagged: boolean,
  clientSeq: number,
  studentUserId: string
) {
  // 1. Verifikasi attempt milik student dan sedang in_progress
  const { rows: attRows } = await pool.query(
    `SELECT a.id, a.status, a.deadline_at, se.student_id
     FROM attempts a
     JOIN session_enrollments se ON se.id = a.enrollment_id
     WHERE a.id = $1;`,
    [attemptId]
  );

  if (attRows.length === 0 || attRows[0].student_id !== studentUserId) {
    throw new AppError('NOT_FOUND');
  }

  const att = attRows[0];
  if (att.status !== 'in_progress') {
    throw new AppError('ATTEMPT_NOT_ACTIVE');
  }

  // 2. Cek deadline server + grace period 5s (INV-03)
  const { rows: timeRows } = await pool.query('SELECT clock_timestamp() AS db_now;');
  const serverNow = new Date(timeRows[0].db_now);
  const deadlineAt = new Date(att.deadline_at);

  if (!isWithinGracePeriod(serverNow, deadlineAt, CONSTANTS.ANSWER_GRACE_SECONDS)) {
    throw new AppError('ATTEMPT_EXPIRED', 'Batas waktu pengerjaan ujian telah berakhir.');
  }

  // 3. Cari attempt_question pada position
  const { rows: aqRows } = await pool.query(
    `SELECT id, question_version_id FROM attempt_questions WHERE attempt_id = $1 AND position = $2;`,
    [attemptId, position]
  );
  if (aqRows.length === 0) {
    throw new AppError('NOT_FOUND', `Soal nomor ${position} tidak ditemukan.`);
  }

  const aq = aqRows[0];

  // 4. Verifikasi selectedOptionId jika ada, harus milik question_version_id (INV-05)
  if (selectedOptionId) {
    const { rows: optRows } = await pool.query(
      `SELECT id FROM question_options WHERE id = $1 AND question_version_id = $2;`,
      [selectedOptionId, aq.question_version_id]
    );
    if (optRows.length === 0) {
      throw new AppError('VALIDATION_FAILED', 'Opsi pilihan tidak valid untuk soal ini.');
    }
  }

  // 5. Update jawaban dengan aturan client_seq idempotency (INV-07)
  const { rows: updateResult } = await pool.query(
    `UPDATE attempt_answers
     SET selected_option_id = $1,
         is_flagged = $2,
         client_seq = $3,
         answered_at = now(),
         updated_at = now()
     WHERE attempt_question_id = $4
       AND client_seq <= $3
     RETURNING attempt_question_id, selected_option_id, is_flagged, client_seq, updated_at;`,
    [selectedOptionId, isFlagged, clientSeq, aq.id]
  );

  // Jika baris tidak ter-update karena client_seq lebih kecil dari yang tersimpan, ambil state tersimpan
  if (updateResult.length === 0) {
    const { rows: existing } = await pool.query(
      `SELECT attempt_question_id, selected_option_id, is_flagged, client_seq, updated_at
       FROM attempt_answers WHERE attempt_question_id = $1;`,
      [aq.id]
    );
    return {
      success: true,
      stale_ignored: true,
      answer: existing[0],
    };
  }

  return {
    success: true,
    stale_ignored: false,
    answer: updateResult[0],
  };
}

export async function submitExamAttempt(
  attemptId: string,
  submitReason: 'manual' | 'timeout' | 'forced',
  studentUserId?: string,
  ipAddress?: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    const { rows: attRows } = await client.query(
      `SELECT a.id, a.status, a.deadline_at, a.enrollment_id,
              e.id AS exam_id, e.passing_score,
              se.student_id
       FROM attempts a
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN exam_sessions s ON s.id = se.session_id
       JOIN exams e ON e.id = s.exam_id
       WHERE a.id = $1
       FOR UPDATE;`,
      [attemptId]
    );

    if (attRows.length === 0) {
      throw new AppError('NOT_FOUND');
    }

    const att = attRows[0];
    if (studentUserId && att.student_id !== studentUserId) {
      throw new AppError('NOT_FOUND'); // Anti-IDOR (INV-14)
    }

    if (att.status !== 'in_progress') {
      // Jika sudah tersubmit, kembalikan idempoten
      await client.query('COMMIT;');
      return { success: true, attempt_id: attemptId, status: att.status };
    }

    // Cek deadline jika submit manual
    const { rows: timeRows } = await client.query('SELECT clock_timestamp() AS db_now;');
    const serverNow = new Date(timeRows[0].db_now);
    const deadlineAt = new Date(att.deadline_at);

    if (submitReason === 'manual' && !isWithinGracePeriod(serverNow, deadlineAt, CONSTANTS.ANSWER_GRACE_SECONDS)) {
      // Melebihi batas waktu + 5s, otomatis dialihkan menjadi timeout
      submitReason = 'timeout';
    }

    // Ambil seluruh jawaban untuk penilaian (INV-12, BR-01, BR-02)
    const { rows: questionRows } = await client.query(
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
      [attemptId]
    );

    // Ambil koreksi soal aktif
    const qvIds = questionRows.map((q) => q.question_version_id);
    const { rows: corrections } = await client.query(
      `SELECT question_version_id, type, old_option_id, new_option_id
       FROM question_corrections
       WHERE question_version_id = ANY($1::uuid[]);`,
      [qvIds]
    );

    const correctionsMap = new Map<string, CorrectionRule[]>();
    for (const c of corrections) {
      const list = correctionsMap.get(c.question_version_id) || [];
      list.push(c);
      correctionsMap.set(c.question_version_id, list);
    }

    const gradingItems = [];
    for (const q of questionRows) {
      const qRules = correctionsMap.get(q.question_version_id) || [];
      const itemScore = calculateQuestionPoints(
        q.selected_option_id,
        q.correct_option_id,
        parseFloat(q.weight),
        qRules
      );

      // Perbarui points_awarded dan is_correct pada attempt_answers
      await client.query(
        `UPDATE attempt_answers
         SET points_awarded = $1, is_correct = $2
         WHERE attempt_question_id = $3;`,
        [itemScore.pointsAwarded, itemScore.isCorrect, q.attempt_question_id]
      );

      gradingItems.push(itemScore);
    }

    const evaluated = evaluateScore(gradingItems, parseFloat(att.passing_score));

    // Perbarui status attempt
    const newAttemptStatus = submitReason === 'timeout' ? 'auto_submitted' : 'submitted';
    await client.query(
      `UPDATE attempts
       SET status = $1,
           submitted_at = $2,
           submit_reason = $3
       WHERE id = $4;`,
      [newAttemptStatus, serverNow.toISOString(), submitReason, attemptId]
    );

    // Masukkan ke tabel results (status pending_publication)
    await client.query(
      `INSERT INTO results (
        attempt_id, raw_score, max_score, score, passing_score, passed, status, graded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending_publication', now())
      ON CONFLICT (attempt_id) DO UPDATE
      SET raw_score = $2, max_score = $3, score = $4, passing_score = $5, passed = $6, graded_at = now();`,
      [
        attemptId,
        evaluated.rawScore,
        evaluated.maxScore,
        evaluated.score,
        parseFloat(att.passing_score),
        evaluated.passed,
      ]
    );

    // Audit log
    await logAudit(
      {
        actorId: studentUserId || null,
        actorRole: studentUserId ? 'student' : null,
        action: 'attempts.submit',
        entityType: 'attempts',
        entityId: attemptId,
        reason: `Exam submitted via ${submitReason}`,
        afterData: {
          raw_score: evaluated.rawScore,
          score: evaluated.score,
          passed: evaluated.passed,
          submit_reason: submitReason,
        },
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');

    return {
      success: true,
      attempt_id: attemptId,
      status: newAttemptStatus,
      submitted_at: serverNow,
    };
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

export async function voidExamAttempt(
  attemptId: string,
  reason: string,
  adminActorId: string,
  ipAddress?: string
) {
  const { rows } = await pool.query(
    `UPDATE attempts
     SET status = 'void',
         void_reason = $1
     WHERE id = $2 AND status <> 'void'
     RETURNING id, enrollment_id, attempt_no;`,
    [reason.trim(), attemptId]
  );

  if (rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Percobaan tidak ditemukan atau sudah dibatalkan.');
  }

  // Jika result sudah pernah dibuat, hapus atau sesuaikan
  await pool.query('DELETE FROM results WHERE attempt_id = $1;', [attemptId]);

  await logAudit({
    actorId: adminActorId,
    actorRole: 'admin',
    action: 'attempts.void',
    entityType: 'attempts',
    entityId: attemptId,
    reason,
    ipAddress,
  });

  return { success: true, voided: rows[0] };
}

export async function extendSingleAttempt(
  attemptId: string,
  extraMinutes: number,
  reason: string,
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

  const { rows } = await pool.query(
    `UPDATE attempts
     SET deadline_at = deadline_at + ($1 || ' seconds')::interval,
         extra_seconds = extra_seconds + $1,
         extension_reason = COALESCE(extension_reason || '; ', '') || $2
     WHERE id = $3 AND status = 'in_progress'
     RETURNING id, deadline_at, extra_seconds;`,
    [extraSeconds, reason.trim(), attemptId]
  );

  if (rows.length === 0) {
    throw new AppError('ATTEMPT_NOT_ACTIVE', 'Percobaan tidak aktif atau tidak ditemukan.');
  }

  await logAudit({
    actorId: adminActorId,
    actorRole: 'admin',
    action: 'attempts.extend',
    entityType: 'attempts',
    entityId: attemptId,
    reason: `Extended by ${extraMinutes} mins: ${reason}`,
    afterData: rows[0],
    ipAddress,
  });

  return rows[0];
}

export async function recordAttemptEvent(
  attemptId: string,
  eventType: string,
  clientTime?: string | null,
  detail?: any
) {
  const { rows } = await pool.query(
    `INSERT INTO attempt_events (attempt_id, event_type, client_time, detail)
     VALUES ($1, $2, $3, $4)
     RETURNING id, occurred_at;`,
    [attemptId, eventType, clientTime || null, detail ? JSON.stringify(detail) : null]
  );

  return rows[0];
}
