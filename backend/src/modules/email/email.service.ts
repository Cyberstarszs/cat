import nodemailer from 'nodemailer';
import { PoolClient } from 'pg';
import { pool } from '../../db/connection.js';
import { env } from '../../config/env.js';
import { getSmtpSettings, getInstitutionSettings, SmtpSettings } from '../settings/settings.service.js';
import { generateCertificatePDFBuffer } from '../certificates/certificates.service.js';

export interface EmailOutboxItem {
  id: string;
  certificate_id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body_html: string;
  body_text: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  max_attempts: number;
  last_error?: string | null;
  next_retry_at: string;
  sent_at?: string | null;
  created_at: string;
  // Extra fields from join
  identifier?: string;
  certificate_no?: string;
}

/**
 * Memasukkan email sertifikat mahasiswa ke antrean outbox (Idempoten).
 * Tidak memblokir pengerjaan ujian ataupun proses penerbitan sertifikat.
 */
export async function queueCertificateEmail(
  certificateId: string,
  client?: PoolClient
): Promise<string | null> {
  const executor = client || pool;

  const query = `
    SELECT 
      c.id AS certificate_id, c.certificate_no, c.verification_code,
      r.score,
      sp.full_name AS student_name, sp.identifier,
      u.email,
      e.title AS exam_title,
      s.name AS session_name
    FROM certificates c
    JOIN results r ON r.id = c.result_id
    JOIN attempts a ON a.id = r.attempt_id
    JOIN session_enrollments se ON se.id = a.enrollment_id
    JOIN users u ON u.id = se.student_id
    JOIN student_profiles sp ON sp.user_id = u.id
    JOIN exam_sessions s ON s.id = se.session_id
    JOIN exams e ON e.id = s.exam_id
    WHERE c.id = $1 AND c.status = 'valid';
  `;

  const { rows } = await executor.query(query, [certificateId]);
  if (rows.length === 0) return null;

  const data = rows[0];
  const recipientEmail = data.email?.trim();
  if (!recipientEmail || !recipientEmail.includes('@')) {
    console.warn(`[EMAIL_QUEUE] Dilewati: Mahasiswa ${data.student_name} (${data.identifier}) tidak memiliki email valid.`);
    return null;
  }

  const institution = await getInstitutionSettings();
  const verifyUrl = `${env.BASE_URL.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '')}/verify/${data.verification_code}`;

  const subject = `[${institution.cert_no_prefix || 'CAT FIA UNIRA'}] Sertifikat Kelulusan Uji Kompetensi - ${data.student_name} (${data.identifier})`;

  // HTML Body dengan layout elegan FIA UNIRA (Anti-spam friendly)
  const bodyHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8f6fb; margin: 0; padding: 20px; color: #24212b; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e6e1eb; overflow: hidden; box-shadow: 0 4px 16px rgba(53,33,72,0.06); }
    .header { background: linear-gradient(135deg, #352148 0%, #583682 60%, #754ead 100%); color: #ffffff; padding: 32px 28px; text-align: center; }
    .header h1 { margin: 0 0 6px; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 32px 28px; }
    .salutation { font-size: 15px; font-weight: 600; margin-bottom: 16px; color: #24212b; }
    .info-box { background: #faf9fc; border: 1px solid #eae2f5; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e6e1eb; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #595562; font-weight: 500; }
    .info-val { font-weight: 700; color: #24212b; text-align: right; }
    .badge-passed { display: inline-block; background: #eaf4ef; color: #287a58; padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 12px; }
    .btn { display: inline-block; background: #583682; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-weight: 700; margin-top: 10px; }
    .footer { background: #f6f2fa; border-top: 1px solid #e6e1eb; padding: 20px 28px; text-align: center; font-size: 11px; color: #8e859b; }
    .disclaimer { font-size: 10px; color: #a89cb8; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SERTIFIKAT KELULUSAN UJI KOMPETENSI</h1>
      <p>${institution.faculty_name} — ${institution.university_name}</p>
    </div>
    <div class="content">
      <div class="salutation">Yth. Saudara/i ${data.student_name},</div>
      <p style="font-size: 13px; line-height: 1.6; color: #595562;">
        Selamat! Anda telah dinyatakan <strong>LULUS</strong> pada pelaksanaan Uji Kompetensi Berbasis Komputer (CAT). 
        Berikut rincian kelulusan dan dokumen sertifikat resmi Anda:
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Nama Lengkap</span>
          <span class="info-val">${data.student_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">NIM / No. Identitas</span>
          <span class="info-val font-mono">${data.identifier}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Paket Ujian</span>
          <span class="info-val">${data.exam_title}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Sesi Ujian</span>
          <span class="info-val">${data.session_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Nilai Akhir</span>
          <span class="info-val" style="color: #287a58; font-size: 15px;">${data.score} / 100</span>
        </div>
        <div class="info-row">
          <span class="info-label">Nomor Sertifikat</span>
          <span class="info-val font-mono" style="color: #583682;">${data.certificate_no}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status Kelulusan</span>
          <span class="info-val"><span class="badge-passed">LULUS KOMPETEN</span></span>
        </div>
      </div>

      <p style="font-size: 12.5px; line-height: 1.6; color: #595562;">
        Dokumen resmi sertifikat PDF bertanda tangan digital dan ber-QR Code telah kami lampirkan langsung pada email ini. 
        Anda juga dapat memverifikasi keaslian dokumen secara publik melalui tautan di bawah ini:
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${verifyUrl}" class="btn" target="_blank">Verifikasi Keaslian Sertifikat &rarr;</a>
      </div>
    </div>
    <div class="footer">
      <div>Sistem Uji Kompetensi CAT Governance • FIA Universitas Madura</div>
      <div>Alamat: Jl. Raya Panglegur KM 3.5, Pamekasan, Jawa Timur</div>
      <div class="disclaimer">
        Email ini dikirimkan secara otomatis oleh sistem. Harap tidak membalas langsung ke email ini.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Plain-text alternative (Wajib untuk rasio spam filter yang sehat)
  const bodyText = `
SERTIFIKAT KELULUSAN UJI KOMPETENSI
${institution.faculty_name} — ${institution.university_name}
===============================================================

Yth. Saudara/i ${data.student_name},

Selamat! Anda telah dinyatakan LULUS pada ujian kompetensi CAT.
Rincian Sertifikat Anda:
- Nama: ${data.student_name}
- NIM / Identitas: ${data.identifier}
- Ujian: ${data.exam_title}
- Skor Akhir: ${data.score} / 100
- Nomor Sertifikat: ${data.certificate_no}
- Status: LULUS

Dokumen sertifikat resmi dalam format PDF telah dilampirkan pada email ini.
Verifikasi keabsahan sertifikat dapat diakses melalui tautan berikut:
${verifyUrl}

===============================================================
CAT Governance • FIA Universitas Madura
(Email ini dikirimkan otomatis oleh sistem)
  `.trim();

  const insertQuery = `
    INSERT INTO email_outbox (
      certificate_id, recipient_email, recipient_name,
      subject, body_html, body_text, status, attempts, next_retry_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0, now())
    ON CONFLICT DO NOTHING
    RETURNING id;
  `;

  const { rows: inserted } = await executor.query(insertQuery, [
    certificateId,
    recipientEmail,
    data.student_name,
    subject,
    bodyHtml,
    bodyText,
  ]);

  if (inserted.length > 0) {
    console.log(`[EMAIL_QUEUE] Berhasil mengantrekan sertifikat ${data.certificate_no} untuk ${recipientEmail}`);
    return inserted[0].id;
  }

  return null;
}

/**
 * Membuat nodemailer transporter berdasarkan pengaturan SMTP institusi
 */
export function createSmtpTransporter(smtp: SmtpSettings) {
  if (!smtp.host || !smtp.user || !smtp.pass) {
    return null; // Mock / Dev mode fallback
  }

  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 587,
    secure: smtp.secure || false,
    auth: {
      user: smtp.user.trim(),
      pass: smtp.pass.replace(/\s+/g, ''),
    },
    // Pool connection for efficiency & avoiding handshake spam
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    rateDelta: 60000,
    rateLimit: smtp.rate_limit_per_minute || 20,
    tls: {
      rejectUnauthorized: false, // Memudahkan kompatibilitas server email internal kampus
    },
  });
}

/**
 * Mengirim satu item email outbox dengan lampiran PDF sertifikat
 */
export async function sendOutboxEmail(
  item: EmailOutboxItem,
  smtp: SmtpSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Generate buffer PDF sertifikat terkini
    const pdfBuffer = await generateCertificatePDFBuffer(item.certificate_id, env.BASE_URL);

    // 2. Transporter SMTP
    const transporter = createSmtpTransporter(smtp);

    const fromAddress = `"${smtp.from_name || 'CAT FIA UNIRA'}" <${smtp.from_email || 'cat-noreply@unira.ac.id'}>`;

    if (!transporter) {
      // Mock Mode: jika SMTP belum dikonfigurasi password-nya, log ke console agar sistem tidak macet
      console.log(`[EMAIL_WORKER][MOCK] Mengirim email sertifikat ke ${item.recipient_email} (${item.subject}) - Ukuran PDF: ${pdfBuffer.length} bytes`);
      await new Promise((r) => setTimeout(r, 400)); // Simulasi jeda pengiriman

      await pool.query(
        `UPDATE email_outbox
         SET status = 'sent', sent_at = now(), last_error = NULL
         WHERE id = $1;`,
        [item.id]
      );
      return { success: true };
    }

    // 3. Kirim via SMTP asli kampus
    await transporter.sendMail({
      from: fromAddress,
      to: `"${item.recipient_name}" <${item.recipient_email}>`,
      subject: item.subject,
      text: item.body_text,
      html: item.body_html,
      headers: {
        'X-Mailer': 'CAT-Governance-Mailer/2.4',
        'X-Auto-Response-Suppress': 'All',
        'Precedence': 'bulk',
      },
      attachments: [
        {
          filename: `Sertifikat_CAT_${item.identifier || 'FIA'}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    await pool.query(
      `UPDATE email_outbox
       SET status = 'sent', sent_at = now(), last_error = NULL
       WHERE id = $1;`,
      [item.id]
    );

    console.log(`[EMAIL_WORKER] Berhasil mengirim email sertifikat ke ${item.recipient_email}`);
    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[EMAIL_WORKER] Gagal mengirim email outbox ${item.id} ke ${item.recipient_email}:`, errorMsg);

    const nextAttempts = item.attempts + 1;
    // Exponential backoff: 30s, 2m, 8m, 32m
    const delaySeconds = Math.min(1800, Math.pow(2, nextAttempts) * 15);
    const newStatus = nextAttempts >= item.max_attempts ? 'failed' : 'pending';

    await pool.query(
      `UPDATE email_outbox
       SET status = $1,
           attempts = $2,
           last_error = $3,
           next_retry_at = now() + ($4 || ' seconds')::interval
       WHERE id = $5;`,
      [newStatus, nextAttempts, errorMsg.substring(0, 500), delaySeconds, item.id]
    );

    return { success: false, error: errorMsg };
  }
}

/**
 * Uji coba koneksi SMTP (Dipanggil dari panel Admin Settings)
 */
export async function testSmtpConnection(
  smtp: SmtpSettings,
  testRecipient?: string
): Promise<{ success: boolean; message: string }> {
  if (!smtp.host || !smtp.user || !smtp.pass) {
    return {
      success: false,
      message: 'Konfigurasi SMTP belum lengkap. Masukkan host, user, dan password SMTP kampus terlebih dahulu.',
    };
  }

  const transporter = createSmtpTransporter(smtp);
  if (!transporter) {
    return { success: false, message: 'Gagal menginisialisasi modul SMTP transporter.' };
  }

  try {
    // 1. Verifikasi koneksi & handshake autentikasi
    await transporter.verify();

    // 2. Jika ada alamat penerima uji coba, kirim email test
    if (testRecipient && testRecipient.includes('@')) {
      await transporter.sendMail({
        from: `"${smtp.from_name || 'CAT FIA UNIRA'}" <${smtp.from_email || 'cat-noreply@unira.ac.id'}>`,
        to: testRecipient.trim(),
        subject: '[TEST] Uji Koneksi Pengiriman Email CAT FIA UNIRA',
        text: 'Ini adalah email uji coba untuk memverifikasi bahwa server SMTP kampus telah terkonfigurasi dengan benar.',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #24212b;">
            <h2 style="color: #583682;">Koneksi SMTP Berhasil!</h2>
            <p>Pengaturan email kampus untuk pengiriman sertifikat CAT Governance Fakultas Ilmu Administrasi (FIA) Universitas Madura telah aktif dan berjalan normal.</p>
            <p style="font-size: 12px; color: #8e859b;">Waktu Pengujian: ${new Date().toLocaleString('id-ID')}</p>
          </div>
        `,
      });
      return {
        success: true,
        message: `Koneksi SMTP terhubung dan email uji coba berhasil dikirimkan ke ${testRecipient}!`,
      };
    }

    return {
      success: true,
      message: 'Koneksi ke server SMTP kampus berhasil diverifikasi (Handshake Sukses)!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menghubungkan ke server SMTP: ${err?.message || String(err)}`,
    };
  }
}
