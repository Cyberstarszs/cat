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

    // 2. Kunci sesi & pendaftaran serta kunci baris user untuk serialisasi pengerjaan
    await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE;`, [studentUserId]);

    const { rows: sessionRows } = await client.query(
      `SELECT s.*, e.id AS exam_id, e.title AS exam_title, e.duration_minutes,
              e.question_count, e.shuffle_questions, e.shuffle_options,
              e.passing_score, e.max_attempts_per_student, e.year AS exam_year,
              se.id AS enrollment_id, se.status AS enrollment_status
       FROM exam_sessions s
       JOIN exams e ON e.id = s.exam_id
       JOIN session_enrollments se ON se.session_id = s.id AND se.student_id = $1
       WHERE s.id = $2
       FOR UPDATE OF se;`,
      [studentUserId, sessionId]
    );

    if (sessionRows.length === 0) {
      throw new AppError('NOT_FOUND', 'Anda tidak terdaftar dalam sesi ujian ini.');
    }

    const s = sessionRows[0];

    // Cek status pendaftaran peserta (batal / diskualifikasi)
    if (s.enrollment_status === 'cancelled') {
      throw new AppError('FORBIDDEN', 'Pendaftaran Anda pada sesi ujian ini telah dibatalkan oleh panitia.');
    }

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
    const sessionDurationMinutes = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / (60 * 1000)));
    const effectiveDurationMinutes = sessionDurationMinutes || s.duration_minutes || 90;
    const remainingSessionSeconds = Math.floor((endsAt.getTime() - serverNow.getTime()) / 1000);
    const requiredSeconds = effectiveDurationMinutes * 60;
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

    // Cek apakah sudah ada attempt non-void pada enrollment sesi ini (INV-01)
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

    // Validasi kelayakan lintas-sesi untuk ujian ini sebelum membuat attempt baru:
    // A. Cek ALREADY_PASSED (TC-41): Mahasiswa sudah pernah lulus pada ujian ini
    const { rows: passedCheck } = await client.query(
      `SELECT r.id FROM results r
       JOIN attempts a ON a.id = r.attempt_id
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN exam_sessions es ON es.id = se.session_id
       WHERE se.student_id = $1 AND es.exam_id = $2 AND r.passed = true AND r.status = 'published';`,
      [studentUserId, s.exam_id]
    );
    if (passedCheck.length > 0) {
      throw new AppError('ALREADY_PASSED', 'Anda sudah dinyatakan lulus pada ujian ini.');
    }

    // B. Cek PREVIOUS_RESULT_PENDING (TC-44): Hasil percobaan sesi sebelumnya belum dipublikasikan
    const { rows: pendingCheck } = await client.query(
      `SELECT r.id FROM results r
       JOIN attempts a ON a.id = r.attempt_id
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN exam_sessions es ON es.id = se.session_id
       WHERE se.student_id = $1 AND es.exam_id = $2 AND r.status = 'pending_publication';`,
      [studentUserId, s.exam_id]
    );
    if (pendingCheck.length > 0) {
      throw new AppError('PREVIOUS_RESULT_PENDING', 'Hasil ujian Anda pada sesi sebelumnya sedang menunggu proses verifikasi/publikasi nilai.');
    }

    // C. Cek CONCURRENT_ATTEMPT: Pengerjaan aktif sedang berlangsung di sesi lain
    const { rows: activeOther } = await client.query(
      `SELECT a.id, es.name AS session_name
       FROM attempts a
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN exam_sessions es ON es.id = se.session_id
       WHERE se.student_id = $1 AND es.exam_id = $2 AND a.status = 'in_progress' AND a.enrollment_id <> $3;`,
      [studentUserId, s.exam_id, s.enrollment_id]
    );
    if (activeOther.length > 0) {
      throw new AppError('CONCURRENT_ATTEMPT', `Anda masih memiliki sesi pengerjaan aktif yang sedang berlangsung pada sesi "${activeOther[0].session_name}".`);
    }

    // D. Cek QUOTA_EXCEEDED: Batas total percobaan ujian non-void melampaui max_attempts_per_student
    const { rows: countTotalAttempts } = await client.query(
      `SELECT COUNT(*) AS total
       FROM attempts a
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN exam_sessions es ON es.id = se.session_id
       WHERE se.student_id = $1 AND es.exam_id = $2 AND a.status <> 'void';`,
      [studentUserId, s.exam_id]
    );
    if (parseInt(countTotalAttempts[0].total, 10) >= s.max_attempts_per_student) {
      throw new AppError('QUOTA_EXCEEDED', `Batas kesempatan percobaan ujian ini (${s.max_attempts_per_student}x) sudah habis.`);
    }

    // Hitung nomor percobaan (attempt_no)
    const { rows: countAttempts } = await client.query(
      `SELECT COALESCE(MAX(attempt_no), 0) AS max_no FROM attempts WHERE enrollment_id = $1;`,
      [s.enrollment_id]
    );
    const nextAttemptNo = parseInt(countAttempts[0].max_no, 10) + 1;

    // Hitung deadline (INV-03) berdasarkan durasi sesi efektif
    const deadlineAt = calculateAttemptDeadline(serverNow, effectiveDurationMinutes, endsAt);

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
        const effectiveYear = s.exam_year || s.question_year || null;
        const yearCond = effectiveYear ? `AND q.year = ${parseInt(effectiveYear, 10)}` : '';
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
        let { rows: sampled } = await client.query(sampleQuery, queryParams);

        // Jika bank soal pada tahun spesifik kurang, lengkapi dari tahun lain yang tersedia di kategori & tingkat yang sama
        if (sampled.length < rule.question_count && effectiveYear) {
          const needed = rule.question_count - sampled.length;
          const currentSelected = [...alreadySelected, ...sampled.map((q) => q.question_version_id)];
          const fallbackParams: any[] = [rule.category_id, needed];
          let fallbackExclude = '';
          if (currentSelected.length > 0) {
            fallbackExclude = `AND qv.id <> ALL($3::uuid[])`;
            fallbackParams.push(currentSelected);
          }
          const { rows: fallbackSampled } = await client.query(
            `SELECT qv.id AS question_version_id
             FROM questions q
             JOIN question_versions qv ON qv.id = q.current_version_id
             WHERE q.category_id = $1 
               AND q.status = 'active'
               AND q.deleted_at IS NULL
               ${diffCond}
               ${fallbackExclude}
             ORDER BY RANDOM()
             LIMIT $2;`,
            fallbackParams
          );
          sampled = [...sampled, ...fallbackSampled];
        }

        if (sampled.length < rule.question_count) {
          throw new AppError(
            'QUESTION_POOL_INSUFFICIENT',
            `Stok bank soal aktif untuk kategori "${rule.category_id}" tidak mencukupi untuk komposisi ujian saat ini.`
          );
        }

        for (const q of sampled) {
          selectedQuestionVersions.push({ questionVersionId: q.question_version_id });
        }
      }
    } else {
      // Fallback jika belum ada aturan komposisi subtes: ambil soal aktif sesuai tahun sesi
      const effectiveYear = s.exam_year || s.question_year || null;
      const yearCond = effectiveYear ? `AND q.year = ${parseInt(effectiveYear, 10)}` : '';
      const limitCount = s.question_count || 100;
      let { rows: allQuestions } = await client.query(
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

      if (allQuestions.length < limitCount && effectiveYear) {
        const needed = limitCount - allQuestions.length;
        const currentSelected = allQuestions.map((q) => q.question_version_id);
        const { rows: fallbackQuestions } = await client.query(
          `SELECT qv.id AS question_version_id
           FROM questions q
           JOIN question_versions qv ON qv.id = q.current_version_id
           WHERE q.status = 'active'
             AND q.deleted_at IS NULL
             ${currentSelected.length > 0 ? 'AND qv.id <> ALL($2::uuid[])' : ''}
           ORDER BY RANDOM()
           LIMIT $1;`,
          currentSelected.length > 0 ? [needed, currentSelected] : [needed]
        );
        allQuestions = [...allQuestions, ...fallbackQuestions];
      }

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

    // Pre-fetch seluruh opsi untuk semua butir soal terpilih dalam 1 kueri (eliminasi N+1 kueri di dalam transaksi)
    const allQvIds = selectedQuestionVersions.map((q) => q.questionVersionId);
    const { rows: allOptions } = await client.query(
      `SELECT id, question_version_id, position
       FROM question_options
       WHERE question_version_id = ANY($1::uuid[])
       ORDER BY question_version_id, position ASC;`,
      [allQvIds]
    );

    const optionsByQv = new Map<string, Array<{ id: string }>>();
    for (const opt of allOptions) {
      const list = optionsByQv.get(opt.question_version_id) || [];
      list.push(opt);
      optionsByQv.set(opt.question_version_id, list);
    }

    // Siapkan parameter batch untuk attempt_questions
    const aqPositions: number[] = [];
    const aqQvIds: string[] = [];
    const aqOptionOrders: string[] = [];

    for (let pos = 0; pos < selectedQuestionVersions.length; pos++) {
      const qvId = selectedQuestionVersions[pos].questionVersionId;
      const opts = optionsByQv.get(qvId) || [];
      let optionIds = opts.map((o) => o.id);

      // Acak urutan opsi A-E secara unik per peserta jika opsi ada
      for (let i = optionIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionIds[i], optionIds[j]] = [optionIds[j], optionIds[i]];
      }

      aqPositions.push(pos + 1);
      aqQvIds.push(qvId);
      aqOptionOrders.push(JSON.stringify(optionIds));
    }

    // Batch insert attempt_questions dalam 1 kueri
    const { rows: insertedAqRows } = await client.query(
      `INSERT INTO attempt_questions (attempt_id, position, question_version_id, option_order)
       SELECT $1, pos, qv_id, opt_order::jsonb
       FROM unnest($2::int[], $3::uuid[], $4::text[]) AS t(pos, qv_id, opt_order)
       ORDER BY pos ASC
       RETURNING id, question_version_id, position;`,
      [attemptId, aqPositions, aqQvIds, aqOptionOrders]
    );

    // Batch insert attempt_answers awal dalam 1 kueri
    const insAqIds = insertedAqRows.map((r) => r.id);
    const insQvIds = insertedAqRows.map((r) => r.question_version_id);
    if (insAqIds.length > 0) {
      await client.query(
        `INSERT INTO attempt_answers (attempt_question_id, question_version_id, is_flagged, client_seq)
         SELECT aq_id, qv_id, false, 0
         FROM unnest($1::uuid[], $2::uuid[]) AS t(aq_id, qv_id);`,
        [insAqIds, insQvIds]
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

  if (questions.length === 0) {
    return { questions: [] };
  }

  // Kumpulkan seluruh option IDs dalam 1 kueri untuk mengeliminasi N+1 round trips
  const allOptionIds: string[] = [];
  for (const q of questions) {
    const optIds: string[] = typeof q.option_order === 'string' ? JSON.parse(q.option_order) : q.option_order;
    if (Array.isArray(optIds)) {
      allOptionIds.push(...optIds);
    }
  }

  let optMap = new Map<string, string>();
  if (allOptionIds.length > 0) {
    const { rows: optRows } = await pool.query(
      `SELECT id, option_text FROM question_options WHERE id = ANY($1::uuid[]);`,
      [allOptionIds]
    );
    optMap = new Map(optRows.map((o) => [o.id, o.option_text]));
  }

  const resultQuestions = questions.map((q) => {
    const optionIds: string[] = typeof q.option_order === 'string' ? JSON.parse(q.option_order) : q.option_order;
    const orderedOptions = (optionIds || []).map((id, index) => ({
      id,
      label: String.fromCharCode(65 + index), // A, B, C, D, ...
      text: optMap.get(id) || '',
    }));

    return {
      attempt_question_id: q.attempt_question_id,
      position: q.position,
      stem: q.stem,
      weight: q.weight,
      selected_option_id: q.selected_option_id,
      is_flagged: q.is_flagged,
      client_seq: q.client_seq,
      options: orderedOptions,
    };
  });

  return { questions: resultQuestions };
}

export async function saveAttemptAnswer(
  attemptId: string,
  position: number,
  selectedOptionId: string | null,
  isFlagged: boolean | null | undefined,
  clientSeq: number,
  studentUserId: string
) {
  // 1. Verifikasi attempt milik student dan sedang in_progress serta ambil DB timestamp dalam 1 query
  const { rows: attRows } = await pool.query(
    `SELECT a.id, a.status, a.deadline_at, se.student_id, clock_timestamp() AS db_now
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
  const serverNow = new Date(att.db_now);
  const deadlineAt = new Date(att.deadline_at);

  if (!isWithinGracePeriod(serverNow, deadlineAt, CONSTANTS.ANSWER_GRACE_SECONDS)) {
    throw new AppError('ATTEMPT_EXPIRED', 'Batas waktu pengerjaan ujian telah berakhir.');
  }

  // 3. Cari attempt_question pada position & validasi opsi dalam 1 query terpadu (INV-05)
  const { rows: aqRows } = await pool.query(
    `SELECT aq.id, aq.question_version_id,
            CASE WHEN $3::uuid IS NOT NULL THEN
              EXISTS(SELECT 1 FROM question_options qo WHERE qo.id = $3 AND qo.question_version_id = aq.question_version_id)
            ELSE true END AS is_option_valid
     FROM attempt_questions aq
     WHERE aq.attempt_id = $1 AND aq.position = $2;`,
    [attemptId, position, selectedOptionId || null]
  );

  if (aqRows.length === 0) {
    throw new AppError('NOT_FOUND', `Soal nomor ${position} tidak ditemukan.`);
  }

  const aq = aqRows[0];
  if (!aq.is_option_valid) {
    throw new AppError('VALIDATION_FAILED', 'Opsi pilihan tidak valid untuk soal ini.');
  }

  // 5. Update jawaban dengan aturan client_seq idempotency (INV-07)
  const flagParam = isFlagged !== undefined ? isFlagged : null;
  const { rows: updateResult } = await pool.query(
    `UPDATE attempt_answers
     SET selected_option_id = $1,
         is_flagged = COALESCE($2, is_flagged),
         client_seq = $3,
         answered_at = now(),
         updated_at = now()
     WHERE attempt_question_id = $4
       AND client_seq <= $3
     RETURNING attempt_question_id, selected_option_id, is_flagged, client_seq, updated_at;`,
    [selectedOptionId, flagParam, clientSeq, aq.id]
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
      if (att.status === 'void') {
        throw new AppError('ATTEMPT_VOIDED', 'Percobaan ujian telah dibatalkan oleh pengawas.');
      }
      // Jika sudah tersubmit, kembalikan idempoten
      const { rows: existingRes } = await client.query(
        `SELECT id, score, passed FROM results WHERE attempt_id = $1;`,
        [attemptId]
      );
      await client.query('COMMIT;');
      return {
        success: true,
        attempt_id: attemptId,
        result_id: existingRes[0]?.id || null,
        score: existingRes[0]?.score ? parseFloat(existingRes[0].score) : null,
        passed: existingRes[0]?.passed ?? null,
        status: att.status,
      };
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
    const updateAqIds: string[] = [];
    const updatePoints: number[] = [];
    const updateIsCorrect: boolean[] = [];

    for (const q of questionRows) {
      const qRules = correctionsMap.get(q.question_version_id) || [];
      const itemScore = calculateQuestionPoints(
        q.selected_option_id,
        q.correct_option_id,
        parseFloat(q.weight),
        qRules
      );

      updateAqIds.push(q.attempt_question_id);
      updatePoints.push(itemScore.pointsAwarded);
      updateIsCorrect.push(itemScore.isCorrect);
      gradingItems.push(itemScore);
    }

    // Batch update points_awarded dan is_correct pada attempt_answers
    if (updateAqIds.length > 0) {
      await client.query(
        `UPDATE attempt_answers AS a
         SET points_awarded = v.points_awarded,
             is_correct = v.is_correct
         FROM (
           SELECT unnest($1::uuid[]) AS attempt_question_id,
                  unnest($2::numeric[]) AS points_awarded,
                  unnest($3::boolean[]) AS is_correct
         ) AS v
         WHERE a.attempt_question_id = v.attempt_question_id;`,
        [updateAqIds, updatePoints, updateIsCorrect]
      );
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

    // Masukkan ke tabel results (otomatis terbit/published karena ambang batas kelulusan sudah ditentukan di awal)
    const { rows: resRows } = await client.query(
      `INSERT INTO results (
        attempt_id, raw_score, max_score, score, passing_score, passed, status, published_at, graded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'published', now(), now())
      ON CONFLICT (attempt_id) DO UPDATE
      SET raw_score = $2, max_score = $3, score = $4, passing_score = $5, passed = $6, status = 'published', published_at = COALESCE(results.published_at, now()), graded_at = now()
      RETURNING id, score, passed;`,
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

    // Jika peserta dinyatakan LULUS, terbitkan sertifikat dan antrekan email sertifikat ke email kampus
    if (evaluated.passed && resRows[0]?.id) {
      try {
        const { issueCertificateForResult } = await import('../certificates/certificates.service.js');
        await issueCertificateForResult(resRows[0].id, studentUserId || 'system', client);
      } catch (certErr) {
        console.error('[ATTEMPT_SUBMIT] Gagal menerbitkan sertifikat otomatis saat submit:', certErr);
      }
    }

    await client.query('COMMIT;');

    return {
      success: true,
      attempt_id: attemptId,
      result_id: resRows[0]?.id || null,
      score: evaluated.score,
      passed: evaluated.passed,
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    const { rows } = await client.query(
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

    // Jika result sudah pernah dibuat, hapus appeals, certificates, lalu results agar tidak melanggar foreign key
    const { rows: resRows } = await client.query('SELECT id FROM results WHERE attempt_id = $1;', [attemptId]);
    if (resRows.length > 0) {
      const resId = resRows[0].id;
      await client.query('DELETE FROM certificates WHERE result_id = $1;', [resId]);
      await client.query('DELETE FROM appeals WHERE result_id = $1;', [resId]);
      await client.query('DELETE FROM results WHERE id = $1;', [resId]);
    }

    await logAudit(
      {
        actorId: adminActorId,
        actorRole: 'admin',
        action: 'attempts.void',
        entityType: 'attempts',
        entityId: attemptId,
        reason,
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');
    return { success: true, voided: rows[0] };
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
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

  // Sesuaikan ends_at pada sesi jika penambahan waktu melampaui jadwal penutupan sesi
  await pool.query(
    `UPDATE exam_sessions es
     SET ends_at = GREATEST(es.ends_at, $1::timestamptz),
         updated_at = now()
     FROM session_enrollments se
     JOIN attempts a ON a.enrollment_id = se.id
     WHERE es.id = se.session_id AND a.id = $2;`,
    [rows[0].deadline_at, attemptId]
  );

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
  detail?: any,
  studentUserId?: string
) {
  // Anti-IDOR (INV-14): Jika dipanggil oleh siswa, pastikan attempt milik siswa dan sedang in_progress
  if (studentUserId) {
    const { rows: attCheck } = await pool.query(
      `SELECT a.id, a.status, se.student_id
       FROM attempts a
       JOIN session_enrollments se ON se.id = a.enrollment_id
       WHERE a.id = $1;`,
      [attemptId]
    );

    if (attCheck.length === 0 || attCheck[0].student_id !== studentUserId) {
      throw new AppError('NOT_FOUND');
    }

    if (attCheck[0].status !== 'in_progress') {
      throw new AppError('ATTEMPT_NOT_ACTIVE', 'Sesi pengerjaan ujian sudah tidak aktif.');
    }
  } else {
    // Validasi keberadaan attempt
    const { rows: attCheck } = await pool.query(`SELECT id FROM attempts WHERE id = $1;`, [attemptId]);
    if (attCheck.length === 0) {
      throw new AppError('NOT_FOUND');
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO attempt_events (attempt_id, event_type, client_time, detail)
     VALUES ($1, $2, $3, $4)
     RETURNING id, occurred_at;`,
    [attemptId, eventType, clientTime || null, detail ? JSON.stringify(detail) : null]
  );

  return rows[0];
}
