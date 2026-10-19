import PDFDocument from 'pdfkit';
import { pool } from '../../db/connection.js';
import { AppError } from '../../lib/errors.js';
import { logAudit } from '../audit/audit.service.js';

export async function generateSessionCredentialsPDF(
  sessionId: string,
  adminActorId: string,
  ipAddress?: string
): Promise<{ pdfBuffer: Buffer; sessionCode: string; sessionName: string; totalParticipants: number }> {
  // 1. Ambil data sesi & ujian
  const { rows: sessionRows } = await pool.query(
    `SELECT s.*, e.title AS exam_title
     FROM exam_sessions s
     JOIN exams e ON e.id = s.exam_id
     WHERE s.id = $1;`,
    [sessionId]
  );
  if (sessionRows.length === 0) {
    throw new AppError('NOT_FOUND', 'Sesi ujian tidak ditemukan');
  }
  const session = sessionRows[0];

  // 2. Ambil seluruh peserta terdaftar
  const { rows: participants } = await pool.query(
    `SELECT 
       sp.identifier,
       sp.full_name,
       sp.institution,
       sp.initial_password,
       u.email,
       u.role
     FROM session_enrollments se
     JOIN student_profiles sp ON sp.user_id = se.student_id
     JOIN users u ON u.id = se.student_id
     WHERE se.session_id = $1
     ORDER BY sp.identifier ASC;`,
    [sessionId]
  );

  if (participants.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'Belum ada peserta yang didaftarkan ke sesi ini.');
  }

  // Format tanggal & jam sesi dalam WIB
  const formatWib = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).format(new Date(dateStr)) + ' WIB';
    } catch {
      return dateStr;
    }
  };

  const scheduleText = `${formatWib(session.starts_at)} s/d ${formatWib(session.ends_at)}`;

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    // Ukuran A4 standar portrait: [595.28, 841.89] pt
    const doc = new PDFDocument({
      size: 'A4',
      margin: 30,
      autoFirstPage: true,
      info: {
        Title: `Kartu Kredensial Peserta - ${session.code}`,
        Author: 'FIA Universitas Madura CAT System',
        Subject: `Kartu Login Ujian Sesi ${session.name}`,
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    // Layout Grid: 2 Kolom x 3 Baris = 6 Kartu per halaman A4
    const cardWidth = 255;
    const cardHeight = 238;
    const startX = 30;
    const startY = 30;
    const gapX = 25;
    const gapY = 25;
    const cardsPerPage = 6;

    participants.forEach((student, index) => {
      const cardOnPageIndex = index % cardsPerPage;

      if (index > 0 && cardOnPageIndex === 0) {
        doc.addPage();
      }

      const col = cardOnPageIndex % 2;
      const row = Math.floor(cardOnPageIndex / 2);

      const x = startX + col * (cardWidth + gapX);
      const y = startY + row * (cardHeight + gapY);

      // 1. Border luar bergaris putus-putus rapi untuk panduan gunting / potong
      doc.save();
      doc.dash(4, { space: 3 });
      doc.lineWidth(0.8);
      doc.strokeColor('#a59eb2');
      doc.rect(x, y, cardWidth, cardHeight).stroke();
      doc.restore();

      // 2. Background kartu
      doc.rect(x + 1, y + 1, cardWidth - 2, cardHeight - 2).fillColor('#ffffff').fill();

      // 3. Header kartu ungu elegan FIA UNIRA
      doc.rect(x + 1, y + 1, cardWidth - 2, 44).fillColor('#583682').fill();

      // Judul Header
      doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text('KARTU LOGIN PESERTA UJIAN', x + 8, y + 7, { width: cardWidth - 16, align: 'center' });

      doc.font('Helvetica')
        .fontSize(7.5)
        .fillColor('#e6dcf3')
        .text('FAKULTAS ILMU ADMINISTRASI - UNIVERSITAS MADURA', x + 8, y + 20, { width: cardWidth - 16, align: 'center' });

      doc.font('Helvetica-Bold')
        .fontSize(7)
        .fillColor('#f9f638')
        .text(`${session.code} • ${session.name}`, x + 8, y + 31, { width: cardWidth - 16, align: 'center', ellipsis: true });

      // 4. Data Peserta
      const bodyY = y + 52;

      // NIM / No. Peserta
      doc.fillColor('#595562')
        .font('Helvetica')
        .fontSize(7.5)
        .text('NIM / NO. PESERTA :', x + 12, bodyY);

      doc.fillColor('#583682')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(student.identifier, x + 12, bodyY + 11);

      // Nama Peserta
      doc.fillColor('#595562')
        .font('Helvetica')
        .fontSize(7.5)
        .text('NAMA PESERTA :', x + 12, bodyY + 29);

      doc.fillColor('#24212b')
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .text(student.full_name, x + 12, bodyY + 39, { width: cardWidth - 24, height: 14, ellipsis: true });

      // Institusi / Program Studi
      doc.fillColor('#595562')
        .font('Helvetica')
        .fontSize(7.5)
        .text(`INSTANSI / PRODI : ${student.institution || (student.role === 'umum' ? 'Umum' : 'ADMINISTRASI PUBLIK')}`, x + 12, bodyY + 56, {
          width: cardWidth - 24,
          ellipsis: true,
        });

      // 5. Kotak Kata Sandi / Password Highlight Box
      const passBoxY = bodyY + 72;
      doc.rect(x + 10, passBoxY, cardWidth - 20, 50)
        .fillColor('#f6f3fa')
        .strokeColor('#cfc2df')
        .lineWidth(1)
        .fillAndStroke();

      doc.fillColor('#583682')
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text('KATA SANDI / PASSWORD LOGIN :', x + 16, passBoxY + 6);

      const displayPassword = student.initial_password || '123456';
      doc.fillColor('#24212b')
        .font('Helvetica-Bold')
        .fontSize(17)
        .text(displayPassword, x + 16, passBoxY + 18, {
          characterSpacing: 4,
          width: cardWidth - 32,
          align: 'center',
        });

      // 6. Footer Kartu
      const footerY = y + cardHeight - 24;
      doc.fillColor('#716c7a')
        .font('Helvetica')
        .fontSize(6.5)
        .text('Tautan: http://localhost:5173/login  |  Gunting sesuai garis putus-putus', x + 8, footerY, {
          width: cardWidth - 16,
          align: 'center',
        });
    });

    doc.end();
  });

  await logAudit({
    actorId: adminActorId,
    actorRole: 'admin',
    action: 'sessions.export_credentials_pdf',
    entityType: 'exam_sessions',
    entityId: sessionId,
    reason: `Exported printable credentials PDF for ${participants.length} students in session ${session.code}`,
    afterData: { total_participants: participants.length, session_code: session.code },
    ipAddress,
  });

  return {
    pdfBuffer,
    sessionCode: session.code,
    sessionName: session.name,
    totalParticipants: participants.length,
  };
}
