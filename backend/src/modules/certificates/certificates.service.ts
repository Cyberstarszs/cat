import { PoolClient } from 'pg';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { pool } from '../../db/connection.js';
import { AppError } from '../../lib/errors.js';
import { generateVerificationCode } from '../../lib/hash.js';
import { logAudit } from '../audit/audit.service.js';
import { getInstitutionSettings } from '../settings/settings.service.js';

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
  adminActorId: string,
  client?: PoolClient
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
    [resultId, certNo, verifyCode, adminActorId]
  );

  await logAudit(
    {
      actorId: adminActorId,
      actorRole: 'admin',
      action: 'certificates.issue',
      entityType: 'certificates',
      entityId: rows[0].id,
      afterData: rows[0],
    },
    client
  );

  return rows[0];
}

export async function revokeCertificate(
  certificateId: string,
  reason: string,
  source: 'manual' | 'regrade',
  adminActorId: string,
  client?: PoolClient
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
      actorRole: 'admin',
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

  const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 120, margin: 1 });

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
    });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Border decorative
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(3).stroke('#1e3a8a');
    doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50).lineWidth(1).stroke('#3b82f6');

    // Header
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#1e3a8a').text('SERTIFIKAT KELULUSAN UJI KOMPETENSI', {
      align: 'center',
    });
    doc.moveDown(0.2);
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#475569').text(`${settings.faculty_name.toUpperCase()} - ${settings.university_name.toUpperCase()}`, {
      align: 'center',
    });

    doc.moveDown(0.8);
    doc.fontSize(11).font('Helvetica').fillColor('#334155').text('Diberikan kepada:', { align: 'center' });
    doc.moveDown(0.4);

    // Student Name
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text(cert.student_name, { align: 'center' });
    doc.fontSize(11).font('Helvetica').fillColor('#64748b').text(`Nomor Identitas: ${cert.identifier} | Instansi: ${cert.institution || 'Umum'}`, {
      align: 'center',
    });

    doc.moveDown(0.8);
    doc.fontSize(11).font('Helvetica').fillColor('#334155').text('Telah dinyatakan LULUS pada ujian kompetensi:', { align: 'center' });
    doc.moveDown(0.3);

    // Exam Title & Score
    doc.fontSize(17).font('Helvetica-Bold').fillColor('#1e3a8a').text(cert.exam_title, { align: 'center' });
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#059669').text(`Nilai Akhir: ${cert.score} / 100`, { align: 'center' });

    // Watermark if revoked
    if (cert.status === 'revoked') {
      doc.save();
      doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
      doc.fontSize(60).font('Helvetica-Bold').fillColor('#ef4444', 0.25).text('DICABUT / INVALID', doc.page.width / 2 - 250, doc.page.height / 2 - 40);
      doc.restore();
    }

    // Bottom section: No Certificate, Date, Signatory, and QR Code
    const bottomY = doc.page.height - 165;
    doc.image(qrBuffer, 55, bottomY, { width: 80, height: 80 });
    doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Scan QR untuk verifikasi keabsahan', 45, bottomY + 84);
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text(`Kode: ${cert.verification_code}`, 45, bottomY + 95);

    // Validity Info
    const issuedDate = new Date(cert.issued_at);
    const validUntilDate = new Date(issuedDate);
    validUntilDate.setFullYear(validUntilDate.getFullYear() + (settings.cert_validity_years || 2));
    const validUntilStr = validUntilDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.fontSize(9).font('Helvetica').fillColor('#475569')
      .text(`Nomor Sertifikat: ${cert.certificate_no}`, 150, bottomY + 15)
      .text(`Masa Berlaku: s/d ${validUntilStr} (${settings.cert_validity_years} Tahun)`, 150, bottomY + 30);

    // Tanda Tangan Dekan / Pejabat Resmi
    const rightMargin = doc.page.width - 280;
    const dateFormatted = issuedDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.fontSize(10).font('Helvetica').fillColor('#334155').text(`${settings.cert_city}, ${dateFormatted}`, rightMargin, bottomY, { width: 240, align: 'center' });
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a8a').text(settings.decan_title, rightMargin, bottomY + 14, { width: 240, align: 'center' });
    
    // Space for signature
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(settings.decan_name, rightMargin, bottomY + 70, { width: 240, align: 'center', underline: true });
    if (settings.decan_nip) {
      doc.fontSize(9).font('Helvetica').fillColor('#475569').text(`NIP. ${settings.decan_nip}`, rightMargin, bottomY + 85, { width: 240, align: 'center' });
    }

    doc.end();
  });
}
