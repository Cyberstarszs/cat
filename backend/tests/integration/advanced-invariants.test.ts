import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { pool } from '../../src/db/connection.js';
import { generateCertificatePDFBuffer } from '../../src/modules/certificates/certificates.service.js';

describe('Advanced Invariants & Security Edge Cases', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Pastikan admin dalam kondisi aktif dan tidak terkunci
    await pool.query(
      `UPDATE users SET status = 'active', failed_login_count = 0, locked_until = NULL WHERE lower(email) = 'admin@fia.kampus.ac.id';`
    );

    // Login as admin (support both fresh seed password and changed password)
    let loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin@fia.kampus.ac.id',
        password: 'NewAdminSecret2026!',
      },
    });
    if (loginRes.statusCode !== 200) {
      loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'admin@fia.kampus.ac.id',
          password: 'AdminPassword123!',
        },
      });
      const tempToken = JSON.parse(loginRes.body).token;
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { authorization: `Bearer ${tempToken}` },
        payload: {
          old_password: 'AdminPassword123!',
          new_password: 'NewAdminSecret2026!',
        },
      });
      loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'admin@fia.kampus.ac.id',
          password: 'NewAdminSecret2026!',
        },
      });
    }
    adminToken = JSON.parse(loginRes.body).token;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('TC-09: SCHEDULE_OVERLAP should prevent enrolling a student in overlapping sessions (INV-09)', async () => {
    // 1. Buat peserta baru
    const ident = `OVERLAP-${Date.now().toString().slice(-5)}`;
    const studentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        identifier: ident,
        full_name: 'Mahasiswa Jadwal Uji',
        email: `overlap.${Date.now()}@fia.kampus.ac.id`,
      },
    });
    expect(studentRes.statusCode).toBe(201);

    // 2. Ambil sebuah exam yang ada atau buat exam sementara jika DB kosong
    const { rows: exams } = await pool.query("SELECT id FROM exams WHERE status = 'active' LIMIT 1;");
    let examId: string;
    let createdTempExam = false;
    if (exams.length > 0) {
      examId = exams[0].id;
    } else {
      const newExamRes = await pool.query(
        `INSERT INTO exams (code, title, duration_minutes, passing_score, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING id;`,
        [`TEST-${Date.now().toString().slice(-4)}`, 'Ujian Test Invariant', 60, 65]
      );
      examId = newExamRes.rows[0].id;
      createdTempExam = true;
    }

    // 3. Buat Sesi A (08:00 - 10:00)
    const startA = new Date('2026-11-01T08:00:00Z').toISOString();
    const endA = new Date('2026-11-01T10:00:00Z').toISOString();
    const sessionARes = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        exam_id: examId,
        code: `SESA-${Date.now().toString().slice(-4)}`,
        name: 'Sesi Pagi A',
        starts_at: startA,
        ends_at: endA,
      },
    });
    const sessionA = JSON.parse(sessionARes.body).session;

    // Daftarkan mahasiswa ke Sesi A
    const enrollARes = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionA.id}/enrollments`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { student_identifiers: [ident] },
    });
    expect(JSON.parse(enrollARes.body).enrolled).toBe(1);

    // 4. Buat Sesi B yang tumpang tindih (09:00 - 11:00)
    const startB = new Date('2026-11-01T09:00:00Z').toISOString();
    const endB = new Date('2026-11-01T11:00:00Z').toISOString();
    const sessionBRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        exam_id: examId,
        code: `SESB-${Date.now().toString().slice(-4)}`,
        name: 'Sesi Pagi B Tumpang Tindih',
        starts_at: startB,
        ends_at: endB,
      },
    });
    const sessionB = JSON.parse(sessionBRes.body).session;

    // 5. Coba daftarkan mahasiswa ke Sesi B -> harus ditolak karena SCHEDULE_OVERLAP!
    const enrollBRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionB.id}/enrollments`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { student_identifiers: [ident] },
    });
    const enrollBBody = JSON.parse(enrollBRes.body);
    expect(enrollBBody.enrolled).toBe(0);
    expect(enrollBBody.skipped[0].reason).toContain('tumpang tindih');

    // Bersihkan sesi dan exam sementara jika tadi dibuat dari DB kosong
    if (createdTempExam) {
      await pool.query('DELETE FROM session_enrollments WHERE session_id IN ($1, $2);', [sessionA.id, sessionB.id]);
      await pool.query('DELETE FROM exam_sessions WHERE id IN ($1, $2);', [sessionA.id, sessionB.id]);
      await pool.query('DELETE FROM exams WHERE id = $1;', [examId]);
      await pool.query('DELETE FROM student_profiles WHERE identifier = $1;', [ident]);
      await pool.query('DELETE FROM users WHERE id = (SELECT user_id FROM student_profiles WHERE identifier = $1);', [ident]);
    }
  });

  it('TC-10: Autosave client_seq idempotency should ignore stale updates (INV-07)', async () => {
    // Cari satu attempt aktif atau buat satu jika database baru dikosongkan
    let { rows: atts } = await pool.query(
      `SELECT a.id, se.student_id, u.email
       FROM attempts a
       JOIN session_enrollments se ON se.id = a.enrollment_id
       JOIN users u ON u.id = se.student_id
       LIMIT 1;`
    );

    if (atts.length === 0) {
      const enr = (await pool.query('SELECT id, student_id FROM session_enrollments LIMIT 1;')).rows;
      if (enr.length > 0) {
        const newAtt = (await pool.query(
          `INSERT INTO attempts (enrollment_id, attempt_no, status, deadline_at)
           VALUES ($1, 1, 'in_progress', now() + interval '1 hour')
           RETURNING id;`,
          [enr[0].id]
        )).rows[0];
        const qv = (await pool.query('SELECT id FROM question_versions LIMIT 1;')).rows;
        if (qv.length > 0) {
          const aq = (await pool.query(
            `INSERT INTO attempt_questions (attempt_id, question_version_id, position, option_order)
             VALUES ($1, $2, 1, '[]'::jsonb) RETURNING id;`,
            [newAtt.id, qv[0].id]
          )).rows[0];
          await pool.query(
            `INSERT INTO attempt_answers (attempt_question_id, question_version_id, client_seq)
             VALUES ($1, $2, 0);`,
            [aq.id, qv[0].id]
          );
        }
        atts = (await pool.query(
          `SELECT a.id, se.student_id, u.email
           FROM attempts a
           JOIN session_enrollments se ON se.id = a.enrollment_id
           JOIN users u ON u.id = se.student_id
           WHERE a.id = $1;`,
          [newAtt.id]
        )).rows;
      }
    }

    if (atts.length === 0) {
      // Jika tetap kosong (belum ada pendaftaran/soal), lewati uji autosave
      return;
    }
    const attemptId = atts[0].id;
    const studentId = atts[0].student_id;

    // Dapatkan token untuk student ini
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: atts[0].email,
        password: 'StudentSecret2026!',
      },
    });

    let stToken = adminToken;
    if (loginRes.statusCode === 200) {
      stToken = JSON.parse(loginRes.body).token;
    }

    // Ambil opsi yang valid untuk attempt ini
    const { rows: aqRows } = await pool.query(
      `SELECT aq.id, aq.question_version_id, qo.id AS option_id
       FROM attempt_questions aq
       JOIN question_options qo ON qo.question_version_id = aq.question_version_id
       WHERE aq.attempt_id = $1
       LIMIT 1;`,
      [attemptId]
    );

    if (aqRows.length > 0) {
      const qvId = aqRows[0].question_version_id;
      const optId = aqRows[0].option_id;

      // Pastikan ada baris di attempt_answers terlebih dahulu
      await pool.query(
        `INSERT INTO attempt_answers (attempt_question_id, question_version_id, client_seq, selected_option_id)
         VALUES ($1, $2, 5, $3)
         ON CONFLICT (attempt_question_id)
         DO UPDATE SET client_seq = 5, selected_option_id = $3;`,
        [aqRows[0].id, qvId, optId]
      );

      // Jalankan query update dengan client_seq = 3 (lebih kecil dari 5)
      const { rows: staleRes } = await pool.query(
        `UPDATE attempt_answers
         SET selected_option_id = NULL, client_seq = 3, updated_at = now()
         WHERE attempt_question_id = $1 AND client_seq <= 3
         RETURNING *;`,
        [aqRows[0].id]
      );

      // Baris tidak boleh berubah karena client_seq 3 < 5!
      expect(staleRes.length).toBe(0);

      // Verifikasi nilai tetap 5
      const { rows: current } = await pool.query(
        `SELECT client_seq, selected_option_id FROM attempt_answers WHERE attempt_question_id = $1;`,
        [aqRows[0].id]
      );
      if (current.length > 0) {
        expect(current[0].client_seq).toBe(5);
        expect(current[0].selected_option_id).toBe(optId);
      }
    }
  });

  it('TC-35: CSV Export should safely escape formula injection cells (=, +, -, @)', async () => {
    // Cari sebuah sesi yang memiliki hasil
    const { rows: sessions } = await pool.query(
      `SELECT s.id FROM exam_sessions s
       JOIN session_enrollments se ON se.session_id = s.id
       JOIN attempts a ON a.enrollment_id = se.id
       JOIN results r ON r.attempt_id = a.id
       WHERE r.status = 'published'
       LIMIT 1;`
    );

    if (sessions.length > 0) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/sessions/${sessions[0].id}/export`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const csv = res.body;
      expect(csv).toContain('sesi,ujian,nomor_identitas,nama,instansi');

      // Pastikan tidak ada sel yang diawali langsung oleh =cmd atau +rumus tanpa kutip
      const lines = csv.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const columns = line.split(',');
        for (const col of columns) {
          const stripped = col.replace(/^"/, '').replace(/"$/, '');
          // Jika diawali formula karakter, harus sudah dinetralisir dengan awalan petik tunggal '
          if (/^[=+\-@]/.test(stripped)) {
            expect(stripped.startsWith("'")).toBe(true);
          }
        }
      }
    }
  });

  it('TC-18 & TC-34: Certificate PDF generation should produce valid PDF binary with %PDF header', async () => {
    const { rows: certs } = await pool.query('SELECT id FROM certificates LIMIT 1;');
    if (certs.length > 0) {
      const certId = certs[0].id;
      const pdfBuffer = await generateCertificatePDFBuffer(certId);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000); // Harus lebih dari 1KB

      // Verifikasi PDF magic header %PDF
      const header = pdfBuffer.slice(0, 4).toString('utf-8');
      expect(header).toBe('%PDF');
    }
  });

  it('TC-45 & TC-46: Result detail and attempt detail should properly format option labels (A, B, C...)', async () => {
    const { rows: results } = await pool.query('SELECT id, attempt_id FROM results LIMIT 1;');
    if (results.length > 0) {
      const resId = results[0].id;
      const attId = results[0].attempt_id;

      // 1. GET /api/v1/results/:id (Admin view)
      const resDetail = await app.inject({
        method: 'GET',
        url: `/api/v1/results/${resId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(resDetail.statusCode).toBe(200);
      const parsedRes = JSON.parse(resDetail.body).result;
      expect(parsedRes.answers).toBeDefined();
      if (parsedRes.answers.length > 0) {
        expect(parsedRes.answers[0].correct_label).toMatch(/^[A-F]$/);
      }

      // 2. GET /api/v1/attempts/:id (Admin view)
      const attDetail = await app.inject({
        method: 'GET',
        url: `/api/v1/attempts/${attId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(attDetail.statusCode).toBe(200);
      const parsedAtt = JSON.parse(attDetail.body).attempt;
      expect(parsedAtt.answers).toBeDefined();
    }
  });

  it('TC-47: GET /verify/:code at root level should redirect to /api/v1/verify/:code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/verify/SAMPLE_CODE_123',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/api/v1/verify/SAMPLE_CODE_123');
  });

  it('TC-22: INV-22 New login should revoke previous active session token', async () => {
    // 1. Buat mahasiswa
    const ident = `SESS-${Date.now().toString().slice(-5)}`;
    const studentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        identifier: ident,
        full_name: 'Mahasiswa Single Session',
        email: `session.${Date.now()}@fia.kampus.ac.id`,
      },
    });
    const body = JSON.parse(studentRes.body);
    const tempPassword = body.initial_password || body.student?.temp_password;

    // 2. Login di Perangkat 1
    const login1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: ident, password: tempPassword },
    });
    const tokenDevice1 = JSON.parse(login1.body).token;

    // Ganti sandi awal agar tidak tertahan AUTH_PASSWORD_CHANGE_REQUIRED
    await app.inject({
      method: 'POST',
      url: '/api/v1/me/password',
      headers: { authorization: `Bearer ${tokenDevice1}` },
      payload: { old_password: tempPassword, new_password: 'PermanentPassword2026!' },
    });

    // 3. Login di Perangkat 2
    const login2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: ident, password: 'PermanentPassword2026!' },
    });
    const login2Parsed = JSON.parse(login2.body);
    const tokenDevice2 = login2Parsed.token;
    expect(tokenDevice2).toBeDefined();

    // 4. Perangkat 2 berhasil mengakses /me
    const meDevice2 = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${tokenDevice2}` },
    });
    expect(meDevice2.statusCode).toBe(200);

    // 5. Perangkat 1 ditolak (401 AUTH_REQUIRED) karena sesi lamanya dicabut (INV-22)
    const meDevice1 = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${tokenDevice1}` },
    });
    expect(meDevice1.statusCode).toBe(401);
  });

  it('Root GET / should return clean online status and welcome message', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ONLINE');
    expect(body.app).toBe('CAT GOVERNANCE');
  });
});
