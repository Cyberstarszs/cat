import { describe, it, expect } from 'vitest';
import { detectCategoryHeader, toTitleCase } from '../../src/modules/questions/category-detector.js';

describe('category-detector unit tests', () => {
  it('should convert strings to title case while preserving standard acronyms', () => {
    expect(toTitleCase('TES WAWASAN KEBANGSAAN')).toBe('Tes Wawasan Kebangsaan');
    expect(toTitleCase('penalaran numerik tiu')).toBe('Penalaran Numerik TIU');
    expect(toTitleCase('MODUL CPNS DAN PPPK')).toBe('Modul CPNS Dan PPPK');
    expect(toTitleCase('LITERASI BAHASA INGGRIS TOEFL')).toBe('Literasi Bahasa Inggris TOEFL');
  });

  it('should detect standard CPNS/Assessment headers', () => {
    expect(detectCategoryHeader('A. TES WAWASAN KEBANGSAAN (TWK)')).toBe('Tes Wawasan Kebangsaan');
    expect(detectCategoryHeader('B. TES INTELIGENSI UMUM (TIU)')).toBe('Tes Inteligensia Umum');
    expect(detectCategoryHeader('C. TES KARAKTERISTIK PRIBADI (TKP)')).toBe('Tes Karakteristik Pribadi');
    expect(detectCategoryHeader('TES POTENSI AKADEMIK (TPA)')).toBe('Tes Potensi Akademik');
    expect(detectCategoryHeader('TES KEMAMPUAN BIDANG (TKB)')).toBe('Tes Kemampuan Bidang');
  });

  it('should detect labeled subtest prefixes (Subtes:, Bagian:, Kategori:, etc.)', () => {
    expect(detectCategoryHeader('SUBTES 1: PENALARAN MATEMATIKA')).toBe('Penalaran Matematika');
    expect(detectCategoryHeader('Subtes A - Penalaran Figural')).toBe('Penalaran Figural');
    expect(detectCategoryHeader('BAGIAN II: KEMAMPUAN VERBAL')).toBe('Kemampuan Verbal');
    expect(detectCategoryHeader('Kategori: Literasi Bahasa Indonesia')).toBe('Literasi Bahasa Indonesia');
    expect(detectCategoryHeader('MODUL: ALGORITMA DAN PEMROGRAMAN')).toBe('Algoritma Dan Pemrograman');
  });

  it('should detect section letter / Roman numeral titles', () => {
    expect(detectCategoryHeader('A. PENGETAHUAN UMUM')).toBe('Pengetahuan Umum');
    expect(detectCategoryHeader('B. KEMAMPUAN NUMERIK')).toBe('Kemampuan Numerik');
    expect(detectCategoryHeader('I. PENALARAN LOGIS')).toBe('Penalaran Logis');
    expect(detectCategoryHeader('II. BAHASA INDONESIA')).toBe('Bahasa Indonesia');
  });

  it('should NOT treat options or candidate info or questions as category headers', () => {
    expect(detectCategoryHeader('Nama: Budi Santoso')).toBeNull();
    expect(detectCategoryHeader('NIM: 2024101010')).toBeNull();
    expect(detectCategoryHeader('A. Ibukota Indonesia adalah Jakarta')).toBeNull();
    expect(detectCategoryHeader('1. Siapakah presiden pertama RI?')).toBeNull();
    expect(detectCategoryHeader('Kunci: B')).toBeNull();
    expect(detectCategoryHeader('Pembahasan: Sutasoma adalah karya Mpu Tantular.')).toBeNull();
  });
});
