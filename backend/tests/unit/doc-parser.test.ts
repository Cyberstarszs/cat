import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isZipBuffer, parseTextQuestions, parseDocQuestions } from '../../src/modules/questions/doc-parser.js';

describe('doc-parser unit tests', () => {
  it('should correctly identify zip buffer', () => {
    const zipBuf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(isZipBuffer(zipBuf)).toBe(true);

    const nonZipBuf = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]);
    expect(isZipBuffer(nonZipBuf)).toBe(false);
  });

  it('should parse raw text questions with various option & key conventions', () => {
    const rawText = `
Nama: Budi Santoso
NIM: 2024101010
Fakultas: Ilmu Administrasi

A. TES WAWASAN KEBANGSAAN (TWK)
1. Lembaga negara yang berwenang menguji undang-undang terhadap UUD 1945 adalah...
A. Mahkamah Agung
*B. Mahkamah Konstitusi
C. Komisi Yudisial
D. Dewan Perwakilan Rakyat
E. Majelis Permusyawaratan Rakyat

2. Semboyan Bhinneka Tunggal Ika tertulis pada lambang Garuda Pancasila dan diambil dari kitab...
A. Negarakertagama
B. Arjunawiwaha
C. Sutasoma (kunci)
D. Ramayana
E. Bharatayuddha
Pembahasan: Kitab Sutasoma karangan Mpu Tantular.

B. TES INTELIGENSI UMUM (TIU)
3. Semua peserta ujian membawa kartu tanda pengenal. Dani adalah peserta ujian. Kesimpulannya...
A. Dani tidak membawa kartu tanda pengenal
B. Dani membawa kartu tanda pengenal
C. Dani lupa membawa kartu tanda pengenal
D. Dani tidak perlu membawa kartu
E. Tidak ada kesimpulan yang benar
Kunci: B

C. TES KARAKTERISTIK PRIBADI (TKP)
4. Rekan kerja Anda berhalangan hadir saat tenggat waktu laporan penting sudah dekat. Sikap Anda...
A. Melaporkan kepada atasan bahwa tugas tertunda
B. Menunggu rekan kerja masuk kembali
C. Mengerjakan bagian tugas rekan kerja semampu Anda agar laporan selesai tepat waktu *
D. Mengabaikan laporan tersebut
E. Meminta rekan lain mengambil alih semuanya
    `;

    const parsed = parseTextQuestions(rawText);
    expect(parsed.length).toBe(4);

    // Q1
    expect(parsed[0].number).toBe(1);
    expect(parsed[0].category).toBe('Tes Wawasan Kebangsaan');
    expect(parsed[0].stem).toContain('Lembaga negara yang berwenang');
    expect(parsed[0].correct_key).toBe('B');
    expect(parsed[0].options.length).toBe(5);
    expect(parsed[0].options[1].is_correct).toBe(true);
    expect(parsed[0].options[0].is_correct).toBe(false);

    // Q2
    expect(parsed[1].number).toBe(2);
    expect(parsed[1].category).toBe('Tes Wawasan Kebangsaan');
    expect(parsed[1].stem).toContain('Bhinneka Tunggal Ika');
    expect(parsed[1].correct_key).toBe('C');
    expect(parsed[1].options[2].is_correct).toBe(true);
    expect(parsed[1].options[2].option_text).toBe('Sutasoma');

    // Q3
    expect(parsed[2].number).toBe(3);
    expect(parsed[2].category).toBe('Tes Inteligensia Umum');
    expect(parsed[2].correct_key).toBe('B');
    expect(parsed[2].difficulty).toBe(3);
    expect(parsed[2].options[1].is_correct).toBe(true);

    // Q4
    expect(parsed[3].number).toBe(4);
    expect(parsed[3].category).toBe('Tes Karakteristik Pribadi');
    expect(parsed[3].correct_key).toBe('C');
    expect(parsed[3].options[2].is_correct).toBe(true);
    expect(parsed[3].options[2].option_text).toContain('Mengerjakan bagian tugas rekan kerja');
  });

  it('should parse a DOC file that is OOXML formatted (renamed .docx)', async () => {
    const templatePath = path.resolve('../frontend/public/templates/Template_Soal_Assessment_FIA.docx');
    if (fs.existsSync(templatePath)) {
      const buffer = fs.readFileSync(templatePath);
      const parsed = await parseDocQuestions(buffer);
      expect(parsed.length).toBeGreaterThanOrEqual(90);
      expect(parsed[0].stem).toContain('nasionalisme');
      expect(parsed[0].category).toBe('Tes Wawasan Kebangsaan');
      expect(parsed[0].options.length).toBe(5);
      expect(parsed[0].correct_key).toBe('B');
    }
  });
});
