import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { pool } from '../../src/db/connection.js';

describe('CAT GOVERNANCE Integration Test Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('1. GET /health should return 200 and database timestamp', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('UP');
    expect(body.timestamp).toBeDefined();
    expect(body.clock).toBeDefined();
    expect(body.clock.is_synced).toBe(true);
    expect(body.database).toBeDefined();
    expect(body.database.pool.max).toBeGreaterThanOrEqual(20);
  });

  it('2. POST /api/v1/auth/login and change password (FR-A01, FR-A03)', async () => {
    // Reset failed login count if any
    await pool.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE lower(email) = 'admin@fia.kampus.ac.id';`
    );

    // Try login with initial seed password, or changed password if already run
    let loginPassword = 'AdminPassword123!';
    let res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin@fia.kampus.ac.id',
        password: loginPassword,
      },
    });

    if (res.statusCode === 401) {
      loginPassword = 'NewAdminSecret2026!';
      res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'admin@fia.kampus.ac.id',
          password: loginPassword,
        },
      });
    }

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.user.role).toBe('admin');

    adminToken = body.token;
    adminUserId = body.user.id;

    // If must_change_password is true, fulfill FR-A03 requirement
    if (body.user.must_change_password) {
      const changeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/password',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          old_password: loginPassword,
          new_password: 'NewAdminSecret2026!',
        },
      });
      expect(changeRes.statusCode).toBe(200);

      // Re-login with new password to get fresh session
      const reLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'admin@fia.kampus.ac.id',
          password: 'NewAdminSecret2026!',
        },
      });
      expect(reLogin.statusCode).toBe(200);
      const reBody = JSON.parse(reLogin.body);
      adminToken = reBody.token;
    }
  });

  it('3. INV-21: LAST_ADMIN guard should prevent suspending the last active administrator', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${adminUserId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        status: 'suspended',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('LAST_ADMIN');
  });

  it('4. Full Exam Lifecycle: Category -> Question -> Exam -> Session -> Student Take -> Grade -> Cert -> Verify', async () => {
    // A. Buat peserta baru (FR-U03)
    const testIdentifier = `IDENT-${Date.now().toString().slice(-6)}`;
    const studentCreateRes = await app.inject({
      method: 'POST',
      url: '/api/v1/students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        identifier: testIdentifier,
        full_name: 'Budi Santoso Mahasiswa',
        email: `budi.${Date.now()}@fia.kampus.ac.id`,
        institution: 'FIA Internal',
        phone: '08123456789',
      },
    });

    expect(studentCreateRes.statusCode).toBe(201);
    const studentData = JSON.parse(studentCreateRes.body);
    const studentPassword = studentData.initial_password;
    expect(studentPassword).toBeDefined();

    // B. Peserta login menggunakan Nomor Identitas (FR-A01)
    const studentLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: testIdentifier,
        password: studentPassword,
      },
    });

    expect(studentLoginRes.statusCode).toBe(200);
    const studentAuth = JSON.parse(studentLoginRes.body);
    let studentToken = studentAuth.token;

    // Mahasiswa ganti kata sandi pertama kali (FR-A03)
    const stChange = await app.inject({
      method: 'POST',
      url: '/api/v1/me/password',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        old_password: studentPassword,
        new_password: 'StudentSecret2026!',
      },
    });
    expect(stChange.statusCode).toBe(200);

    // Login ulang dengan kata sandi baru
    const stReLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: testIdentifier,
        password: 'StudentSecret2026!',
      },
    });
    expect(stReLogin.statusCode).toBe(200);
    studentToken = JSON.parse(stReLogin.body).token;

    // C. Buat Kategori Soal (FR-Q01)
    const catRes = await app.inject({
      method: 'POST',
      url: '/api/v1/question-categories',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: `Kebijakan Publik ${Date.now().toString().slice(-4)}`,
        description: 'Uji kompetensi perumusan kebijakan',
      },
    });
    expect(catRes.statusCode).toBe(201);
    const category = JSON.parse(catRes.body).category;

    // D. Buat Soal Berbobot dengan 4 Opsi (FR-Q02)
    const qRes = await app.inject({
      method: 'POST',
      url: '/api/v1/questions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        category_id: category.id,
        stem: 'Tahap pertama dalam siklus kebijakan publik adalah...',
        difficulty: 1,
        weight: 10.0,
        status: 'active',
        options: [
          { position: 1, option_text: 'Evaluasi kebijakan', is_correct: false },
          { position: 2, option_text: 'Penyusunan agenda (Agenda setting)', is_correct: true },
          { position: 3, option_text: 'Implementasi kebijakan', is_correct: false },
          { position: 4, option_text: 'Adopsi kebijakan', is_correct: false },
        ],
      },
    });
    expect(qRes.statusCode).toBe(201);

    // E. Buat Ujian (FR-E01)
    const examCode = `EXAM-${Date.now().toString().slice(-5)}`;
    const examRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exams',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: examCode,
        title: 'Uji Kompetensi Analisis Kebijakan',
        duration_minutes: 60,
        question_count: 1,
        passing_score: 70.0,
        allow_review: true,
        status: 'active',
      },
    });
    expect(examRes.statusCode).toBe(201);
    const exam = JSON.parse(examRes.body).exam;

    // F. Tambah Aturan Komposisi Soal (FR-E02)
    const ruleRes = await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${exam.id}/rules`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        category_id: category.id,
        difficulty: 1,
        question_count: 1,
      },
    });
    expect(ruleRes.statusCode).toBe(201);

    // G. Buat Sesi Ujian (FR-S01)
    const sessionCode = `SESI-${Date.now().toString().slice(-5)}`;
    const startsAt = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 menit lalu
    const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 jam ke depan

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        exam_id: exam.id,
        code: sessionCode,
        name: 'Sesi 1 Ujian Reguler',
        starts_at: startsAt,
        ends_at: endsAt,
        capacity: 100,
      },
    });
    expect(sessionRes.statusCode).toBe(201);
    const session = JSON.parse(sessionRes.body).session;

    // H. Publikasikan Sesi (FR-S02)
    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${session.id}/publish`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(pubRes.statusCode).toBe(200);

    // I. Daftarkan Mahasiswa ke Sesi (FR-S04)
    const enrollRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${session.id}/enrollments`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        student_identifiers: [testIdentifier],
      },
    });
    expect(enrollRes.statusCode).toBe(200);
    const enrollBody = JSON.parse(enrollRes.body);
    expect(enrollBody.enrolled).toBe(1);

    // J. Mahasiswa Mulai Ujian (FR-T03)
    const startRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${session.id}/start`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(startRes.statusCode).toBe(200);
    const startBody = JSON.parse(startRes.body);
    const attemptId = startBody.attempt_id;
    expect(attemptId).toBeDefined();

    // K. Mahasiswa Ambil Daftar Soal (FR-T04, INV-15)
    const qListRes = await app.inject({
      method: 'GET',
      url: `/api/v1/attempts/${attemptId}/questions`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(qListRes.statusCode).toBe(200);
    const questionsBody = JSON.parse(qListRes.body);
    expect(questionsBody.questions).toHaveLength(1);

    // INV-15 Verifikasi: is_correct TIDAK ADA pada respons mahasiswa saat ujian
    const qItem = questionsBody.questions[0];
    expect(qItem.is_correct).toBeUndefined();
    expect(qItem.options[0].is_correct).toBeUndefined();

    // Dapatkan ID opsi jawaban yang benar (Penyusunan agenda)
    const correctOpt = qItem.options.find((o: any) => o.text.includes('agenda'));
    expect(correctOpt).toBeDefined();

    // L. Mahasiswa Simpan Jawaban (FR-T05, INV-07)
    const ansRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/attempts/${attemptId}/answers/1`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        selected_option_id: correctOpt.id,
        is_flagged: false,
        client_seq: 1,
      },
    });
    expect(ansRes.statusCode).toBe(200);

    // M. Mahasiswa Kumpul Ujian (FR-T09)
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/v1/attempts/${attemptId}/submit`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        reason: 'manual',
      },
    });
    expect(submitRes.statusCode).toBe(200);

    // N. INV-14 Anti-IDOR: Hasil belum dipublikasikan tidak boleh dapat dilihat
    const meResBeforePub = await app.inject({
      method: 'GET',
      url: '/api/v1/me/results',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(meResBeforePub.statusCode).toBe(200);
    expect(JSON.parse(meResBeforePub.body).data).toHaveLength(0); // Masih 0 karena belum publish

    // O. Admin Publikasikan Hasil Sesi & Penerbitan Sertifikat (FR-R02, FR-C01)
    const pubResultsRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${session.id}/publish-results`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(pubResultsRes.statusCode).toBe(200);
    const pubResultData = JSON.parse(pubResultsRes.body);
    expect(pubResultData.published_count).toBe(1);
    expect(pubResultData.certificates_issued).toBe(1);

    // P. Mahasiswa Lihat Hasil & Sertifikat (FR-R03, FR-C02)
    const meResAfterPub = await app.inject({
      method: 'GET',
      url: '/api/v1/me/results',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(meResAfterPub.statusCode).toBe(200);
    const studentResults = JSON.parse(meResAfterPub.body).data;
    expect(studentResults).toHaveLength(1);
    expect(studentResults[0].passed).toBe(true);
    expect(parseFloat(studentResults[0].score)).toBe(100.0);

    const certVerifyCode = studentResults[0].verification_code;
    expect(certVerifyCode).toBeDefined();

    // Q. Verifikasi Publik Sertifikat Tanpa Login (FR-C03)
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/verify/${certVerifyCode}`,
    });
    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.body);
    expect(verifyBody.certificate.is_valid).toBe(true);
    expect(verifyBody.certificate.recipient.name).toBe('Budi Santoso Mahasiswa');
    expect(verifyBody.certificate.exam.passed).toBe(true);
    expect(parseFloat(verifyBody.certificate.exam.score)).toBe(100.0);
  });
});
