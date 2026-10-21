/**
 * Utility functions to detect and sanitize question subtest / category headers
 * from documents (DOCX, DOC, CSV, etc.)
 */

/**
 * Converts a string to Title Case while preserving standard uppercase acronyms.
 */
export function toTitleCase(str: string): string {
  const acronyms = new Set([
    'TWK',
    'TIU',
    'TKP',
    'TKD',
    'TKB',
    'TPA',
    'BKN',
    'CPNS',
    'FIA',
    'SD',
    'SMP',
    'SMA',
    'SMK',
    'ASN',
    'PNS',
    'PPPK',
    'TOEFL',
    'IELTS',
    'CAT',
    'IT',
    'HR',
    'UI',
    'UX',
    'UUD',
    'NKRI',
    'Pancasila',
  ]);

  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase().replace(/[^A-Z]/g, '');
      if (acronyms.has(upper)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Detects whether a paragraph or line is a Subtest / Category header.
 * Returns the normalized category name or null if it's normal content.
 */
export function detectCategoryHeader(text: string): string | null {
  const clean = text.trim();
  if (!clean) return null;

  const upper = clean.toUpperCase();

  // 1. Explicit standardized Assessment / CPNS categories
  if (
    upper.includes('TES WAWASAN KEBANGSAAN') ||
    /\bTWK\b/.test(upper) ||
    /^[A-Z]\.\s*TES\s+WAWASAN/i.test(clean)
  ) {
    return 'Tes Wawasan Kebangsaan';
  }

  if (
    upper.includes('TES INTELIGENSI UMUM') ||
    upper.includes('TES INTELEGENSI UMUM') ||
    /\bTIU\b/.test(upper) ||
    /^[A-Z]\.\s*TES\s+INTEL/i.test(clean)
  ) {
    return 'Tes Inteligensia Umum';
  }

  if (
    upper.includes('TES KARAKTERISTIK PRIBADI') ||
    /\bTKP\b/.test(upper) ||
    /^[A-Z]\.\s*TES\s+KARAKTERISTIK/i.test(clean)
  ) {
    return 'Tes Karakteristik Pribadi';
  }

  if (
    upper.includes('TES POTENSI AKADEMIK') ||
    /\bTPA\b/.test(upper)
  ) {
    return 'Tes Potensi Akademik';
  }

  if (
    upper.includes('TES KEMAMPUAN BIDANG') ||
    /\bTKB\b/.test(upper)
  ) {
    return 'Tes Kemampuan Bidang';
  }

  if (
    upper.includes('TES KEMAMPUAN DASAR') ||
    /\bTKD\b/.test(upper)
  ) {
    return 'Tes Kemampuan Dasar';
  }

  // 2. Labeled subtest prefix:
  // e.g. "SUBTES 1: PENALARAN LOGIKA", "SUB-TES A - LITERASI", "KATEGORI: MATEMATIKA", "BAGIAN I: BAHASA INGGRIS", "MODUL: KEUANGAN"
  const labelMatch = clean.match(
    /^(?:sub[\s-]?tes|kategori|bagian|bidang|modul|seksi|aspek)\s*(?:[0-9IVX]+|[A-Z])?\s*[:\-–]\s*(.+)$/i
  );
  if (labelMatch) {
    let name = labelMatch[1].trim();
    // remove trailing parenthetical codes e.g. "(PV)"
    name = name.replace(/\s*\([A-Z0-9\s-]+\)$/i, '').trim();
    if (name.length >= 3 && !name.endsWith('?')) {
      return toTitleCase(name);
    }
  }

  // 3. Section letter/roman numeral followed by uppercase title:
  // e.g. "A. PENALARAN VERBAL", "B. BAHASA INDONESIA", "I. LOGIKA ARITMATIKA"
  const sectionLetterMatch = clean.match(
    /^(?:([A-Z])|(I|II|III|IV|V|VI|VII|VIII|IX|X))\.\s+([A-Z0-9\s\-\(\)\/\&]{4,})$/
  );
  if (sectionLetterMatch) {
    const rawTitle = sectionLetterMatch[3].trim();
    // Verify it's not a question or simple option
    if (
      !rawTitle.endsWith('?') &&
      !rawTitle.endsWith('.') &&
      (rawTitle === rawTitle.toUpperCase() ||
        /^(?:TES|UJIAN|BIDANG|PENALARAN|KEMAMPUAN|LITERASI|NUMERIK|BAHASA|LOGIKA|PENGETAHUAN)/i.test(rawTitle))
    ) {
      let cleaned = rawTitle.replace(/\s*\([A-Z0-9\s-]+\)$/i, '').trim();
      if (cleaned.length >= 3) {
        return toTitleCase(cleaned);
      }
    }
  }

  return null;
}
