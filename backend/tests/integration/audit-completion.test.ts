import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { pool } from '../../src/db/connection.js';

describe('Audit Completion: Endpoints & Business Logic Validation', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;
  let studentUserId: string;
  let testResultId: string;
  let testExamId: string;
  let testQuestionId: string;
  let testVersionId: string;
  let testSessionId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Admin login
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin@fia.kampus.ac.id',
        password: 'NewAdminSecret2026!',
      },
    });
    adminToken = JSON.parse(adminLogin.body).token;

    // 2. Cari atau siapkan satu published result untuk pengujian sanggah & laporan
    const { rows: results } = await pool.query(
      `SELECT r.id AS result_id, r.score, r.passed, se.student_id, u.email, es.id AS session_id, e.id AS exam_id
       FROM results r
       JOIN attempts a ON a.id = r.attempt_id
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN users u ON u.id = se.student_id
       JOIN exam_sessions es ON es.id = se.session_id
       JOIN exams e ON e.id = es.exam_id
       WHERE r.status = 'published'
       LIMIT 1;`
    );

    if (results.length > 0) {
      testResultId = results[0].result_id;
      testExamId = results[0].exam_id;
      testSessionId = results[0].session_id;
      studentUserId = results[0].student_id;

      // Login as student
      const studentLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: results[0].email,
          password: 'StudentSecret2026!',
        },
      });
      if (studentLogin.statusCode === 200) {
        studentToken = JSON.parse(studentLogin.body).token;
      }
    }

    // Ambil question version untuk pengujian
    const { rows: qv } = await pool.query(
      `SELECT q.id AS question_id, qv.id AS version_id
       FROM questions q
       JOIN question_versions qv ON qv.id = q.current_version_id
       LIMIT 1;`
    );
    if (qv.length > 0) {
      testQuestionId = qv[0].question_id;
      testVersionId = qv[0].version_id;
    }
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('1. GET /api/v1/questions/:id/preview should return formatted preview (FR-Q07)', async () => {
    if (!testQuestionId) return;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/questions/${testQuestionId}/preview`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.question).toBeDefined();
    expect(body.question.stem).toBeDefined();
    expect(body.question.options).toBeInstanceOf(Array);
    expect(body.question.options[0].label).toBe('A');
  });

  it('2. POST /api/v1/question-versions/:id/corrections/preview should simulate score impact without committing (FR-Q08)', async () => {
    if (!testVersionId) return;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/question-versions/${testVersionId}/corrections/preview`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        type: 'annulled',
        reason: 'Soal memiliki ambiguitas redaksional',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.preview).toBeDefined();
    expect(body.preview.total_evaluated_attempts).toBeDefined();
    expect(body.preview.students_improved).toBeDefined();
  });

  it('3. PATCH /api/v1/exams/:id/rules/:ruleId should update question count (FR-E02)', async () => {
    if (!testExamId) return;

    // Ambil sebuah rule dari exam
    const { rows: rules } = await pool.query(
      'SELECT id, question_count FROM exam_question_rules WHERE exam_id = $1 LIMIT 1;',
      [testExamId]
    );

    if (rules.length > 0) {
      const ruleId = rules[0].id;
      // Periksa apakah ujian terkunci
      const { rows: lockCheck } = await pool.query(
        `SELECT COUNT(*) AS count FROM exam_sessions WHERE exam_id = $1 AND status = 'published';`,
        [testExamId]
      );
      const isLocked = parseInt(lockCheck[0].count, 10) > 0;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/exams/${testExamId}/rules/${ruleId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          question_count: 2,
        },
      });

      if (isLocked) {
        // Harus ditolak dengan CONFIG_LOCKED (INV-10)
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error.code).toBe('CONFIG_LOCKED');
      } else {
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).rule.question_count).toBe(2);
      }
    }
  });

  it('4. POST /api/v1/sessions/:id/enrollments/preview should preview enrollment without writing (FR-S04)', async () => {
    if (!testSessionId) return;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${testSessionId}/enrollments/preview`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        student_identifiers: ['NON_EXISTENT_ID_999999'],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.preview.total_submitted).toBe(1);
    expect(body.preview.skipped_count).toBe(1);
    expect(body.preview.skipped_students[0].reason).toContain('tidak ditemukan');
  });

  it('5. GET /api/v1/reports/exams/:id and /export should aggregate exam stats and generate CSV (FR-L02, FR-L03)', async () => {
    if (!testExamId) return;

    // Report API
    const reportRes = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/exams/${testExamId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(reportRes.statusCode).toBe(200);
    const reportBody = JSON.parse(reportRes.body);
    expect(reportBody.metrics.total_completed).toBeDefined();
    expect(reportBody.metrics.score_distribution).toBeDefined();

    // Export CSV API
    const exportRes = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/exams/${testExamId}/export`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/csv');
    expect(exportRes.body).toContain('sesi,ujian,nomor_identitas,nama,instansi');
  });

  it('6. Sanggah & Notifikasi Workflow (FR-R07, FR-N01)', async () => {
    if (!studentToken || !testResultId) return;

    // A. Mahasiswa ajukan sanggah (POST /me/results/:id/appeals)
    const appealRes = await app.inject({
      method: 'POST',
      url: `/api/v1/me/results/${testResultId}/appeals`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        message: 'Mohon peninjauan ulang butir soal nomor 1 karena kunci jawaban memiliki kemiripan.',
      },
    });

    expect(appealRes.statusCode).toBe(201);
    const appeal = JSON.parse(appealRes.body).appeal;
    expect(appeal.status).toBe('open');

    // B. Admin melihat daftar sanggah (GET /appeals)
    const listAppeals = await app.inject({
      method: 'GET',
      url: '/api/v1/appeals',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listAppeals.statusCode).toBe(200);
    const appealsData = JSON.parse(listAppeals.body).data;
    expect(appealsData.length).toBeGreaterThan(0);

    // C. Admin menanggapi sanggah (PATCH /appeals/:id)
    const respondRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/appeals/${appeal.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        status: 'accepted',
        response: 'Sanggahan diterima. Butir soal nomor 1 telah dikoreksi pada kunci jawaban.',
      },
    });
    expect(respondRes.statusCode).toBe(200);
    expect(JSON.parse(respondRes.body).appeal.status).toBe('accepted');

    // D. Mahasiswa menerima notifikasi in-app (GET /notifications)
    const notifRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(notifRes.statusCode).toBe(200);
    const notifs = JSON.parse(notifRes.body).data;
    expect(notifs.length).toBeGreaterThan(0);
    const appealNotif = notifs.find((n: any) => n.entity_type === 'appeals' && n.entity_id === appeal.id);
    expect(appealNotif).toBeDefined();

    // E. Mahasiswa tandai notifikasi sudah dibaca (PATCH /notifications/:id/read)
    const readRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${appealNotif.id}/read`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(readRes.statusCode).toBe(200);
    expect(JSON.parse(readRes.body).notification.read_at).toBeDefined();
  });
});
