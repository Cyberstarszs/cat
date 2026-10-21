import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../../db/connection.js';
import { authenticate, requireRoles, isStudentRole } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import { CONSTANTS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { sanitizeStudentReview } from '../../lib/serializer.js';
import { logAudit } from '../audit/audit.service.js';

const updateProfileSchema = z.object({
  phone: z.string().optional().nullable(),
  institution: z.string().optional().nullable(),
});

const updateSettingsSchema = z.object({
  preferences: z.record(z.string(), z.any()),
});

const submitAppealSchema = z
  .object({
    question_version_id: z.string().uuid().optional().nullable(),
    message: z.string().max(1000).optional(),
    reason: z.string().max(1000).optional(),
  })
  .refine(
    (data) =>
      (data.message && data.message.trim().length >= 3) ||
      (data.reason && data.reason.trim().length >= 3),
    { message: 'Alasan atau pesan sanggahan minimal 3 karakter.' }
  );

export const meRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // GET /me (FR-A07)
  fastify.get('/me', async (request, reply) => {
    const user = request.user!;

    const { rows } = await pool.query(
      `SELECT 
        u.id, u.email, u.role, u.status, u.must_change_password, u.last_login_at,
        sp.identifier, sp.full_name, sp.institution, sp.phone,
        us.preferences
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE u.id = $1 AND u.deleted_at IS NULL;`,
      [user.id]
    );

    if (rows.length === 0) {
      throw new AppError('NOT_FOUND');
    }

    const row = rows[0];
    const profileData = row.identifier
      ? {
          identifier: row.identifier,
          full_name: row.full_name,
          institution: row.institution,
          phone: row.phone,
        }
      : null;

    return reply.send({
      user: {
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status,
        must_change_password: row.must_change_password,
        last_login_at: row.last_login_at,
        profile: profileData,
        student_profile: profileData, // alias untuk konsistensi dengan login
        preferences: row.preferences || {},
      },
      profile: profileData, // sertakan di root agar data.profile terbaca
    });
  });

  // GET /me/profile (FR-U06)
  fastify.get('/me/profile', async (request, reply) => {
    const user = request.user!;

    const { rows } = await pool.query(
      `SELECT 
        u.id, u.email, u.role,
        sp.identifier, sp.full_name, sp.institution, sp.phone, sp.created_at, sp.updated_at
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1;`,
      [user.id]
    );

    if (rows.length === 0) {
      throw new AppError('NOT_FOUND');
    }

    return reply.send({ profile: rows[0] });
  });

  // PATCH /me/profile (FR-U06: limited self-service)
  fastify.patch('/me/profile', async (request, reply) => {
    const user = request.user!;
    const parseResult = updateProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_FAILED', 'Format profil salah', parseResult.error.format());
    }

    const { phone, institution } = parseResult.data;

    if (isStudentRole(user.role)) {
      const { rows } = await pool.query(
        `UPDATE student_profiles
         SET phone = COALESCE($1, phone),
             institution = COALESCE($2, institution),
             updated_at = now()
         WHERE user_id = $3
         RETURNING user_id, identifier, full_name, institution, phone;`,
        [phone !== undefined ? phone : null, institution !== undefined ? institution : null, user.id]
      );

      return reply.send({ success: true, profile: rows[0] });
    }

    return reply.send({ success: true, message: 'Profil admin tidak memerlukan perubahan.' });
  });

  // GET /me/photo (Ambil foto mahasiswa UNIRA langsung dari API UNIRA)
  fastify.get('/me/photo', async (request, reply) => {
    const user = request.user!;
    const { rows } = await pool.query(
      `SELECT identifier, institution FROM student_profiles WHERE user_id = $1;`,
      [user.id]
    );
    if (rows.length === 0 || !rows[0].identifier) {
      return reply.send({ photo_url: null });
    }
    const { identifier, institution } = rows[0];
    if (
      user.role === 'umum' ||
      (institution && institution.toLowerCase() === 'umum') ||
      !/^\d+$/.test(identifier.trim())
    ) {
      return reply.send({ photo_url: null });
    }

    try {
      const baseUrl = env.UNIRA_API_BASE_URL.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/v1/mahasiswa?filter[nim]=${encodeURIComponent(identifier.trim())}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return reply.send({ photo_url: null });
      const json: any = await response.json();
      if (json.data && json.data.length > 0 && json.data[0].attributes?.thumbnail) {
        const thumb = json.data[0].attributes.thumbnail.trim();
        const photoUrl = thumb.startsWith('http') ? thumb : `${baseUrl}/${thumb.replace(/^\//, '')}`;
        return reply.send({ photo_url: photoUrl });
      }
      return reply.send({ photo_url: null });
    } catch {
      return reply.send({ photo_url: null });
    }
  });

  // GET /me/settings (FR-U06)
  fastify.get('/me/settings', async (request, reply) => {
    const user = request.user!;
    const { rows } = await pool.query(
      `SELECT preferences, updated_at FROM user_settings WHERE user_id = $1;`,
      [user.id]
    );

    return reply.send({
      preferences: rows[0]?.preferences || {},
      updated_at: rows[0]?.updated_at || null,
    });
  });

  // PATCH /me/settings (FR-U06)
  fastify.patch('/me/settings', async (request, reply) => {
    const user = request.user!;
    const parseResult = updateSettingsSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_FAILED', 'Format preferensi salah', parseResult.error.format());
    }

    const { preferences } = parseResult.data;
    const { rows } = await pool.query(
      `INSERT INTO user_settings (user_id, preferences, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id) 
       DO UPDATE SET preferences = $2, updated_at = now()
       RETURNING preferences, updated_at;`,
      [user.id, JSON.stringify(preferences)]
    );

    return reply.send({ success: true, preferences: rows[0].preferences });
  });

  // GET /me/sessions (M only, FR-T01)
  fastify.get('/me/sessions', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const user = request.user!;

      const query = `
        SELECT 
          se.id AS enrollment_id, se.status AS enrollment_status, se.registered_at,
          s.id AS session_id, s.code AS session_code, s.name AS session_name,
          s.starts_at, s.ends_at, s.status AS session_status,
          (s.access_code_hash IS NOT NULL) AS has_access_code,
          e.id AS exam_id, e.title AS exam_title, e.duration_minutes, e.passing_score,
          a.id AS attempt_id, a.attempt_no, a.status AS attempt_status,
          a.started_at AS attempt_started_at, a.deadline_at AS attempt_deadline_at,
          r.id AS result_id, r.score AS result_score, r.passed AS result_passed, r.status AS result_status
        FROM session_enrollments se
        JOIN exam_sessions s ON s.id = se.session_id
        JOIN exams e ON e.id = s.exam_id
        LEFT JOIN attempts a ON a.enrollment_id = se.id AND a.status <> 'void'
        LEFT JOIN results r ON r.attempt_id = a.id AND r.status = 'published'
        WHERE se.student_id = $1 AND s.status <> 'cancelled'
        ORDER BY s.starts_at ASC;
      `;

      const { rows } = await pool.query(query, [user.id]);
      return reply.send({ data: rows });
    },
  });

  // GET /me/results (M only, FR-R03)
  fastify.get('/me/results', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const user = request.user!;

      const query = `
        SELECT 
          r.id, r.score, r.passed, r.status, r.revision_no, r.published_at,
          a.id AS attempt_id, a.attempt_no, a.started_at, a.submitted_at,
          s.id AS session_id, s.name AS session_name, s.code AS session_code,
          e.id AS exam_id, e.title AS exam_title, e.passing_score, e.allow_review,
          c.id AS certificate_id, c.certificate_no, c.verification_code
        FROM results r
        JOIN attempts a ON a.id = r.attempt_id
        JOIN session_enrollments se ON se.id = a.enrollment_id
        JOIN exam_sessions s ON s.id = se.session_id
        JOIN exams e ON e.id = s.exam_id
        LEFT JOIN certificates c ON c.result_id = r.id AND c.status = 'valid'
        WHERE se.student_id = $1 AND r.status = 'published'
        ORDER BY r.published_at DESC;
      `;

      const { rows } = await pool.query(query, [user.id]);
      return reply.send({ data: rows });
    },
  });

  // GET /me/results/:id (M only, FR-R03, INV-14, INV-15)
  fastify.get('/me/results/:id', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const query = `
        SELECT 
          r.id, r.raw_score, r.max_score, r.score, r.passing_score, r.passed,
          r.status, r.revision_no, r.published_at,
          a.id AS attempt_id, a.attempt_no, a.started_at, a.submitted_at,
          s.id AS session_id, s.name AS session_name, s.code AS session_code, s.status AS session_status, s.ends_at AS session_ends_at,
          e.id AS exam_id, e.title AS exam_title, e.allow_review,
          c.id AS certificate_id, c.certificate_no, c.verification_code,
          se.student_id
        FROM results r
        JOIN attempts a ON a.id = r.attempt_id
        JOIN session_enrollments se ON se.id = a.enrollment_id
        JOIN exam_sessions s ON s.id = se.session_id
        JOIN exams e ON e.id = s.exam_id
        LEFT JOIN certificates c ON c.result_id = r.id AND c.status = 'valid'
        WHERE r.id = $1 AND r.status IN ('published', 'pending_publication');
      `;

      const { rows } = await pool.query(query, [id]);
      if (rows.length === 0 || rows[0].student_id !== user.id) {
        throw new AppError('NOT_FOUND'); // Anti-IDOR (INV-14)
      }

      const result = rows[0];

      // Detail review soal hanya diizinkan jika allow_review = true, status sudah published resmi, dan sesi tidak sedang berlangsung di lab
      let reviewQuestions = null;
      const isSessionOngoing = result.session_status !== 'completed' && new Date(result.session_ends_at).getTime() > Date.now();
      if (result.allow_review && result.status === 'published' && !isSessionOngoing) {
        const qQuery = `
          SELECT 
            aq.position,
            qv.stem, qv.explanation, qv.weight,
            ans.selected_option_id, ans.is_correct, ans.points_awarded,
            qo.id AS option_id, chr(64 + qo.position) AS option_label, qo.option_text, qo.is_correct AS option_is_correct
          FROM attempt_questions aq
          JOIN question_versions qv ON qv.id = aq.question_version_id
          LEFT JOIN attempt_answers ans ON ans.attempt_question_id = aq.id
          LEFT JOIN question_options qo ON qo.question_version_id = qv.id
          WHERE aq.attempt_id = $1
          ORDER BY aq.position ASC, qo.position ASC;
        `;
        const { rows: rawReview } = await pool.query(qQuery, [result.attempt_id]);
        reviewQuestions = sanitizeStudentReview(rawReview, true);
      }

      return reply.send({
        result: {
          id: result.id,
          raw_score: result.raw_score,
          max_score: result.max_score,
          score: result.score,
          passing_score: result.passing_score,
          passed: result.passed,
          revision_no: result.revision_no,
          published_at: result.published_at,
          session: {
            id: result.session_id,
            name: result.session_name,
            code: result.session_code,
          },
          exam: {
            id: result.exam_id,
            title: result.exam_title,
            allow_review: result.allow_review,
          },
          certificate: result.certificate_id
            ? {
                id: result.certificate_id,
                certificate_no: result.certificate_no,
                verification_code: result.verification_code,
              }
            : null,
          review: reviewQuestions,
        },
      });
    },
  });

  // POST /me/results/:id/appeals (M only, FR-R07)
  fastify.post('/me/results/:id/appeals', {
    preHandler: [requireRoles(['student', 'admin'])],
    handler: async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const parseResult = submitAppealSchema.safeParse(request.body || {});
      if (!parseResult.success) {
        throw new AppError('VALIDATION_FAILED', 'Format pengajuan sanggah salah', parseResult.error.format());
      }

      const { question_version_id } = parseResult.data;
      const appealText = (parseResult.data.message || parseResult.data.reason)!.trim();

      // Cek apakah hasil milik mahasiswa
      const { rows } = await pool.query(
        `SELECT r.id, r.attempt_id, r.status, r.published_at, r.graded_at, se.student_id
         FROM results r
         JOIN attempts a ON a.id = r.attempt_id
         JOIN session_enrollments se ON se.id = a.enrollment_id
         WHERE r.id = $1;`,
        [id]
      );

      if (rows.length === 0) {
        throw new AppError('NOT_FOUND', 'Hasil ujian tidak ditemukan.');
      }

      const resRow = rows[0];
      if (isStudentRole(user.role) && resRow.student_id !== user.id) {
        throw new AppError('NOT_FOUND');
      }

      // Validasi butir soal yang disanggah benar-benar bagian dari attempt ujian ini
      if (question_version_id) {
        const { rows: qCheck } = await pool.query(
          `SELECT 1 FROM attempt_questions WHERE attempt_id = $1 AND question_version_id = $2;`,
          [resRow.attempt_id, question_version_id]
        );
        if (qCheck.length === 0) {
          throw new AppError('VALIDATION_FAILED', 'Soal yang disanggah tidak terdapat pada riwayat ujian ini.');
        }
      }

      // Periksa batas waktu sanggah (APPEAL_WINDOW_DAYS = 7 hari sejak publikasi atau penilaian)
      const baseDate = resRow.published_at ? new Date(resRow.published_at) : new Date(resRow.graded_at || Date.now());
      const appealDeadline = new Date(
        baseDate.getTime() + CONSTANTS.APPEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000
      );
      if (Date.now() > appealDeadline.getTime()) {
        throw new AppError(
          'APPEAL_WINDOW_CLOSED',
          `Batas waktu pengajuan sanggah (${CONSTANTS.APPEAL_WINDOW_DAYS} hari sejak hasil diterbitkan) telah berakhir.`
        );
      }

      // Cek apakah sudah ada sanggahan terbuka untuk hasil ini
      const { rows: existingOpen } = await pool.query(
        `SELECT id FROM appeals WHERE result_id = $1 AND status = 'open';`,
        [id]
      );
      if (existingOpen.length > 0) {
        throw new AppError('CONFLICT', 'Sanggahan untuk hasil ujian ini sudah diajukan dan sedang dalam proses peninjauan panitia.');
      }

      const targetStudentId = isStudentRole(user.role) ? user.id : resRow.student_id;
      const { rows: appealRows } = await pool.query(
        `INSERT INTO appeals (result_id, student_id, question_version_id, message, status)
         VALUES ($1, $2, $3, $4, 'open')
         RETURNING id, result_id, student_id, question_version_id, message, status, created_at;`,
        [id, targetStudentId, question_version_id || null, appealText]
      );

      await logAudit({
        actorId: user.id,
        actorRole: user.role,
        action: 'appeals.submit',
        entityType: 'appeals',
        entityId: appealRows[0].id,
        reason: appealText,
        afterData: appealRows[0],
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        appeal: appealRows[0],
      });
    },
  });

  // GET /me/appeals (M only, FR-R07)
  fastify.get('/me/appeals', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const user = request.user!;

      const { rows } = await pool.query(
        `SELECT 
          ap.id, ap.result_id, ap.question_version_id, ap.message, ap.message AS reason,
          ap.response, ap.response AS admin_notes, ap.status, ap.created_at, ap.responded_at,
          r.score, r.passed,
          e.title AS exam_title,
          s.name AS session_name
         FROM appeals ap
         JOIN results r ON r.id = ap.result_id
         JOIN attempts a ON a.id = r.attempt_id
         JOIN session_enrollments se ON se.id = a.enrollment_id
         JOIN exam_sessions s ON s.id = se.session_id
         JOIN exams e ON e.id = s.exam_id
         WHERE ap.student_id = $1
         ORDER BY ap.created_at DESC;`,
        [user.id]
      );

      return reply.send({ data: rows });
    },
  });

  // GET /me/certificates (M only, FR-C02)
  fastify.get('/me/certificates', {
    preHandler: [requireRoles(['student'])],
    handler: async (request, reply) => {
      const user = request.user!;

      const query = `
        SELECT 
          c.id, c.certificate_no, c.verification_code, c.issued_at, c.expires_at, c.status,
          r.score, r.passed,
          e.id AS exam_id, e.title AS exam_title,
          s.id AS session_id, s.name AS session_name
        FROM certificates c
        JOIN results r ON r.id = c.result_id
        JOIN attempts a ON a.id = r.attempt_id
        JOIN session_enrollments se ON se.id = a.enrollment_id
        JOIN exam_sessions s ON s.id = se.session_id
        JOIN exams e ON e.id = s.exam_id
        WHERE se.student_id = $1 AND c.status = 'valid'
        ORDER BY c.issued_at DESC;
      `;

      const { rows } = await pool.query(query, [user.id]);
      return reply.send({ data: rows });
    },
  });
};
