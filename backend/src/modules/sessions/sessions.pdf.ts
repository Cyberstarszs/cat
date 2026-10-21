import PDFDocument from 'pdfkit';
import { pool } from '../../db/connection.js';
import { AppError } from '../../lib/errors.js';
import { logAudit } from '../audit/audit.service.js';

export async function generateSessionCredentialsPDF(
  sessionId: string,
  adminActorId: string,
  ipAddress?: string,
  loginUrl: string = 'http://localhost:5173/login'
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
        .text(`Tautan: ${loginUrl}  |  Gunting sesuai garis putus-putus`, x + 8, footerY, {
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


export async function generateSessionBapPDFBuffer(
  sessionId: string,
  adminActorId: string,
  ipAddress?: string
): Promise<{ pdfBuffer: Buffer; sessionCode: string; sessionName: string }> {
  // 1. Ambil data sesi & ujian
  const { rows: sessionRows } = await pool.query(
    `SELECT s.*, e.title AS exam_title, e.duration_minutes, e.passing_score, e.question_count
     FROM exam_sessions s
     JOIN exams e ON e.id = s.exam_id
     WHERE s.id = $1;`,
    [sessionId]
  );
  if (sessionRows.length === 0) {
    throw new AppError('NOT_FOUND', 'Sesi ujian tidak ditemukan');
  }
  const session = sessionRows[0];

  // 2. Ambil data peserta beserta attempt & events
  const { rows: participants } = await pool.query(
    `SELECT 
       sp.identifier,
       sp.full_name,
       sp.institution,
       u.role,
       se.status AS enrollment_status,
       a.id AS attempt_id,
       a.status AS attempt_status,
       a.started_at,
       a.submitted_at,
       a.void_reason,
       r.score,
       r.passed,
       COUNT(ae.id) AS violation_count
     FROM session_enrollments se
     JOIN student_profiles sp ON sp.user_id = se.student_id
     JOIN users u ON u.id = se.student_id
     LEFT JOIN attempts a ON a.enrollment_id = se.id
     LEFT JOIN results r ON r.attempt_id = a.id
     LEFT JOIN attempt_events ae ON ae.attempt_id = a.id AND ae.event_type IN ('tab_switch', 'fullscreen_exit', 'window_blur')
     WHERE se.session_id = $1
     GROUP BY sp.identifier, sp.full_name, sp.institution, u.role, se.status, a.id, r.score, r.passed
     ORDER BY sp.identifier ASC;`,
    [sessionId]
  );

  const totalRegistered = participants.length;
  const attendedCount = participants.filter((p) => p.attempt_id !== null).length;
  const absentCount = participants.filter((p) => p.attempt_id === null || p.enrollment_status === 'absent').length;
  const submittedCount = participants.filter((p) => p.attempt_status === 'submitted' || p.attempt_status === 'auto_submitted').length;
  const voidCount = participants.filter((p) => p.attempt_status === 'void').length;
  const violationParticipants = participants.filter((p) => parseInt(p.violation_count, 10) > 0 || p.attempt_status === 'void');

  const formatWib = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const formatHourWib = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).format(new Date(dateStr)) + ' WIB';
    } catch {
      return dateStr;
    }
  };

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      autoFirstPage: true,
      info: {
        Title: `Berita Acara Pelaksanaan - ${session.code}`,
        Author: 'FIA Universitas Madura CAT System',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    // ==========================================
    // HALAMAN 1: BERITA ACARA PELAKSANAAN (BAP)
    // ==========================================
    // Kop Dokumen Resmi
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e1b4b').text('UNIVERSITAS MADURA', { align: 'center' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#312e81').text('FAKULTAS ILMU ADMINISTRASI', { align: 'center' });
    doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text('Jl. Raya Panglegur No.KM 3.5, Pamekasan, Madura, Jawa Timur', { align: 'center' });
    doc.moveDown(0.4);

    // Garis Kop Dobel
    doc.lineWidth(2).strokeColor('#1e1b4b').moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.2);
    doc.lineWidth(0.8).strokeColor('#64748b').moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).stroke();
    doc.moveDown(1.2);

    // Judul Dokumen
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text('BERITA ACARA PELAKSANAAN UJIAN (BAP)', { align: 'center' });
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#475569').text(`SISTEM COMPUTER ASSISTED TEST (CAT) FIA UNIRA`, { align: 'center' });
    doc.moveDown(1.2);

    // Narasi BAP
    doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').text(
      `Pada hari ini, ${formatWib(session.starts_at)}, telah dilaksanakan Uji Kompetensi Berbasis Komputer (CAT) dengan rincian jadwal dan pelaksanaan sebagai berikut:`,
      { align: 'justify', lineGap: 3 }
    );
    doc.moveDown(0.8);

    // Informasi Sesi Ujian (Tabel Ringkas)
    const infoY = doc.y;
    const drawRow = (y: number, label: string, value: string) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155').text(label, 50, y, { width: 140 });
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(`:  ${value}`, 190, y, { width: 350 });
    };

    drawRow(infoY, 'Mata Ujian / Kompetensi', session.exam_title);
    drawRow(infoY + 16, 'Kode & Nama Sesi', `${session.code} - ${session.name}`);
    drawRow(infoY + 32, 'Waktu Pelaksanaan', `${formatHourWib(session.starts_at)} s/d ${formatHourWib(session.ends_at)}`);
    drawRow(infoY + 48, 'Alokasi Durasi Ujian', `${session.duration_minutes} Menit (${session.question_count} Butir Soal)`);
    drawRow(infoY + 64, 'Passing Grade Kelulusan', `${session.passing_score} / 100`);

    doc.y = infoY + 86;
    doc.moveDown(0.5);

    // Rekapitulasi Kehadiran
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text('A. REKAPITULASI PESERTA UJIAN:');
    doc.moveDown(0.4);

    const rekapY = doc.y;
    const colW = 100;
    const headers = ['Terdaftar', 'Hadir', 'Tidak Hadir', 'Selesai', 'Diskualifikasi'];
    const counts = [totalRegistered, attendedCount, absentCount, submittedCount, voidCount];

    // Background header table
    doc.rect(50, rekapY, 495, 20).fillColor('#f1f5f9').fill();
    headers.forEach((h, i) => {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#334155').text(h, 50 + i * colW, rekapY + 5, { width: colW, align: 'center' });
    });

    // Baris angka
    doc.rect(50, rekapY + 20, 495, 24).fillColor('#ffffff').strokeColor('#cbd5e1').lineWidth(0.8).fillAndStroke();
    counts.forEach((c, i) => {
      const textColor = i === 4 && c > 0 ? '#dc2626' : '#0f172a';
      doc.fontSize(11).font('Helvetica-Bold').fillColor(textColor).text(String(c), 50 + i * colW, rekapY + 26, { width: colW, align: 'center' });
    });

    doc.y = rekapY + 54;
    doc.moveDown(0.5);

    // Catatan Insiden Khusus
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text('B. CATATAN PELAKSANAAN / INDIKASI PELANGGARAN:');
    doc.moveDown(0.3);

    const notesBoxY = doc.y;
    doc.rect(50, notesBoxY, 495, 75).strokeColor('#cbd5e1').lineWidth(0.8).stroke();

    if (violationParticipants.length > 0) {
      doc.fontSize(8.5).font('Helvetica').fillColor('#991b1b');
      let noteText = `Terdeteksi catatan pada sesi ini:\n`;
      violationParticipants.slice(0, 3).forEach((p) => {
        if (p.attempt_status === 'void') {
          noteText += `• [VOID / DISKUALIFIKASI] ${p.identifier} - ${p.full_name}: ${p.void_reason || 'Pelanggaran tata tertib'}\n`;
        } else {
          noteText += `• [PERINGATAN] ${p.identifier} - ${p.full_name}: ${p.violation_count} kali tab switch / keluar jendela\n`;
        }
      });
      if (violationParticipants.length > 3) {
        noteText += `• ... dan ${violationParticipants.length - 3} peserta lainnya (tercatat di log sistem).`;
      }
      doc.text(noteText, 58, notesBoxY + 8, { width: 480, lineGap: 2 });
    } else {
      doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#475569').text(
        'Ujian berlangsung dengan tertib, lancar, dan tanpa adanya kendala teknis maupun pelanggaran integritas.',
        58,
        notesBoxY + 12,
        { width: 480 }
      );
    }

    doc.y = notesBoxY + 85;
    doc.moveDown(0.6);

    // Pernyataan Penutup
    doc.fontSize(9).font('Helvetica').fillColor('#1e293b').text(
      'Demikian Berita Acara Pelaksanaan ini dibuat dengan sesungguhnya dan penuh tanggung jawab untuk dapat dipergunakan sebagaimana mestinya.',
      50,
      doc.y,
      { width: 495, align: 'justify' }
    );

    // Tanda Tangan 3 Kolom
    const sigY = doc.y + 20;
    const sigW = 160;

    // Kolom 1: Pengawas Lab 1
    doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text('Pengawas Ruang 1,', 50, sigY, { width: sigW, align: 'center' });
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('( ......................................... )', 50, sigY + 55, { width: sigW, align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('NIP/NIDN: ...............................', 50, sigY + 68, { width: sigW, align: 'center' });

    // Kolom 2: Teknisi / Pengawas 2
    doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text('Pengawas Ruang 2 / Teknisi,', 215, sigY, { width: sigW, align: 'center' });
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('( ......................................... )', 215, sigY + 55, { width: sigW, align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('NIP/NIDN: ...............................', 215, sigY + 68, { width: sigW, align: 'center' });

    // Kolom 3: Penanggung Jawab Sesi
    doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text('Penanggung Jawab Sesi,', 380, sigY, { width: sigW, align: 'center' });
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('( ......................................... )', 380, sigY + 55, { width: sigW, align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('NIP: .......................................', 380, sigY + 68, { width: sigW, align: 'center' });

    // ==========================================
    // HALAMAN 2+: DAFTAR PRESENSI PESERTA UJIAN
    // ==========================================
    const renderPresensiHeader = (pageNo: number, totalPagesEst: number) => {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text('DAFTAR HADIR & PRESENSI PESERTA UJIAN', 40, 40, { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#475569').text(
        `Sesi: ${session.code} - ${session.name}  |  Mata Ujian: ${session.exam_title}`,
        40,
        55,
        { align: 'center' }
      );
      doc.moveDown(0.8);

      const tableTop = 75;
      // Header Table Presensi
      doc.rect(40, tableTop, 515, 22).fillColor('#1e1b4b').fill();
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('NO', 45, tableTop + 6, { width: 25, align: 'center' });
      doc.text('NIM / ID PESERTA', 75, tableTop + 6, { width: 95 });
      doc.text('NAMA LENGKAP', 175, tableTop + 6, { width: 140 });
      doc.text('INSTANSI / PRODI', 320, tableTop + 6, { width: 100 });
      doc.text('TANDA TANGAN PESERTA', 425, tableTop + 6, { width: 125, align: 'center' });

      doc.strokeColor('#cbd5e1').lineWidth(0.5);
      return tableTop + 22;
    };

    doc.addPage();
    let currentY = renderPresensiHeader(2, Math.ceil(participants.length / 22) + 1);
    const rowHeight = 28;

    participants.forEach((student, idx) => {
      if (currentY + rowHeight > 780) {
        doc.addPage();
        currentY = renderPresensiHeader(doc.bufferedPageRange().count, 2);
      }

      // Zebra background
      if (idx % 2 === 1) {
        doc.rect(40, currentY, 515, rowHeight).fillColor('#f8fafc').fill();
      }

      // Borders
      doc.rect(40, currentY, 515, rowHeight).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

      // Data Columns
      doc.fontSize(8).font('Helvetica').fillColor('#0f172a');
      doc.text(String(idx + 1), 45, currentY + 9, { width: 25, align: 'center' });
      doc.font('Helvetica-Bold').text(student.identifier, 75, currentY + 9, { width: 95 });
      doc.font('Helvetica').text(student.full_name, 175, currentY + 9, { width: 140, ellipsis: true });
      doc.text(student.institution || 'FIA Administrasi', 320, currentY + 9, { width: 100, ellipsis: true });

      // Zig-Zag Signature columns
      const isOdd = (idx + 1) % 2 === 1;
      const sigColX = isOdd ? 430 : 485;
      doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#64748b').text(`${idx + 1}. ................`, sigColX, currentY + 10);

      currentY += rowHeight;
    });

    doc.end();
  });

  await logAudit({
    actorId: adminActorId,
    actorRole: 'admin',
    action: 'sessions.export_bap_pdf',
    entityType: 'exam_sessions',
    entityId: sessionId,
    reason: `Generated BAP & Attendance Sheet PDF for session ${session.code}`,
    afterData: { total_participants: participants.length, session_code: session.code },
    ipAddress,
  });

  return {
    pdfBuffer,
    sessionCode: session.code,
    sessionName: session.name,
  };
}
