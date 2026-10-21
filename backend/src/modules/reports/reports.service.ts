import { stringify } from 'csv-stringify/sync';
import { pool } from '../../db/connection.js';
import { AppError } from '../../lib/errors.js';
import { logAudit } from '../audit/audit.service.js';

export async function getDashboardMetrics() {
  const { rows: studentCount } = await pool.query(
    "SELECT COUNT(*) AS total FROM users WHERE role IN ('student', 'mahasiswa', 'umum') AND deleted_at IS NULL;"
  );

  const { rows: examCount } = await pool.query(
    "SELECT COUNT(*) AS total FROM exams WHERE status = 'active';"
  );

  const { rows: sessionCount } = await pool.query(
    "SELECT COUNT(*) AS total FROM exam_sessions WHERE status = 'published' AND ends_at >= now();"
  );

  const { rows: resultsMetrics } = await pool.query(
    `SELECT 
      COUNT(*) AS total_results,
      COUNT(CASE WHEN passed = true THEN 1 END) AS passed_count,
      ROUND(AVG(score), 2) AS average_score
     FROM results
     WHERE status = 'published';`
  );

  const totalResults = parseInt(resultsMetrics[0].total_results, 10);
  const passedCount = parseInt(resultsMetrics[0].passed_count, 10);
  const passRate = totalResults > 0 ? parseFloat(((passedCount / totalResults) * 100).toFixed(2)) : 0;

  // Recent 5 results
  const { rows: recentResults } = await pool.query(
    `SELECT 
      r.id, r.score, r.passed, r.published_at,
      sp.identifier, sp.full_name,
      e.title AS exam_title, s.name AS session_name
     FROM results r
     JOIN attempts a ON a.id = r.attempt_id
     JOIN session_enrollments se ON se.id = a.enrollment_id
     JOIN student_profiles sp ON sp.user_id = se.student_id
     JOIN exam_sessions s ON s.id = se.session_id
     JOIN exams e ON e.id = s.exam_id
     WHERE r.status = 'published'
     ORDER BY r.published_at DESC
     LIMIT 5;`
  );

  return {
    total_students: parseInt(studentCount[0].total, 10),
    total_active_exams: parseInt(examCount[0].total, 10),
    active_sessions: parseInt(sessionCount[0].total, 10),
    total_completed_results: totalResults,
    passed_count: passedCount,
    pass_rate_percentage: passRate,
    average_score: parseFloat(resultsMetrics[0].average_score || '0'),
    recent_results: recentResults,
  };
}

export async function getSessionReport(sessionId: string) {
  const { rows: sessionInfo } = await pool.query(
    `SELECT s.*, e.title AS exam_title, e.passing_score
     FROM exam_sessions s JOIN exams e ON e.id = s.exam_id WHERE s.id = $1;`,
    [sessionId]
  );
  if (sessionInfo.length === 0) throw new AppError('NOT_FOUND');
  const session = sessionInfo[0];

  const { rows: enrollments } = await pool.query(
    `SELECT 
      se.id AS enrollment_id, se.status AS enrollment_status,
      sp.identifier, sp.full_name, sp.institution,
      a.id AS attempt_id, a.status AS attempt_status,
      r.id AS result_id, r.score, r.passed, r.status AS result_status
     FROM session_enrollments se
     JOIN student_profiles sp ON sp.user_id = se.student_id
     LEFT JOIN attempts a ON a.enrollment_id = se.id AND a.status <> 'void'
     LEFT JOIN results r ON r.attempt_id = a.id
     WHERE se.session_id = $1
     ORDER BY sp.identifier ASC;`,
    [sessionId]
  );

  const publishedResults = enrollments.filter((e) => e.result_status === 'published' && e.score !== null);
  const scores = publishedResults.map((r) => parseFloat(r.score)).sort((a, b) => a - b);

  let highestScore = 0;
  let lowestScore = 0;
  let averageScore = 0;
  let medianScore = 0;

  if (scores.length > 0) {
    highestScore = scores[scores.length - 1];
    lowestScore = scores[0];
    const sum = scores.reduce((acc, cur) => acc + cur, 0);
    averageScore = parseFloat((sum / scores.length).toFixed(2));
    const mid = Math.floor(scores.length / 2);
    medianScore = scores.length % 2 !== 0 ? scores[mid] : parseFloat(((scores[mid - 1] + scores[mid]) / 2).toFixed(2));
  }

  const passedCount = publishedResults.filter((r) => r.passed).length;
  const passRate = publishedResults.length > 0 ? parseFloat(((passedCount / publishedResults.length) * 100).toFixed(2)) : 0;

  return {
    session,
    metrics: {
      total_enrolled: enrollments.length,
      attended_count: enrollments.filter((e) => e.enrollment_status === 'attended').length,
      absent_count: enrollments.filter((e) => e.enrollment_status === 'absent').length,
      graded_count: publishedResults.length,
      passed_count: passedCount,
      failed_count: publishedResults.length - passedCount,
      pass_rate_percentage: passRate,
      highest_score: highestScore,
      lowest_score: lowestScore,
      average_score: averageScore,
      median_score: medianScore,
    },
    participants: enrollments,
  };
}

export async function getInstitutionsReport() {
  const query = `
    SELECT 
      COALESCE(NULLIF(sp.institution, ''), 'FIA / Internal') AS institution_name,
      COUNT(DISTINCT sp.user_id) AS total_students,
      COUNT(r.id) AS total_attempts,
      COUNT(CASE WHEN r.passed = true THEN 1 END) AS passed_count,
      ROUND(AVG(r.score), 2) AS average_score
    FROM student_profiles sp
    JOIN session_enrollments se ON se.student_id = sp.user_id
    JOIN attempts a ON a.enrollment_id = se.id AND a.status <> 'void'
    JOIN results r ON r.attempt_id = a.id AND r.status = 'published'
    GROUP BY COALESCE(NULLIF(sp.institution, ''), 'FIA / Internal')
    ORDER BY total_students DESC, average_score DESC;
  `;
  const { rows } = await pool.query(query);

  const formatted = rows.map((r) => {
    const attempts = parseInt(r.total_attempts, 10);
    const passed = parseInt(r.passed_count, 10);
    const passRate = attempts > 0 ? parseFloat(((passed / attempts) * 100).toFixed(2)) : 0;
    return {
      institution: r.institution_name,
      total_students: parseInt(r.total_students, 10),
      total_attempts: attempts,
      passed_count: passed,
      pass_rate_percentage: passRate,
      average_score: parseFloat(r.average_score || '0'),
    };
  });

  return { institutions: formatted };
}

/**
 * Formula injection protection: prefix =, +, -, @ with single quote (TC-35).
 */
function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@]/.test(str)) {
    return `'` + str;
  }
  return str;
}

export async function exportSessionResultsCSV(
  sessionId: string,
  adminActorId: string,
  ipAddress?: string
): Promise<string> {
  const query = `
    SELECT 
      s.name AS session_name,
      e.title AS exam_title,
      sp.identifier,
      sp.full_name,
      sp.institution,
      se.status AS enrollment_status,
      r.score,
      r.passed,
      r.revision_no,
      r.published_at
    FROM results r
    JOIN attempts a ON a.id = r.attempt_id
    JOIN session_enrollments se ON se.id = a.enrollment_id
    JOIN student_profiles sp ON sp.user_id = se.student_id
    JOIN exam_sessions s ON s.id = se.session_id
    JOIN exams e ON e.id = s.exam_id
    WHERE s.id = $1 AND r.status = 'published'
    ORDER BY sp.identifier ASC;
  `;

  const { rows } = await pool.query(query, [sessionId]);

  const csvRows = rows.map((r) => ({
    sesi: sanitizeCsvValue(r.session_name),
    ujian: sanitizeCsvValue(r.exam_title),
    nomor_identitas: sanitizeCsvValue(r.identifier),
    nama: sanitizeCsvValue(r.full_name),
    instansi: sanitizeCsvValue(r.institution || 'Internal'),
    kehadiran: sanitizeCsvValue(r.enrollment_status),
    skor: sanitizeCsvValue(r.score),
    lulus: r.passed ? 'Ya' : 'Tidak',
    nomor_revisi: r.revision_no,
    tanggal_publikasi: r.published_at ? new Date(r.published_at).toISOString() : '',
  }));

  const csvOutput = stringify(csvRows, {
    header: true,
    columns: [
      'sesi',
      'ujian',
      'nomor_identitas',
      'nama',
      'instansi',
      'kehadiran',
      'skor',
      'lulus',
      'nomor_revisi',
      'tanggal_publikasi',
    ],
  });

  await logAudit({
    actorId: adminActorId,
    actorRole: 'admin',
    action: 'reports.export_csv',
    entityType: 'exam_sessions',
    entityId: sessionId,
    reason: `Exported ${csvRows.length} results to CSV`,
    ipAddress,
  });

  return csvOutput;
}

export async function getExamReport(examId: string) {
  const { rows: examInfo } = await pool.query('SELECT * FROM exams WHERE id = $1;', [examId]);
  if (examInfo.length === 0) throw new AppError('NOT_FOUND');
  const exam = examInfo[0];

  // Aggregated results across all sessions of this exam
  const query = `
    SELECT 
      r.score, r.passed,
      s.id AS session_id, s.name AS session_name
    FROM results r
    JOIN attempts a ON a.id = r.attempt_id
    JOIN session_enrollments se ON se.id = a.enrollment_id
    JOIN exam_sessions s ON s.id = se.session_id
    WHERE s.exam_id = $1 AND r.status = 'published';
  `;
  const { rows: results } = await pool.query(query, [examId]);

  const scores = results.map((r) => parseFloat(r.score)).sort((a, b) => a - b);
  let highestScore = 0;
  let lowestScore = 0;
  let averageScore = 0;
  let medianScore = 0;

  if (scores.length > 0) {
    highestScore = scores[scores.length - 1];
    lowestScore = scores[0];
    const sum = scores.reduce((acc, cur) => acc + cur, 0);
    averageScore = parseFloat((sum / scores.length).toFixed(2));
    const mid = Math.floor(scores.length / 2);
    medianScore = scores.length % 2 !== 0 ? scores[mid] : parseFloat(((scores[mid - 1] + scores[mid]) / 2).toFixed(2));
  }

  const passedCount = results.filter((r) => r.passed).length;
  const passRate = results.length > 0 ? parseFloat(((passedCount / results.length) * 100).toFixed(2)) : 0;

  // Distribution buckets
  const distribution = {
    '0-49': scores.filter((s) => s < 50).length,
    '50-69': scores.filter((s) => s >= 50 && s < 70).length,
    '70-79': scores.filter((s) => s >= 70 && s < 80).length,
    '80-89': scores.filter((s) => s >= 80 && s < 90).length,
    '90-100': scores.filter((s) => s >= 90).length,
  };

  // Sessions breakdown
  const { rows: sessionBreakdown } = await pool.query(
    `SELECT 
      s.id, s.code, s.name, s.starts_at, s.ends_at, s.status,
      COUNT(DISTINCT se.id) AS enrolled_count,
      COUNT(DISTINCT r.id) AS completed_count,
      COUNT(CASE WHEN r.passed = true THEN 1 END) AS passed_count,
      ROUND(AVG(r.score), 2) AS average_score
     FROM exam_sessions s
     LEFT JOIN session_enrollments se ON se.session_id = s.id
     LEFT JOIN attempts a ON a.enrollment_id = se.id AND a.status <> 'void'
     LEFT JOIN results r ON r.attempt_id = a.id AND r.status = 'published'
     WHERE s.exam_id = $1
     GROUP BY s.id
     ORDER BY s.starts_at DESC;`,
    [examId]
  );

  return {
    exam,
    metrics: {
      total_sessions: sessionBreakdown.length,
      total_completed: results.length,
      passed_count: passedCount,
      failed_count: results.length - passedCount,
      pass_rate_percentage: passRate,
      highest_score: highestScore,
      lowest_score: lowestScore,
      average_score: averageScore,
      median_score: medianScore,
      score_distribution: distribution,
    },
    sessions: sessionBreakdown,
  };
}

export async function exportExamResultsCSV(
  examId: string,
  adminActorId: string,
  ipAddress?: string
): Promise<string> {
  const query = `
    SELECT 
      s.name AS session_name,
      e.title AS exam_title,
      sp.identifier,
      sp.full_name,
      sp.institution,
      se.status AS enrollment_status,
      r.score,
      r.passed,
      r.revision_no,
      r.published_at
    FROM results r
    JOIN attempts a ON a.id = r.attempt_id
    JOIN session_enrollments se ON se.id = a.enrollment_id
    JOIN student_profiles sp ON sp.user_id = se.student_id
    JOIN exam_sessions s ON s.id = se.session_id
    JOIN exams e ON e.id = s.exam_id
    WHERE e.id = $1 AND r.status = 'published'
    ORDER BY s.starts_at DESC, sp.identifier ASC;
  `;

  const { rows } = await pool.query(query, [examId]);

  const csvRows = rows.map((r) => ({
    sesi: sanitizeCsvValue(r.session_name),
    ujian: sanitizeCsvValue(r.exam_title),
    nomor_identitas: sanitizeCsvValue(r.identifier),
    nama: sanitizeCsvValue(r.full_name),
    instansi: sanitizeCsvValue(r.institution || 'Internal'),
    kehadiran: sanitizeCsvValue(r.enrollment_status),
    skor: sanitizeCsvValue(r.score),
    lulus: r.passed ? 'Ya' : 'Tidak',
    nomor_revisi: r.revision_no,
    tanggal_publikasi: r.published_at ? new Date(r.published_at).toISOString() : '',
  }));

  const csvOutput = stringify(csvRows, {
    header: true,
    columns: [
      'sesi',
      'ujian',
      'nomor_identitas',
      'nama',
      'instansi',
      'kehadiran',
      'skor',
      'lulus',
      'nomor_revisi',
      'tanggal_publikasi',
    ],
  });

  await logAudit({
    actorId: adminActorId,
    actorRole: 'admin',
    action: 'reports.export_csv',
    entityType: 'exams',
    entityId: examId,
    reason: `Exported ${csvRows.length} exam results across all sessions to CSV`,
    ipAddress,
  });

  return csvOutput;
}


export async function getExamItemAnalysis(examId: string) {
  // 1. Ambil info ujian
  const { rows: examRows } = await pool.query(
    `SELECT id, title, duration_minutes, passing_score, question_count
     FROM exams WHERE id = $1;`,
    [examId]
  );
  if (examRows.length === 0) throw new AppError('NOT_FOUND', 'Ujian tidak ditemukan');
  const exam = examRows[0];

  // 2. Statistik skor & kelulusan peserta pada ujian ini
  const { rows: examStats } = await pool.query(
    `SELECT 
       COUNT(r.id) AS total_examinees,
       COUNT(CASE WHEN r.passed = true THEN 1 END) AS passed_count,
       COALESCE(ROUND(AVG(r.score), 2), 0) AS avg_score,
       COALESCE(MAX(r.score), 0) AS max_score,
       COALESCE(MIN(r.score), 0) AS min_score,
       COALESCE(ROUND(STDDEV(r.score), 2), 0) AS std_dev
     FROM results r
     JOIN attempts a ON a.id = r.attempt_id
     JOIN session_enrollments se ON se.id = a.enrollment_id
     JOIN exam_sessions s ON s.id = se.session_id
     WHERE s.exam_id = $1 AND a.status IN ('submitted', 'auto_submitted', 'graded');`,
    [examId]
  );

  const totalExaminees = parseInt(examStats[0]?.total_examinees || '0', 10);
  const passedCount = parseInt(examStats[0]?.passed_count || '0', 10);
  const passRate = totalExaminees > 0 ? parseFloat(((passedCount / totalExaminees) * 100).toFixed(1)) : 0;

  // 3. Ambil daftar attempt id berurutan berdasarkan skor untuk kalkulasi Upper & Lower 27%
  const { rows: rankedAttempts } = await pool.query(
    `SELECT a.id, r.score
     FROM attempts a
     JOIN results r ON r.attempt_id = a.id
     JOIN session_enrollments se ON se.id = a.enrollment_id
     JOIN exam_sessions s ON s.id = se.session_id
     WHERE s.exam_id = $1 AND a.status IN ('submitted', 'auto_submitted', 'graded')
     ORDER BY r.score DESC;`,
    [examId]
  );

  const groupSize = Math.max(1, Math.floor(rankedAttempts.length * 0.27));
  const upperAttemptIds = new Set(rankedAttempts.slice(0, groupSize).map((r) => r.id));
  const lowerAttemptIds = new Set(rankedAttempts.slice(-groupSize).map((r) => r.id));

  // 4. Ambil semua soal yang diujikan dalam ujian ini (melalui attempt_questions)
  const { rows: questionsRows } = await pool.query(
    `SELECT DISTINCT
       qv.id AS question_version_id,
       q.id AS question_id,
       SUBSTRING(q.id::text, 1, 8) AS question_code,
       qv.stem,
       qv.difficulty AS intended_difficulty,
       qv.weight,
       qc.name AS subtest_name,
       qc.name AS category_name
     FROM attempt_questions aq
     JOIN attempts a ON a.id = aq.attempt_id
     JOIN session_enrollments se ON se.id = a.enrollment_id
     JOIN exam_sessions s ON s.id = se.session_id
     JOIN question_versions qv ON qv.id = aq.question_version_id
     JOIN questions q ON q.id = qv.question_id
     LEFT JOIN question_categories qc ON qc.id = q.category_id
     WHERE s.exam_id = $1
     ORDER BY q.id ASC;`,
    [examId]
  );

  // Jika belum ada attempt, coba ambil soal dari aturan komposisi / question bank
  let targetQuestions = questionsRows;
  if (targetQuestions.length === 0) {
    const { rows: fallbackQuestions } = await pool.query(
      `SELECT 
         qv.id AS question_version_id,
         q.id AS question_id,
         SUBSTRING(q.id::text, 1, 8) AS question_code,
         qv.stem,
         qv.difficulty AS intended_difficulty,
         qv.weight,
         qc.name AS subtest_name,
         qc.name AS category_name
       FROM exam_question_rules eqr
       JOIN questions q ON q.category_id = eqr.category_id
       JOIN question_versions qv ON qv.question_id = q.id AND qv.version_number = (
         SELECT MAX(version_number) FROM question_versions WHERE question_id = q.id
       )
       LEFT JOIN question_categories qc ON qc.id = q.category_id
       WHERE eqr.exam_id = $1 AND q.status = 'active'
       LIMIT 50;`,
      [examId]
    );
    targetQuestions = fallbackQuestions;
  }

  // 5. Untuk setiap soal, ambil agregat jawaban dan distribusi opsi
  const itemsAnalysis = await Promise.all(
    targetQuestions.map(async (q) => {
      // Ambil opsi jawaban soal
      const { rows: options } = await pool.query(
        `SELECT id, position, option_text, is_correct
         FROM question_options
         WHERE question_version_id = $1
         ORDER BY position ASC;`,
        [q.question_version_id]
      );

      // Ambil seluruh jawaban untuk versi soal ini pada ujian ini
      const { rows: answers } = await pool.query(
        `SELECT 
           ans.selected_option_id,
           ans.is_correct,
           aq.attempt_id
         FROM attempt_answers ans
         JOIN attempt_questions aq ON aq.id = ans.attempt_question_id
         JOIN attempts a ON a.id = aq.attempt_id
         JOIN session_enrollments se ON se.id = a.enrollment_id
         JOIN exam_sessions s ON s.id = se.session_id
         WHERE s.exam_id = $1 AND ans.question_version_id = $2 AND ans.selected_option_id IS NOT NULL;`,
        [examId, q.question_version_id]
      );

      const totalAnswered = answers.length;
      const correctCount = answers.filter((a) => a.is_correct).length;
      const difficultyIndex = totalAnswered > 0 ? parseFloat((correctCount / totalAnswered).toFixed(2)) : 0;

      // Kategori Tingkat Kesulitan Empiris (P)
      let difficultyCategory = 'Sedang';
      if (difficultyIndex >= 0.7) {
        difficultyCategory = 'Mudah';
      } else if (difficultyIndex < 0.3) {
        difficultyCategory = 'Sukar';
      }

      // Daya Pembeda (D)
      let discriminationIndex = 0;
      let discriminationCategory = 'Belum Ada Data';

      if (rankedAttempts.length >= 4 && groupSize > 0) {
        const upperCorrect = answers.filter((a) => upperAttemptIds.has(a.attempt_id) && a.is_correct).length;
        const lowerCorrect = answers.filter((a) => lowerAttemptIds.has(a.attempt_id) && a.is_correct).length;
        discriminationIndex = parseFloat(((upperCorrect - lowerCorrect) / groupSize).toFixed(2));

        if (discriminationIndex >= 0.4) {
          discriminationCategory = 'Sangat Baik';
        } else if (discriminationIndex >= 0.3) {
          discriminationCategory = 'Baik';
        } else if (discriminationIndex >= 0.2) {
          discriminationCategory = 'Cukup / Perlu Revisi';
        } else {
          discriminationCategory = 'Buruk / Diskualifikasi';
        }
      }

      // Distribusi Opsi & Analisis Distractor
      const optionStats = options.map((opt) => {
        const count = answers.filter((a) => a.selected_option_id === opt.id).length;
        const percentage = totalAnswered > 0 ? parseFloat(((count / totalAnswered) * 100).toFixed(1)) : 0;
        const isDistractorFunctioning = opt.is_correct ? true : percentage >= 5;

        return {
          id: opt.id,
          position: opt.position,
          label: String.fromCharCode(64 + opt.position),
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          selection_count: count,
          selection_percentage: percentage,
          is_functioning: isDistractorFunctioning,
        };
      });

      // Rekomendasi Soal
      const recommendations: string[] = [];
      if (totalAnswered > 5) {
        if (discriminationIndex < 0.2) {
          recommendations.push('Daya pembeda rendah; periksa kejelasan stem atau distraktor.');
        }
        const nonFunctioningDistractors = optionStats.filter((o) => !o.is_correct && !o.is_functioning);
        if (nonFunctioningDistractors.length > 0) {
          recommendations.push(
            `Opsi pengecoh (${nonFunctioningDistractors.map((o) => o.label).join(', ')}) kurang efektif (<5% pemilih).`
          );
        }
        if (difficultyIndex < 0.15) {
          recommendations.push('Soal tergolong sangat sukar; evaluasi redaksi soal.');
        } else if (difficultyIndex > 0.85) {
          recommendations.push('Soal tergolong sangat mudah; hampir seluruh peserta menjawab benar.');
        }
      }
      if (recommendations.length === 0) {
        recommendations.push('Butir soal berkualitas baik dan memenuhi standar psikometri.');
      }

      return {
        question_id: q.question_id,
        question_version_id: q.question_version_id,
        question_code: q.question_code,
        subtest_name: q.subtest_name,
        category_name: q.category_name,
        stem: q.stem,
        intended_difficulty: q.intended_difficulty,
        empirical_difficulty: difficultyIndex,
        difficulty_category: difficultyCategory,
        discrimination_index: discriminationIndex,
        discrimination_category: discriminationCategory,
        weight: q.weight,
        total_answered: totalAnswered,
        correct_count: correctCount,
        options: optionStats,
        recommendations,
      };
    })
  );

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      duration_minutes: exam.duration_minutes,
      passing_score: exam.passing_score,
      question_count: exam.question_count,
    },
    statistics: {
      total_examinees: totalExaminees,
      passed_count: passedCount,
      pass_rate_percentage: passRate,
      average_score: parseFloat(examStats[0]?.avg_score || '0'),
      max_score: parseFloat(examStats[0]?.max_score || '0'),
      min_score: parseFloat(examStats[0]?.min_score || '0'),
      std_deviation: parseFloat(examStats[0]?.std_dev || '0'),
    },
    total_items: itemsAnalysis.length,
    items: itemsAnalysis,
  };
}
