import { stringify } from 'csv-stringify/sync';
import { pool } from '../../db/connection.js';
import { AppError } from '../../lib/errors.js';
import { logAudit } from '../audit/audit.service.js';

export async function getDashboardMetrics() {
  const { rows: studentCount } = await pool.query(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'student' AND deleted_at IS NULL;"
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

