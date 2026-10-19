import crypto from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { pool } from '../../db/connection.js';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../lib/errors.js';
import { generateSecureTempPassword, generateNumeric6DigitPassword, hashPassword } from '../../lib/hash.js';
import { logAudit } from '../audit/audit.service.js';
import { CONSTANTS } from '../../config/constants.js';

// Temporary memory store for one-time download credentials (TTL: 1 hour)
interface ImportCredentialItem {
  identifier: string;
  name: string;
  email: string;
  tempPassword: string;
}

const importCredentialsStore = new Map<string, { expiresAt: number; credentials: ImportCredentialItem[] }>();

// Cleanup expired store every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of importCredentialsStore.entries()) {
    if (value.expiresAt <= now) {
      importCredentialsStore.delete(key);
    }
  }
}, 15 * 60 * 1000).unref();

export async function checkLastAdminGuard(targetUserId: string): Promise<void> {
  const user = await prisma.users.findFirst({
    where: { id: targetUserId, deleted_at: null },
    select: { role: true, status: true },
  });
  if (!user) return;

  if (user.role === 'admin' && user.status === 'active') {
    const activeAdmins = await prisma.users.count({
      where: { role: 'admin', status: 'active', deleted_at: null },
    });
    if (activeAdmins <= 1) {
      throw new AppError('LAST_ADMIN', 'Admin aktif terakhir tidak boleh dinonaktifkan atau dihapus.');
    }
  }
}

export async function createAdminUser(
  email: string,
  adminActorId: string,
  ipAddress?: string
): Promise<{ id: string; email: string; tempPassword: string }> {
  const cleanEmail = email.toLowerCase().trim();

  // Cek duplikasi email via Prisma
  const existing = await prisma.users.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' }, deleted_at: null },
  });
  if (existing) {
    throw new AppError('VALIDATION_FAILED', 'Email sudah terdaftar dalam sistem.');
  }

  const tempPassword = generateSecureTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.users.create({
      data: {
        email: cleanEmail,
        password_hash: passwordHash,
        role: 'admin',
        status: 'active',
        must_change_password: false,
        user_settings: {
          create: { preferences: {} },
        },
      },
      select: { id: true, email: true },
    });

    await logAudit({
      actorId: adminActorId,
      actorRole: 'admin',
      action: 'users.create_admin',
      entityType: 'users',
      entityId: user.id,
      afterData: { email: cleanEmail, role: 'admin' },
      ipAddress,
    });

    return user;
  });

  return {
    id: newUser.id,
    email: newUser.email,
    tempPassword,
  };
}

export async function createStudentUser(
  data: {
    identifier: string;
    fullName: string;
    email: string;
    institution?: string | null;
    phone?: string | null;
  },
  adminActorId: string,
  ipAddress?: string
): Promise<{ id: string; identifier: string; email: string; tempPassword: string }> {
  const cleanEmail = data.email.toLowerCase().trim();
  const cleanIdentifier = data.identifier.trim();

  // Cek duplikasi via Prisma
  const existingEmail = await prisma.users.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' }, deleted_at: null },
  });
  if (existingEmail) {
    throw new AppError('VALIDATION_FAILED', 'Email sudah terdaftar.');
  }

  const existingIdentifier = await prisma.student_profiles.findFirst({
    where: {
      identifier: cleanIdentifier,
      users: { deleted_at: null },
    },
  });
  if (existingIdentifier) {
    throw new AppError('VALIDATION_FAILED', 'Nomor Identitas sudah terdaftar.');
  }

  const tempPassword = generateSecureTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.users.create({
      data: {
        email: cleanEmail,
        password_hash: passwordHash,
        role: 'student',
        status: 'active',
        must_change_password: false,
        student_profiles: {
          create: {
            identifier: cleanIdentifier,
            full_name: data.fullName.trim(),
            institution: data.institution?.trim() || null,
            phone: data.phone?.trim() || null,
          },
        },
        user_settings: {
          create: { preferences: {} },
        },
      },
      select: { id: true, email: true },
    });

    await logAudit({
      actorId: adminActorId,
      actorRole: 'admin',
      action: 'students.create',
      entityType: 'users',
      entityId: user.id,
      afterData: { identifier: cleanIdentifier, email: cleanEmail, full_name: data.fullName },
      ipAddress,
    });

    return user;
  });

  return {
    id: newUser.id,
    identifier: cleanIdentifier,
    email: cleanEmail,
    tempPassword,
  };
}

export interface CSVPreviewRow {
  rowNumber: number;
  identifier: string;
  name: string;
  email: string;
  institution?: string;
  phone?: string;
  errors: string[];
}

export function parseAndPreviewStudentCSV(csvBuffer: Buffer): {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: CSVPreviewRow[];
  parsedRecords: Array<{
    identifier: string;
    fullName: string;
    email: string;
    institution: string | null;
    phone: string | null;
  }>;
} {
  let records: any[];
  try {
    records = parse(csvBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err: any) {
    throw new AppError('VALIDATION_FAILED', `Gagal membaca format CSV: ${err.message}`);
  }

  if (records.length > CONSTANTS.CSV_MAX_ROWS) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Jumlah baris CSV melebihi batas maksimum (${CONSTANTS.CSV_MAX_ROWS} baris).`
    );
  }

  const previewRows: CSVPreviewRow[] = [];
  const parsedRecords: Array<{
    identifier: string;
    fullName: string;
    email: string;
    institution: string | null;
    phone: string | null;
  }> = [];

  const seenIdentifiers = new Set<string>();
  const seenEmails = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const rowNum = i + 2; // baris 1 header
    const rowErrors: string[] = [];

    // Sanitize formula injection prefixes (=, +, -, @)
    const cleanField = (val: any) => {
      if (typeof val !== 'string') return '';
      let s = val.trim();
      if (/^[=+\-@]/.test(s)) {
        s = `'` + s; // neutralize formula prefix
      }
      return s;
    };

    const identifier = cleanField(raw.nomor_identitas);
    const fullName = cleanField(raw.nama);
    const email = cleanField(raw.email).toLowerCase();
    const institution = cleanField(raw.instansi) || null;
    const phone = cleanField(raw.telepon) || null;

    if (!identifier) {
      rowErrors.push('nomor_identitas wajib diisi');
    } else if (seenIdentifiers.has(identifier)) {
      rowErrors.push(`nomor_identitas "${identifier}" duplikat dalam berkas CSV`);
    } else {
      seenIdentifiers.add(identifier);
    }

    if (!fullName) {
      rowErrors.push('nama wajib diisi');
    }

    if (!email) {
      rowErrors.push('email wajib diisi');
    } else if (!email.includes('@')) {
      rowErrors.push(`format email "${email}" tidak valid`);
    } else if (seenEmails.has(email)) {
      rowErrors.push(`email "${email}" duplikat dalam berkas CSV`);
    } else {
      seenEmails.add(email);
    }

    previewRows.push({
      rowNumber: rowNum,
      identifier,
      name: fullName,
      email,
      institution: institution || undefined,
      phone: phone || undefined,
      errors: rowErrors,
    });

    if (rowErrors.length === 0) {
      parsedRecords.push({
        identifier,
        fullName,
        email,
        institution,
        phone,
      });
    }
  }

  const invalidCount = previewRows.filter((r) => r.errors.length > 0).length;

  return {
    totalRows: previewRows.length,
    validRows: parsedRecords.length,
    invalidRows: invalidCount,
    rows: previewRows,
    parsedRecords,
  };
}

export async function commitStudentImport(
  studentsToImport: Array<{
    identifier: string;
    fullName: string;
    email: string;
    institution: string | null;
    phone: string | null;
  }>,
  adminActorId: string,
  ipAddress?: string
): Promise<{
  importId: string;
  totalImported: number;
  skippedCount: number;
}> {
  const client = await pool.connect();
  const credentials: ImportCredentialItem[] = [];

  try {
    await client.query('BEGIN;');

    let imported = 0;
    let skipped = 0;

    for (const student of studentsToImport) {
      // Check existing in DB
      const check = await client.query(
        `SELECT u.id FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE (lower(u.email) = $1 OR sp.identifier = $2) AND u.deleted_at IS NULL;`,
        [student.email.toLowerCase(), student.identifier]
      );

      if (check.rows.length > 0) {
        skipped++;
        continue;
      }

      const tempPassword = generateSecureTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      const { rows: uRows } = await client.query(
        `INSERT INTO users (email, password_hash, role, status, must_change_password)
         VALUES ($1, $2, 'student', 'active', false)
         RETURNING id;`,
        [student.email.toLowerCase(), passwordHash]
      );
      const userId = uRows[0].id;

      await client.query(
        `INSERT INTO student_profiles (user_id, identifier, full_name, institution, phone)
         VALUES ($1, $2, $3, $4, $5);`,
        [userId, student.identifier, student.fullName, student.institution, student.phone]
      );

      await client.query(
        `INSERT INTO user_settings (user_id, preferences) VALUES ($1, '{}'::jsonb);`,
        [userId]
      );

      credentials.push({
        identifier: student.identifier,
        name: student.fullName,
        email: student.email,
        tempPassword,
      });

      imported++;
    }

    const importId = crypto.randomUUID();

    // Store in one-time download map (TTL: 1 hour)
    importCredentialsStore.set(importId, {
      expiresAt: Date.now() + 60 * 60 * 1000,
      credentials,
    });

    await logAudit(
      {
        actorId: adminActorId,
        actorRole: 'admin',
        action: 'students.import_csv',
        entityType: 'users',
        reason: `Bulk import ${imported} students from CSV (skipped ${skipped})`,
        afterData: { total_imported: imported, skipped },
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');

    return {
      importId,
      totalImported: imported,
      skippedCount: skipped,
    };
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

export function downloadImportCredentials(importId: string): string {
  const item = importCredentialsStore.get(importId);
  if (!item || item.expiresAt <= Date.now()) {
    throw new AppError('NOT_FOUND', 'Berkas kredensial tidak ditemukan atau telah kedaluwarsa/sudah pernah diunduh.');
  }

  // Remove immediately on download (single-download requirement, Appendix B.2)
  importCredentialsStore.delete(importId);

  const csvRows = item.credentials.map((c) => ({
    nomor_identitas: c.identifier,
    nama: c.name,
    email: c.email,
    sandi_sementara: c.tempPassword,
  }));

  return stringify(csvRows, {
    header: true,
    columns: ['nomor_identitas', 'nama', 'email', 'sandi_sementara'],
  });
}

export async function resetUserPassword(
  targetUserId: string,
  adminActorId: string,
  ipAddress?: string
): Promise<{ tempPassword: string }> {
  const targetUser = await prisma.users.findFirst({
    where: { id: targetUserId, deleted_at: null },
    select: { id: true, email: true, role: true },
  });
  if (!targetUser) {
    throw new AppError('NOT_FOUND');
  }

  const tempPassword = generateNumeric6DigitPassword();
  const passwordHash = await hashPassword(tempPassword);

  await prisma.$transaction(async (tx) => {
    await tx.users.update({
      where: { id: targetUserId },
      data: {
        password_hash: passwordHash,
        must_change_password: false,
      },
    });

    // Revoke all sessions for target user
    await tx.auth_sessions.updateMany({
      where: { user_id: targetUserId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    await logAudit({
      actorId: adminActorId,
      actorRole: 'admin',
      action: 'users.reset_password',
      entityType: 'users',
      entityId: targetUserId,
      reason: 'Administrator reset user password',
      ipAddress,
    });
  });

  return { tempPassword };
}

export async function unlockUserAccount(
  targetUserId: string,
  adminActorId: string,
  ipAddress?: string
): Promise<void> {
  const targetUser = await prisma.users.findFirst({
    where: { id: targetUserId, deleted_at: null },
  });
  if (!targetUser) {
    throw new AppError('NOT_FOUND');
  }

  await prisma.users.update({
    where: { id: targetUserId },
    data: {
      failed_login_count: 0,
      locked_until: null,
    },
  });

  await logAudit({
    actorId: adminActorId,
    actorRole: 'admin',
    action: 'users.unlock',
    entityType: 'users',
    entityId: targetUserId,
    reason: 'Administrator unlocked user account',
    ipAddress,
  });
}
