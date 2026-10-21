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
  role?: string;
  institution?: string;
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
    identifier?: string | null;
    fullName: string;
    email: string;
    institution?: string | null;
    phone?: string | null;
    role?: 'mahasiswa' | 'umum' | 'student';
  },
  adminActorId: string,
  ipAddress?: string
): Promise<{
  id: string;
  identifier: string;
  email: string;
  tempPassword: string;
  role: string;
  fullName: string;
  institution: string;
  phone: string | null;
}> {
  const cleanEmail = data.email.toLowerCase().trim();
  const userRole = data.role === 'umum' ? 'umum' : 'mahasiswa';

  let cleanIdentifier = data.identifier?.trim() || '';
  if (userRole === 'mahasiswa') {
    if (!cleanIdentifier) {
      throw new AppError('VALIDATION_FAILED', 'NIM wajib diisi secara manual untuk mahasiswa.');
    }
  } else {
    if (!cleanIdentifier) {
      let isUnique = false;
      while (!isUnique) {
        const candidate = `UMUM-${Math.floor(100000 + Math.random() * 900000)}`;
        const found = await prisma.student_profiles.findUnique({
          where: { identifier: candidate },
        });
        if (!found) {
          cleanIdentifier = candidate;
          isUnique = true;
        }
      }
    }
  }

  const cleanInstitution = data.institution?.trim() || (userRole === 'umum' ? 'Umum' : 'ADMINISTRASI PUBLIK');

  // Cek duplikasi via Prisma
  const existingEmail = await prisma.users.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' }, deleted_at: null },
  });
  if (existingEmail) {
    throw new AppError('VALIDATION_FAILED', `Email "${cleanEmail}" sudah terdaftar.`);
  }

  const existingIdentifier = await prisma.student_profiles.findUnique({
    where: { identifier: cleanIdentifier },
  });
  if (existingIdentifier) {
    throw new AppError('VALIDATION_FAILED', `${userRole === 'mahasiswa' ? 'NIM' : 'Nomor Peserta'} "${cleanIdentifier}" sudah terdaftar.`);
  }

  const tempPassword = generateNumeric6DigitPassword();
  const passwordHash = await hashPassword(tempPassword);

  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.users.create({
      data: {
        email: cleanEmail,
        password_hash: passwordHash,
        role: userRole as any,
        status: 'active',
        must_change_password: false,
        student_profiles: {
          create: {
            identifier: cleanIdentifier,
            full_name: data.fullName.trim(),
            institution: cleanInstitution,
            phone: data.phone?.trim() || null,
            initial_password: tempPassword,
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
      afterData: { identifier: cleanIdentifier, email: cleanEmail, full_name: data.fullName, role: userRole, institution: cleanInstitution },
      ipAddress,
    });

    return user;
  });

  return {
    id: newUser.id,
    identifier: cleanIdentifier,
    email: cleanEmail,
    role: userRole,
    fullName: data.fullName.trim(),
    institution: cleanInstitution,
    phone: data.phone?.trim() || null,
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
  role?: 'mahasiswa' | 'umum';
  errors: string[];
}

export function detectCsvDelimiter(bufferOrStr: Buffer | string): string {
  const text = typeof bufferOrStr === 'string' ? bufferOrStr : bufferOrStr.toString('utf-8');
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim().length > 0) || '';

  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semiCount > commaCount && semiCount > tabCount) return ';';
  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  return ',';
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
    role: 'mahasiswa' | 'umum';
  }>;
} {
  const delimiter = detectCsvDelimiter(csvBuffer);
  let records: any[];
  try {
    records = parse(csvBuffer, {
      columns: true,
      delimiter,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err: any) {
    throw new AppError('VALIDATION_FAILED', `Gagal membaca format CSV: ${err.message}`);
  }

  if (!records || records.length === 0) {
    return {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      rows: [],
      parsedRecords: [],
    };
  }

  // Pre-mapping nama kolom secara O(1) dari baris pertama, mencegah loop regex berulang
  const keys = Object.keys(records[0] || {});
  const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, '');

  const identifierAliases = ['identifier', 'nomoridentitas', 'nomor_identitas', 'nim', 'nopeserta', 'no_peserta', 'id', 'nomor'];
  const fullNameAliases = ['fullname', 'full_name', 'nama', 'namalengkap', 'nama_lengkap', 'name'];
  const emailAliases = ['email', 'alamatemail', 'alamat_email', 'surel'];
  const institutionAliases = ['institution', 'instansi', 'prodi', 'programstudi', 'program_studi', 'asal', 'universitas', 'sekolah'];
  const phoneAliases = ['phone', 'telepon', 'nohp', 'no_hp', 'notelepon', 'no_telepon', 'telp', 'handphone', 'hp'];

  const findKey = (aliases: string[]): string | null => {
    const normAliases = aliases.map(normalize);
    for (const k of keys) {
      if (normAliases.includes(normalize(k))) return k;
    }
    return null;
  };

  const idCol = findKey(identifierAliases);
  const nameCol = findKey(fullNameAliases);
  const emailCol = findKey(emailAliases);
  const instCol = findKey(institutionAliases);
  const phoneCol = findKey(phoneAliases);

  const previewRows: CSVPreviewRow[] = [];
  const parsedRecords: Array<{
    identifier: string;
    fullName: string;
    email: string;
    institution: string | null;
    phone: string | null;
    role: 'mahasiswa' | 'umum';
  }> = [];

  const seenIdentifiers = new Set<string>();
  const seenEmails = new Set<string>();

  // Sanitize formula injection prefixes (=, +, -, @)
  const cleanField = (val: any) => {
    if (typeof val !== 'string') return '';
    let s = val.trim();
    if (s.length > 0 && (s[0] === '=' || s[0] === '+' || s[0] === '-' || s[0] === '@')) {
      s = "'" + s;
    }
    return s;
  };

  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const rowNum = i + 2; // baris 1 adalah header
    const rowErrors: string[] = [];

    const rawIdentifier = cleanField(idCol ? raw[idCol] : '');
    const fullName = cleanField(nameCol ? raw[nameCol] : '');
    const email = cleanField(emailCol ? raw[emailCol] : '').toLowerCase();
    const rawInstitution = cleanField(instCol ? raw[instCol] : '');
    const rawPhone = cleanField(phoneCol ? raw[phoneCol] : '') || null;

    let phone: string | null = null;
    if (rawPhone) {
      const digitsOnly = rawPhone.replace(/[^0-9+]/g, '');
      if (/^8\d{8,12}$/.test(digitsOnly)) {
        phone = `0${digitsOnly}`;
      } else {
        phone = digitsOnly || null;
      }
    }

    const isUmum =
      rawInstitution.toLowerCase() === 'umum' ||
      rawInstitution.toLowerCase().includes('umum') ||
      (!rawInstitution && !rawIdentifier);

    const role: 'mahasiswa' | 'umum' = isUmum ? 'umum' : 'mahasiswa';
    const institution = isUmum
      ? (rawInstitution || 'Umum')
      : (rawInstitution || 'ADMINISTRASI PUBLIK');

    let identifier = rawIdentifier;

    if (isUmum) {
      if (!identifier) {
        let candidate = `UMUM-${Math.floor(100000 + Math.random() * 900000)}`;
        while (seenIdentifiers.has(candidate)) {
          candidate = `UMUM-${Math.floor(100000 + Math.random() * 900000)}`;
        }
        identifier = candidate;
        seenIdentifiers.add(identifier);
      } else if (seenIdentifiers.has(identifier)) {
        rowErrors.push(`Nomor peserta "${identifier}" duplikat dalam berkas CSV`);
      } else {
        seenIdentifiers.add(identifier);
      }
    } else {
      if (!identifier) {
        rowErrors.push('NIM (Nomor Induk Mahasiswa) wajib diisi untuk mahasiswa/peserta non-umum');
      } else if (seenIdentifiers.has(identifier)) {
        rowErrors.push(`NIM "${identifier}" duplikat dalam berkas CSV`);
      } else {
        seenIdentifiers.add(identifier);
      }
    }

    if (!fullName) {
      rowErrors.push('Nama lengkap wajib diisi');
    }

    if (!email) {
      rowErrors.push('Email wajib diisi');
    } else if (!email.includes('@')) {
      rowErrors.push(`Format email "${email}" tidak valid`);
    } else if (seenEmails.has(email)) {
      rowErrors.push(`Email "${email}" duplikat dalam berkas CSV`);
    } else {
      seenEmails.add(email);
    }

    // Untuk preview UI, batasi maksimal 500 baris agar browser frontend tidak lag saat rendering DOM preview,
    // namun parsedRecords tetap memproses SEMUA baris tanpa batas!
    if (previewRows.length < 500 || rowErrors.length > 0) {
      previewRows.push({
        rowNumber: rowNum,
        identifier,
        name: fullName,
        email,
        institution: institution || undefined,
        phone: phone || undefined,
        role,
        errors: rowErrors,
      });
    }

    if (rowErrors.length === 0) {
      parsedRecords.push({
        identifier,
        fullName,
        email,
        institution,
        phone,
        role,
      });
    }
  }

  const invalidCount = records.length - parsedRecords.length;

  return {
    totalRows: records.length,
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
    role?: 'mahasiswa' | 'umum' | 'student';
  }>,
  adminActorId: string,
  ipAddress?: string
): Promise<{
  importId: string;
  totalImported: number;
  skippedCount: number;
}> {
  let skipped = 0;
  const seenEmails = new Set<string>();
  const seenIdentifiers = new Set<string>();
  const candidates: Array<{
    cleanEmail: string;
    cleanIdentifier: string;
    cleanFullName: string;
    inst: string;
    phone: string | null;
    userRole: 'mahasiswa' | 'umum';
  }> = [];

  for (const student of studentsToImport) {
    const cleanEmail = (student.email || '').trim().toLowerCase();
    const cleanIdentifier = (student.identifier || '').trim();
    const cleanFullName = (student.fullName || '').trim();

    if (!cleanEmail || !cleanIdentifier || !cleanFullName) {
      skipped++;
      continue;
    }

    // Hindari duplikasi intra-batch CSV yang sama
    if (seenEmails.has(cleanEmail) || seenIdentifiers.has(cleanIdentifier)) {
      skipped++;
      continue;
    }

    seenEmails.add(cleanEmail);
    seenIdentifiers.add(cleanIdentifier);

    const userRole = student.role === 'umum' || (student.institution && student.institution.toLowerCase().includes('umum'))
      ? 'umum'
      : 'mahasiswa';
    const inst = student.institution?.trim() || (userRole === 'umum' ? 'Umum' : 'ADMINISTRASI PUBLIK');

    candidates.push({
      cleanEmail,
      cleanIdentifier,
      cleanFullName,
      inst,
      phone: student.phone ? student.phone.trim() : null,
      userRole,
    });
  }

  // Periksa email & identitas yang sudah ada di database (chunking 2000 untuk efisiensi array query)
  const dbEmails = new Set<string>();
  const dbIdents = new Set<string>();

  const CHECK_CHUNK = 2000;
  for (let i = 0; i < candidates.length; i += CHECK_CHUNK) {
    const chunk = candidates.slice(i, i + CHECK_CHUNK);
    const emails = chunk.map((c) => c.cleanEmail);
    const idents = chunk.map((c) => c.cleanIdentifier);

    const { rows } = await pool.query(
      `SELECT lower(u.email) AS email, sp.identifier
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE (lower(u.email) = ANY($1::text[]) OR sp.identifier = ANY($2::text[]))
         AND u.deleted_at IS NULL;`,
      [emails, idents]
    );

    for (const r of rows) {
      if (r.email) dbEmails.add(r.email.toLowerCase());
      if (r.identifier) dbIdents.add(r.identifier);
    }
  }

  const validToImport: typeof candidates = [];
  for (const c of candidates) {
    if (dbEmails.has(c.cleanEmail) || dbIdents.has(c.cleanIdentifier)) {
      skipped++;
    } else {
      validToImport.push(c);
    }
  }

  if (validToImport.length === 0) {
    const importId = crypto.randomUUID();
    return {
      importId,
      totalImported: 0,
      skippedCount: skipped,
    };
  }

  // Generate UUID, sandi sementara dan hash bcrypt secara asinkron dengan event-loop yielding
  // Memakai cost: 8 untuk inisialisasi massal agar ultra-cepat namun tetap standar bcrypt
  const preparedRecords: Array<{
    userId: string;
    cleanEmail: string;
    cleanIdentifier: string;
    cleanFullName: string;
    inst: string;
    phone: string | null;
    userRole: 'mahasiswa' | 'umum';
    tempPassword: string;
    passwordHash: string;
  }> = [];

  const HASH_CHUNK_SIZE = 50;
  for (let i = 0; i < validToImport.length; i += HASH_CHUNK_SIZE) {
    const chunk = validToImport.slice(i, i + HASH_CHUNK_SIZE);
    const hashed = await Promise.all(
      chunk.map(async (item) => {
        const userId = crypto.randomUUID();
        const tempPassword = generateNumeric6DigitPassword();
        const passwordHash = await hashPassword(tempPassword, 8);
        return {
          ...item,
          userId,
          tempPassword,
          passwordHash,
        };
      })
    );
    preparedRecords.push(...hashed);

    if (i + HASH_CHUNK_SIZE < validToImport.length) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  // Batch insert ke PostgreSQL menggunakan UNNEST dalam batch 500 baris
  // Mengurangi ribuan round-trip ke database menjadi beberapa kueri cepat (< 100ms)
  const client = await pool.connect();
  const credentials: ImportCredentialItem[] = [];

  try {
    await client.query('BEGIN;');

    const INSERT_BATCH_SIZE = 500;
    for (let i = 0; i < preparedRecords.length; i += INSERT_BATCH_SIZE) {
      const batch = preparedRecords.slice(i, i + INSERT_BATCH_SIZE);

      const userIds = batch.map((b) => b.userId);
      const emails = batch.map((b) => b.cleanEmail);
      const passwordHashes = batch.map((b) => b.passwordHash);
      const roles = batch.map((b) => b.userRole);

      const idents = batch.map((b) => b.cleanIdentifier);
      const names = batch.map((b) => b.cleanFullName);
      const insts = batch.map((b) => b.inst);
      const phones = batch.map((b) => b.phone);
      const tempPass = batch.map((b) => b.tempPassword);

      // 1. Batch insert users
      await client.query(
        `INSERT INTO users (id, email, password_hash, role, status, must_change_password)
         SELECT u.id, u.email, u.password_hash, u.role::user_role, 'active'::user_status, false
         FROM UNNEST(
           $1::uuid[],
           $2::varchar[],
           $3::text[],
           $4::text[]
         ) AS u(id, email, password_hash, role)
         ON CONFLICT DO NOTHING;`,
        [userIds, emails, passwordHashes, roles]
      );

      // 2. Batch insert student_profiles
      await client.query(
        `INSERT INTO student_profiles (user_id, identifier, full_name, institution, phone, initial_password)
         SELECT sp.user_id, sp.identifier, sp.full_name, sp.institution, sp.phone, sp.initial_password
         FROM UNNEST(
           $1::uuid[],
           $2::varchar[],
           $3::varchar[],
           $4::varchar[],
           $5::varchar[],
           $6::varchar[]
         ) AS sp(user_id, identifier, full_name, institution, phone, initial_password)
         ON CONFLICT (identifier) DO NOTHING;`,
        [userIds, idents, names, insts, phones, tempPass]
      );

      // 3. Batch insert user_settings
      await client.query(
        `INSERT INTO user_settings (user_id, preferences)
         SELECT us.user_id, '{}'::jsonb
         FROM UNNEST($1::uuid[]) AS us(user_id)
         ON CONFLICT (user_id) DO NOTHING;`,
        [userIds]
      );

      for (const item of batch) {
        credentials.push({
          identifier: item.cleanIdentifier,
          name: item.cleanFullName,
          email: item.cleanEmail,
          tempPassword: item.tempPassword,
          role: item.userRole,
          institution: item.inst,
        });
      }
    }

    const importId = crypto.randomUUID();

    // Simpan kredensial unduhan satu kali (TTL: 1 jam)
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
        reason: `Bulk import ${credentials.length} students from CSV (skipped ${skipped})`,
        afterData: { total_imported: credentials.length, skipped },
        ipAddress,
      },
      client
    );

    await client.query('COMMIT;');

    return {
      importId,
      totalImported: credentials.length,
      skippedCount: skipped,
    };
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK;').catch(() => {});
    }
    throw err;
  } finally {
    if (client) {
      client.release();
    }
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
    peran: c.role || 'mahasiswa',
    instansi: c.institution || '-',
    sandi_6_angka: c.tempPassword,
  }));

  return stringify(csvRows, {
    header: true,
    columns: ['nomor_identitas', 'nama', 'email', 'peran', 'instansi', 'sandi_6_angka'],
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

    if (targetUser.role !== 'admin') {
      await tx.student_profiles.updateMany({
        where: { user_id: targetUserId },
        data: { initial_password: tempPassword },
      });
    }

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
