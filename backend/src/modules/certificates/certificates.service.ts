import { PoolClient } from 'pg';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { pool } from '../../db/connection.js';
import { AppError } from '../../lib/errors.js';
import { generateVerificationCode } from '../../lib/hash.js';
import { logAudit } from '../audit/audit.service.js';
import { getInstitutionSettings } from '../settings/settings.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getTemplateImagePath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'image/template/templete_sertifikat.jpg'),
    path.resolve(process.cwd(), 'backend/image/template/templete_sertifikat.jpg'),
    path.resolve(process.cwd(), '../backend/image/template/templete_sertifikat.jpg'),
    path.resolve(__dirname, '../../../image/template/templete_sertifikat.jpg'),
    path.resolve(__dirname, '../../../../image/template/templete_sertifikat.jpg'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export async function generateCertificateNumber(client: PoolClient, year: number): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO certificate_counters (year, last_seq)
     VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE
     SET last_seq = certificate_counters.last_seq + 1
     RETURNING last_seq;`,
    [year]
  );

  const seq = rows[0].last_seq;
  const seqFormatted = String(seq).padStart(4, '0');
  return `CERT-${year}-${seqFormatted}`;
}

export async function issueCertificateForResult(
  resultId: string,
  adminActorId?: string | null,
  client?: PoolClient,
  actorRole: 'admin' | 'student' | 'mahasiswa' | 'umum' = 'admin'
): Promise<any> {
  const executor = client || pool;

  // Verifikasi apakah hasil benar-benar ada dan lulus (passed = true, INV-09)
  const { rows: resRows } = await executor.query(
    `SELECT passed, status FROM results WHERE id = $1;`,
    [resultId]
  );
  if (resRows.length === 0) {
    throw new AppError('NOT_FOUND', 'Hasil ujian tidak ditemukan.');
  }
  if (!resRows[0].passed) {
    throw new AppError('FORBIDDEN', 'Sertifikat hanya dapat diterbitkan untuk peserta yang lulus.');
  }

  // Cek apakah sertifikat valid sudah ada (idempoten)
  const { rows: existing } = await executor.query(
    `SELECT * FROM certificates WHERE result_id = $1 AND status = 'valid';`,
    [resultId]
  );
  if (existing.length > 0) {
    return existing[0];
  }

  // Dapatkan tahun saat ini
  const year = new Date().getFullYear();
  let certNo: string;

  if (client) {
    certNo = await generateCertificateNumber(client, year);
  } else {
    const c = await pool.connect();
    try {
      await c.query('BEGIN;');
      certNo = await generateCertificateNumber(c, year);
      await c.query('COMMIT;');
    } catch (err) {
      await c.query('ROLLBACK;');
      throw err;
    } finally {
      c.release();
    }
  }

  const verifyCode = generateVerificationCode();

  const { rows } = await executor.query(
    `INSERT INTO certificates (
      result_id, certificate_no, verification_code, status, issued_by
    ) VALUES ($1, $2, $3, 'valid', $4)
    RETURNING *;`,
    [resultId, certNo, verifyCode, adminActorId || null]
  );

  await logAudit(
    {
      actorId: adminActorId,
      actorRole: adminActorId ? actorRole : null,
      action: 'certificates.issue',
      entityType: 'certificates',
      entityId: rows[0].id,
      afterData: rows[0],
    },
    client
  );

  // Otomatis masukkan pengiriman sertifikat ke email kampus mahasiswa (Asinkron & Idempoten)
  try {
    const { queueCertificateEmail } = await import('../email/email.service.js');
    await queueCertificateEmail(rows[0].id, client);
  } catch (emailErr) {
    console.error('[CERTIFICATE] Gagal mengantrekan pengiriman email sertifikat:', emailErr);
  }

  return rows[0];
}

export async function revokeCertificate(
  certificateId: string,
  reason: string,
  source: 'manual' | 'regrade',
  adminActorId?: string | null,
  client?: PoolClient,
  actorRole: 'admin' | 'student' | 'mahasiswa' | 'umum' = 'admin'
) {
  const executor = client || pool;

  const { rows } = await executor.query(
    `UPDATE certificates
     SET status = 'revoked',
         revoked_at = now(),
         revoke_source = $1,
         revoked_reason = $2
     WHERE id = $3 AND status = 'valid'
     RETURNING *;`,
    [source, reason.trim(), certificateId]
  );

  if (rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Sertifikat tidak ditemukan atau sudah dicabut.');
  }

  await logAudit(
    {
      actorId: adminActorId,
      actorRole: adminActorId ? actorRole : null,
      action: 'certificates.revoke',
      entityType: 'certificates',
      entityId: certificateId,
      reason,
      afterData: rows[0],
    },
    client
  );

  return rows[0];
}

export async function verifyCertificatePublic(code: string) {
  const query = `
    SELECT 
      c.certificate_no, c.verification_code, c.status, c.issued_at,
      c.revoked_at, c.revoked_reason,
      r.score, r.passed,
      sp.full_name AS student_name, sp.identifier, sp.institution,
      e.title AS exam_title
    FROM certificates c
    JOIN results r ON r.id = c.result_id
    JOIN attempts a ON a.id = r.attempt_id
    JOIN session_enrollments se ON se.id = a.enrollment_id
    JOIN student_profiles sp ON sp.user_id = se.student_id
    JOIN exam_sessions s ON s.id = se.session_id
    JOIN exams e ON e.id = s.exam_id
    WHERE c.verification_code = $1 OR c.certificate_no = $1;
  `;

  const { rows } = await pool.query(query, [code.trim()]);
  if (rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Sertifikat dengan kode verifikasi tersebut tidak ditemukan.');
  }

  const cert = rows[0];
  return {
    is_valid: cert.status === 'valid',
    certificate_no: cert.certificate_no,
    verification_code: cert.verification_code,
    status: cert.status,
    issued_at: cert.issued_at,
    revoked_at: cert.revoked_at,
    revoked_reason: cert.revoked_reason,
    recipient: {
      name: cert.student_name,
      identifier: cert.identifier,
      institution: cert.institution || 'Umum',
    },
    exam: {
      title: cert.exam_title,
      score: cert.score,
      passed: cert.passed,
    },
  };
}

export async function generateCertificatePDFBuffer(
  certificateId: string,
  baseUrl: string = 'http://localhost:3000'
): Promise<Buffer> {
  const query = `
    SELECT 
      c.certificate_no, c.verification_code, c.status, c.issued_at,
      r.score,
      sp.full_name AS student_name, sp.identifier, sp.institution,
      e.title AS exam_title
    FROM certificates c
    JOIN results r ON r.id = c.result_id
    JOIN attempts a ON a.id = r.attempt_id
    JOIN session_enrollments se ON se.id = a.enrollment_id
    JOIN student_profiles sp ON sp.user_id = se.student_id
    JOIN exam_sessions s ON s.id = se.session_id
    JOIN exams e ON e.id = s.exam_id
    WHERE c.id = $1;
  `;

  const { rows } = await pool.query(query, [certificateId]);
  if (rows.length === 0) throw new AppError('NOT_FOUND');

  const cert = rows[0];
  const settings = await getInstitutionSettings();
  const cleanBase = baseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  const verifyUrl = `${cleanBase}/verify/${cert.verification_code}`;

  const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 300, margin: 1, errorCorrectionLevel: 'H' });
  const templatePath = getTemplateImagePath();

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0,
    });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    if (templatePath && fs.existsSync(templatePath)) {
      // 1. Gambar latar belakang template resmi (1439 x 1057 px)
      doc.image(templatePath, 0, 0, { width: doc.page.width, height: doc.page.height });

      const scaleX = doc.page.width / 1439;
      const scaleY = doc.page.height / 1057;

      // 2. Nama Lengkap Peserta (Tepat di bawah "Dengan ini menyatakan bahwa :")
      const studentName = (cert.student_name || 'PESERTA UJI KOMPETENSI').toUpperCase();
      const nameSize = studentName.length > 36 ? 18 : studentName.length > 26 ? 21 : 24;
      doc.fontSize(nameSize).font('Helvetica-Bold').fillColor('#340E63')
         .text(studentName, 0, 404 * scaleY, { align: 'center', width: doc.page.width });

      // 3. Nama Ujian / Asesmen (Tepat di bawah "telah mengikuti dan menyelesaikan :")
      const examTitle = (cert.exam_title || 'ASESMEN KOMPETENSI').toUpperCase();
      const examSize = examTitle.length > 45 ? 14 : examTitle.length > 32 ? 16 : 18;
      doc.fontSize(examSize).font('Helvetica-Bold').fillColor('#340E63')
         .text(examTitle, 0, 524 * scaleY, { align: 'center', width: doc.page.width });

      // 4. Nilai Asesmen (Tepat di dalam badge pita ungu)
      const scoreFormatted = Number.isInteger(Number(cert.score)) ? Number(cert.score) : Number(cert.score).toFixed(1);
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#FFFFFF')
         .text(`NILAI ASESMEN: ${scoreFormatted}/100`, 0, 698 * scaleY, { align: 'center', width: doc.page.width });

      // 5. Kota & Tanggal Penerbitan (Kanan atas garis, miring)
      const issuedDate = new Date(cert.issued_at || Date.now());
      const dateFormatted = issuedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.fontSize(12).font('Helvetica-Oblique').fillColor('#1E1B26')
         .text(`${settings.cert_city || 'Pamekasan'}, ${dateFormatted}`, 800 * scaleX, 850 * scaleY, { align: 'right', width: (1358 - 800) * scaleX });

      // 6. Barcode / QR Code Keabsahan (Di kiri bawah)
      doc.image(qrBuffer, 124 * scaleX, 788 * scaleY, { width: 156 * scaleX, height: 156 * scaleY });

      // 7. Nomor Sertifikat (Tepat di bawah QR Code sebelah kiri)
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1E1B26')
         .text(cert.certificate_no, 122 * scaleX, 968 * scaleY, { align: 'center', width: 158 * scaleX });

      // 8. Tanda Jika Dicabut (Watermark)
      if (cert.status === 'revoked') {
        doc.save();
        doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
        doc.fontSize(55).font('Helvetica-Bold').fillColor('#ef4444', 0.45)
           .text('DICABUT / TIDAK BERLAKU', doc.page.width / 2 - 320, doc.page.height / 2 - 30);
        doc.restore();
      }
    } else {
      // Fallback
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(3).stroke('#1e3a8a');
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#1e3a8a').text('SERTIFIKAT KELULUSAN UJI KOMPETENSI', { align: 'center' });
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text(cert.student_name, { align: 'center' });
      doc.fontSize(17).font('Helvetica-Bold').fillColor('#1e3a8a').text(cert.exam_title, { align: 'center' });
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#059669').text(`Nilai Akhir: ${cert.score} / 100`, { align: 'center' });
      doc.image(qrBuffer, 55, doc.page.height - 165, { width: 80, height: 80 });
    }

    doc.end();
  });
}
