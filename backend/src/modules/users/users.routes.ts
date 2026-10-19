import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../../db/connection.js';
import { authenticate, requireRoles } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import {
  checkLastAdminGuard,
  createAdminUser,
  createStudentUser,
  parseAndPreviewStudentCSV,
  commitStudentImport,
  downloadImportCredentials,
  resetUserPassword,
  unlockUserAccount,
} from './users.service.js';
import { logAudit } from '../audit/audit.service.js';

const createAdminSchema = z.object({
  email: z.string().email('Format email tidak valid'),
});

const updateAdminSchema = z.object({
  email: z.string().email().optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

const createStudentSchema = z.object({
  identifier: z.string().optional().nullable(),
  full_name: z.string().min(1, 'Nama lengkap wajib diisi'),
  email: z.string().email('Format email tidak valid'),
  institution: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  role: z.enum(['mahasiswa', 'umum', 'student']).optional(),
});

const updateStudentSchema = z.object({
  full_name: z.string().min(1).optional(),
  institution: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  status: z.enum(['active', 'suspended']).optional(),
});

export const userRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Semua rute ini memerlukan peran admin (FR-U01..U05)
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRoles(['admin']));

  // GET /users
  fastify.get('/users', async (request, reply) => {
    const query = request.query as {
      role?: 'admin' | 'student' | 'mahasiswa' | 'umum';
      status?: 'active' | 'suspended';
      search?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(Math.max(parseInt(query.limit || '25', 10), 1), 100);
    const offset = Math.max(parseInt(query.offset || '0', 10), 0);

    const conditions: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.role) {
      conditions.push(`role = $${paramIndex++}`);
      params.push(query.role);
    }

    if (query.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(query.status);
    }

    if (query.search) {
      conditions.push(`lower(email) LIKE $${paramIndex++}`);
      params.push(`%${query.search.toLowerCase()}%`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total FROM users ${whereClause};`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const dataQuery = `
      SELECT 
        id, email, role, status, must_change_password,
        failed_login_count, locked_until, last_login_at, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(dataQuery, params);

    return reply.send({
      data: rows,
      meta: { total, limit, offset },
    });
  });

  // POST /users (Create Admin)
  fastify.post('/users', async (request, reply) => {
    const parseResult = createAdminSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_FAILED', 'Format email salah', parseResult.error.format());
    }

    const { email } = parseResult.data;
    const actorId = request.user!.id;
    const ipAddress = request.ip;

    const result = await createAdminUser(email, actorId, ipAddress);
    return reply.status(201).send({
      success: true,
      user: {
        id: result.id,
        email: result.email,
        role: 'admin',
      },
      initial_password: result.tempPassword,
    });
  });

  // GET /users/:id
  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows } = await pool.query(
      `SELECT 
        u.id, u.email, u.role, u.status, u.must_change_password,
        u.failed_login_count, u.locked_until, u.last_login_at, u.created_at, u.updated_at,
        sp.identifier, sp.full_name, sp.institution, sp.phone
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1 AND u.deleted_at IS NULL;`,
      [id]
    );

    if (rows.length === 0) {
      throw new AppError('NOT_FOUND');
    }

    return reply.send({ user: rows[0] });
  });

  // PATCH /users/:id (FR-U02, U05, INV-21)
  fastify.patch('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateAdminSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_FAILED', 'Data tidak valid', parseResult.error.format());
    }

    const { email, status } = parseResult.data;

    if (status === 'suspended') {
      await checkLastAdminGuard(id);
    }

    const updates: string[] = ['updated_at = now()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (email) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email.toLowerCase().trim());
    }

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    params.push(id);
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING id, email, role, status, updated_at;
    `;

    const { rows } = await pool.query(query, params);
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND');
    }

    await logAudit({
      actorId: request.user!.id,
      actorRole: 'admin',
      action: 'users.update',
      entityType: 'users',
      entityId: id,
      afterData: rows[0],
      ipAddress: request.ip,
    });

    return reply.send({ success: true, user: rows[0] });
  });

  // DELETE /users/:id (Soft delete, INV-21)
  fastify.delete('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    await checkLastAdminGuard(id);

    const { rows } = await pool.query(
      `UPDATE users 
       SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, email;`,
      [id]
    );

    if (rows.length === 0) {
      throw new AppError('NOT_FOUND');
    }

    // Cabut seluruh sesi aktif
    await pool.query(`UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1;`, [id]);

    await logAudit({
      actorId: request.user!.id,
      actorRole: 'admin',
      action: 'users.delete',
      entityType: 'users',
      entityId: id,
      ipAddress: request.ip,
    });

    return reply.send({ success: true, message: 'Pengguna berhasil dihapus (soft-delete).' });
  });

  // POST /users/:id/reset-password (FR-A04)
  fastify.post('/users/:id/reset-password', async (request, reply) => {
    const { id } = request.params as { id: string };
    const actorId = request.user!.id;
    const ipAddress = request.ip;

    const result = await resetUserPassword(id, actorId, ipAddress);
    return reply.send({
      success: true,
      temp_password: result.tempPassword,
      new_password: result.tempPassword,
      message: 'Kata sandi berhasil direset. Berikan kata sandi baru kepada pengguna.',
    });
  });

  // POST /users/:id/unlock (FR-A05)
  fastify.post('/users/:id/unlock', async (request, reply) => {
    const { id } = request.params as { id: string };
    const actorId = request.user!.id;
    const ipAddress = request.ip;

    await unlockUserAccount(id, actorId, ipAddress);
    return reply.send({
      success: true,
      message: 'Akun berhasil dibuka kuncinya.',
    });
  });

  // GET /students (FR-U01)
  fastify.get('/students', async (request, reply) => {
    const query = request.query as {
      institution?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(Math.max(parseInt(query.limit || '25', 10), 1), 100);
    const offset = Math.max(parseInt(query.offset || '0', 10), 0);

    const conditions: string[] = ['u.deleted_at IS NULL', "u.role IN ('student', 'mahasiswa', 'umum')"];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.institution) {
      conditions.push(`sp.institution ILIKE $${paramIndex++}`);
      params.push(`%${query.institution}%`);
    }

    if (query.search) {
      conditions.push(`(sp.identifier ILIKE $${paramIndex} OR sp.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total 
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       ${whereClause};`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const dataQuery = `
      SELECT 
        u.id, u.email, u.role, u.status, u.must_change_password, u.last_login_at,
        sp.identifier, sp.full_name, sp.institution, sp.phone, sp.created_at, sp.updated_at
      FROM student_profiles sp
      JOIN users u ON u.id = sp.user_id
      ${whereClause}
      ORDER BY sp.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(dataQuery, params);

    return reply.send({
      data: rows,
      meta: { total, limit, offset },
    });
  });

  // POST /students (FR-U03)
  fastify.post('/students', async (request, reply) => {
    const parseResult = createStudentSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_FAILED', 'Validasi data peserta gagal', parseResult.error.format());
    }

    const { identifier, full_name, email, institution, phone, role } = parseResult.data;
    const actorId = request.user!.id;
    const ipAddress = request.ip;

    const result = await createStudentUser(
      {
        identifier,
        fullName: full_name,
        email,
        institution,
        phone,
        role,
      },
      actorId,
      ipAddress
    );

    return reply.status(201).send({
      success: true,
      student: {
        id: result.id,
        identifier: result.identifier,
        email: result.email,
        role: result.role,
      },
      initial_password: result.tempPassword,
    });
  });

  // GET /students/:id
  fastify.get('/students/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows } = await pool.query(
      `SELECT 
        u.id, u.email, u.role, u.status, u.must_change_password, u.last_login_at,
        sp.identifier, sp.full_name, sp.institution, sp.phone, sp.created_at, sp.updated_at
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE u.id = $1 AND u.deleted_at IS NULL;`,
      [id]
    );

    if (rows.length === 0) {
      throw new AppError('NOT_FOUND');
    }

    return reply.send({ student: rows[0] });
  });

  // PATCH /students/:id (FR-U03)
  fastify.patch('/students/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateStudentSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_FAILED', 'Validasi data pembaruan gagal', parseResult.error.format());
    }

    const { full_name, institution, phone, status } = parseResult.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      if (status) {
        await client.query(`UPDATE users SET status = $1, updated_at = now() WHERE id = $2;`, [status, id]);
      }

      const spUpdates: string[] = ['updated_at = now()'];
      const spParams: any[] = [];
      let idx = 1;

      if (full_name !== undefined) {
        spUpdates.push(`full_name = $${idx++}`);
        spParams.push(full_name.trim());
      }
      if (institution !== undefined) {
        spUpdates.push(`institution = $${idx++}`);
        spParams.push(institution?.trim() || null);
      }
      if (phone !== undefined) {
        spUpdates.push(`phone = $${idx++}`);
        spParams.push(phone?.trim() || null);
      }

      spParams.push(id);
      const { rows } = await client.query(
        `UPDATE student_profiles
         SET ${spUpdates.join(', ')}
         WHERE user_id = $${idx}
         RETURNING user_id, identifier, full_name, institution, phone, updated_at;`,
        spParams
      );

      if (rows.length === 0) {
        throw new AppError('NOT_FOUND');
      }

      await logAudit(
        {
          actorId: request.user!.id,
          actorRole: 'admin',
          action: 'students.update',
          entityType: 'users',
          entityId: id,
          afterData: rows[0],
          ipAddress: request.ip,
        },
        client
      );

      await client.query('COMMIT;');

      return reply.send({ success: true, student: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /students/import (Direct CSV upload & commit)
  fastify.post('/students/import', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      throw new AppError('VALIDATION_FAILED', 'Berkas CSV tidak ditemukan dalam permintaan.');
    }

    const buffer = await data.toBuffer();
    const preview = parseAndPreviewStudentCSV(buffer);

    if (preview.validRows === 0) {
      throw new AppError(
        'VALIDATION_FAILED',
        'Tidak ada baris data peserta yang valid dalam berkas CSV. Periksa kembali format berkas Anda.',
        preview.rows.filter((r) => r.errors.length > 0)
      );
    }

    const actorId = request.user!.id;
    const ipAddress = request.ip;

    const result = await commitStudentImport(preview.parsedRecords, actorId, ipAddress);

    return reply.send({
      success: true,
      total_rows: preview.totalRows,
      valid_rows: preview.validRows,
      invalid_rows: preview.invalidRows,
      imported_count: result.totalImported,
      skipped_count: result.skippedCount,
      import_id: result.importId,
      credentials_download_url: `/api/v1/students/import/${result.importId}/credentials`,
      errors: preview.rows.filter((r) => r.errors.length > 0),
    });
  });

  // POST /students/import/preview (FR-U04)
  fastify.post('/students/import/preview', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      throw new AppError('VALIDATION_FAILED', 'Berkas CSV tidak ditemukan dalam permintaan.');
    }

    const buffer = await data.toBuffer();
    const preview = parseAndPreviewStudentCSV(buffer);

    return reply.send({
      success: true,
      total_rows: preview.totalRows,
      valid_rows: preview.validRows,
      invalid_rows: preview.invalidRows,
      rows: preview.rows,
      // Pass back valid parsed records for commit payload
      valid_payload: preview.parsedRecords,
    });
  });

  // POST /students/import/commit (FR-U04)
  fastify.post('/students/import/commit', async (request, reply) => {
    const body = request.body as {
      students: Array<{
        identifier: string;
        fullName: string;
        email: string;
        institution: string | null;
        phone: string | null;
        role?: 'mahasiswa' | 'umum';
      }>;
    };

    if (!body?.students || !Array.isArray(body.students) || body.students.length === 0) {
      throw new AppError('VALIDATION_FAILED', 'Daftar peserta untuk diimpor tidak boleh kosong.');
    }

    const actorId = request.user!.id;
    const ipAddress = request.ip;

    const result = await commitStudentImport(body.students, actorId, ipAddress);

    return reply.send({
      success: true,
      import_id: result.importId,
      total_imported: result.totalImported,
      skipped_count: result.skippedCount,
      credentials_download_url: `/api/v1/students/import/${result.importId}/credentials`,
    });
  });

  // GET /students/import/:importId/credentials (FR-U04, single-download)
  fastify.get('/students/import/:importId/credentials', async (request, reply) => {
    const { importId } = request.params as { importId: string };
    const csvContent = downloadImportCredentials(importId);

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="kredensial_peserta_${importId.slice(0, 8)}.csv"`);
    return reply.send(csvContent);
  });
};
