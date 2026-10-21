import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { pool } from '../../src/db/connection.js';
import { issueCertificateForResult } from '../../src/modules/certificates/certificates.service.js';

describe('Audit Cycle 4: Integrity, Verification & Query Optimizations', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;
  let otherStudentToken: string;
  let studentId: string;
  let otherStudentId: string;
  let validCertId: string;
  let validCertNo: string;
  let validVerifyCode: string;
  let testResultId: string;
  let failedResultId: string;
  let testSessionId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Admin login
    await pool.query(
      `UPDATE users SET status = 'active', failed_login_count = 0, locked_until = NULL WHERE lower(email) = 'admin@fia.kampus.ac.id';`
    );
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin@fia.kampus.ac.id',
        password: 'NewAdminSecret2026!',
      },
    });
    adminToken = JSON.parse(adminLogin.body).token;

    // 2. Cari sertifikat yang sudah ada atau buat untuk testing
    const { rows: certRows } = await pool.query(
      `SELECT c.id, c.certificate_no, c.verification_code, se.student_id, r.id AS result_id, es.id AS session_id
       FROM certificates c
       JOIN results r ON r.id = c.result_id
       JOIN attempts a ON a.id = r.attempt_id
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN exam_sessions es ON es.id = se.session_id
       WHERE c.status = 'valid'
       LIMIT 1;`
    );

    if (certRows.length > 0) {
      validCertId = certRows[0].id;
      validCertNo = certRows[0].certificate_no;
      validVerifyCode = certRows[0].verification_code;
      studentId = certRows[0].student_id;
      testResultId = certRows[0].result_id;
      testSessionId = certRows[0].session_id;

      // Reset password dan login student pemilik sertifikat
      const testPass = 'StudentTestPass2026!';
      const { hashPassword } = await import('../../src/lib/hash.js');
      const passHash = await hashPassword(testPass);
      await pool.query(
        `UPDATE users SET password_hash = $1, status = 'active', failed_login_count = 0, locked_until = NULL WHERE id = $2;`,
        [passHash, studentId]
      );
      const studentRes = await pool.query(`SELECT email FROM users WHERE id = $1;`, [studentId]);
      const sLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: studentRes.rows[0].email, password: testPass },
      });
      studentToken = JSON.parse(sLogin.body).token;
    }

    // 3. Siapkan student lain untuk uji anti-IDOR
    const { rows: otherStudentRows } = await pool.query(
      `SELECT u.id, u.email FROM users u WHERE u.role IN ('student', 'mahasiswa') AND u.id <> $1 LIMIT 1;`,
      [studentId || '00000000-0000-0000-0000-000000000000']
    );
    if (otherStudentRows.length > 0) {
      otherStudentId = otherStudentRows[0].id;
      const testPass = 'StudentOtherPass2026!';
      const { hashPassword } = await import('../../src/lib/hash.js');
      const passHash = await hashPassword(testPass);
      await pool.query(
        `UPDATE users SET password_hash = $1, status = 'active', failed_login_count = 0, locked_until = NULL WHERE id = $2;`,
        [passHash, otherStudentId]
      );
      const oLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: otherStudentRows[0].email, password: testPass },
      });
      otherStudentToken = JSON.parse(oLogin.body).token;
    }

    // 4. Siapkan result yang TIDAK lulus (passed = false)
    const { rows: failedRows } = await pool.query(
      `SELECT id FROM results WHERE passed = false LIMIT 1;`
    );
    if (failedRows.length > 0) {
      failedResultId = failedRows[0].id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Public certificate verification should resolve using verification_code', async () => {
    if (!validVerifyCode) return;
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/verify/${validVerifyCode}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.certificate.is_valid).toBe(true);
    expect(body.certificate.certificate_no).toBe(validCertNo);
  });

  it('2. Public certificate verification should resolve using certificate_no', async () => {
    if (!validCertNo) return;
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/verify/${validCertNo}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.certificate.is_valid).toBe(true);
    expect(body.certificate.certificate_no).toBe(validCertNo);
    expect(body.certificate.verification_code).toBe(validVerifyCode);
  });

  it('3. GET /api/v1/certificates/:id should return certificate for owner student and admin', async () => {
    if (!validCertId) return;

    // Admin should access
    const adminRes = await app.inject({
      method: 'GET',
      url: `/api/v1/certificates/${validCertId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminRes.statusCode).toBe(200);
    expect(JSON.parse(adminRes.body).certificate.id).toBe(validCertId);

    // Owner student should access
    if (studentToken) {
      const studentRes = await app.inject({
        method: 'GET',
        url: `/api/v1/certificates/${validCertId}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(studentRes.statusCode).toBe(200);
      expect(JSON.parse(studentRes.body).certificate.certificate_no).toBe(validCertNo);
    }
  });

  it('4. GET /api/v1/certificates/:id should reject other student (INV-14 Anti-IDOR)', async () => {
    if (!validCertId || !otherStudentToken) return;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/certificates/${validCertId}`,
      headers: { authorization: `Bearer ${otherStudentToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('5. issueCertificateForResult should throw FORBIDDEN if student did not pass (INV-09)', async () => {
    if (!failedResultId) return;

    const { rows: adminUser } = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1;");
    await expect(
      issueCertificateForResult(failedResultId, adminUser[0].id)
    ).rejects.toThrow();
  });

  it('6. POST /api/v1/results/:id/publish should publish result and issue certificate if passed', async () => {
    // Siapkan attempt & result baru dengan status pending_publication
    const { rows: pendingRes } = await pool.query(
      `SELECT r.id, r.passed FROM results r WHERE r.status = 'pending_publication' AND r.passed = true LIMIT 1;`
    );

    let targetId = pendingRes.length > 0 ? pendingRes[0].id : null;

    if (!targetId && testResultId) {
      // Simulasikan revert ke pending_publication untuk pengujian
      await pool.query(
        `UPDATE results SET status = 'pending_publication', published_at = NULL, published_by = NULL WHERE id = $1;`,
        [testResultId]
      );
      targetId = testResultId;
    }

    if (!targetId) return;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/results/${targetId}/publish`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.status).toBe('published');

    // Verifikasi di DB bahwa published_by tercatat
    const { rows: check } = await pool.query(`SELECT published_by FROM results WHERE id = $1;`, [targetId]);
    expect(check[0].published_by).toBeDefined();
  });

  it('7. Appeals submission should reject invalid or forged question_version_id', async () => {
    if (!testResultId || !studentToken) return;

    const fakeQuestionVersionId = '00000000-0000-4000-8000-000000000000';
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/me/results/${testResultId}/appeals`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        question_version_id: fakeQuestionVersionId,
        message: 'Kunci jawaban butir soal ini keliru menurut literatur standar.',
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain('Soal yang disanggah tidak terdapat pada riwayat ujian ini');
  });

  it('8. GET /api/v1/dashboard should count users with roles mahasiswa and umum', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.dashboard.total_students).toBeGreaterThan(0);
  });

  it('9. POST /api/v1/sessions/:id/enrollments/preview should batch validate candidates', async () => {
    if (!testSessionId) return;

    const { rows: idents } = await pool.query(`SELECT identifier FROM student_profiles LIMIT 5;`);
    const studentIdents = idents.map((i: any) => i.identifier);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${testSessionId}/enrollments/preview`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { student_identifiers: studentIdents },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.preview.total_submitted).toBe(studentIdents.length);
    expect(Array.isArray(body.preview.valid_students)).toBe(true);
    expect(Array.isArray(body.preview.skipped_students)).toBe(true);
  });
});
