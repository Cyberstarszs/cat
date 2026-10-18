import WordExtractor from 'word-extractor';
import { ParsedOption, ParsedQuestion, parseDocxQuestions } from './docx-parser.js';

interface RawOption {
  letter: string;
  text: string;
  isCorrect: boolean;
}

interface DraftQuestion {
  category: string;
  stemLines: string[];
  options: RawOption[];
  explicitKey?: string | null;
}

/**
 * Checks if the buffer starts with the standard PK ZIP header bytes.
 */
export function isZipBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  );
}

/**
 * Normalizes and categorizes subtest headers.
 */
function detectCategory(line: string): string | null {
  const upper = line.toUpperCase();
  if (
    upper.includes('TES WAWASAN KEBANGSAAN') ||
    upper.includes('(TWK)') ||
    upper.includes('[TWK]') ||
    /^[A-Z]\.\s+TES\s+WAWASAN/i.test(line)
  ) {
    return 'Tes Wawasan Kebangsaan';
  }
  if (
    upper.includes('TES INTELIGENSI UMUM') ||
    upper.includes('TES INTELEGENSI UMUM') ||
    upper.includes('(TIU)') ||
    upper.includes('[TIU]') ||
    /^[A-Z]\.\s+TES\s+INTEL/i.test(line)
  ) {
    return 'Tes Inteligensia Umum';
  }
  if (
    upper.includes('TES KARAKTERISTIK PRIBADI') ||
    upper.includes('(TKP)') ||
    upper.includes('[TKP]') ||
    /^[A-Z]\.\s+TES\s+KARAKTERISTIK/i.test(line)
  ) {
    return 'Tes Karakteristik Pribadi';
  }
  return null;
}

/**
 * Checks if line is document metadata (Nama, NIM, Fakultas, etc.)
 */
function isCandidateMetadata(line: string): boolean {
  return /^(nama|nim|fakultas|program\s+studi|prodi|jurusan|mata\s+kuliah|matkul|tanggal|waktu|dosen|kelas)\s*:/i.test(
    line.trim()
  );
}

/**
 * Matches an option line, such as:
 * A. Pilihan A
 * *B. Pilihan B
 * C) Pilihan C
 * (D) Pilihan D
 * E. Pilihan E (Kunci)
 */
function matchOptionLine(line: string): RawOption | null {
  let raw = line.trim();
  let isCorrect = false;

  // Leading asterisk marker e.g. *A. or * A.
  if (raw.startsWith('*')) {
    isCorrect = true;
    raw = raw.replace(/^\*+\s*/, '');
  }

  // Match option prefix: A. / A) / A: / (A) / [A]
  const optRegex = /^(?:([A-Ea-e])[\.\)\:\-]\s*|\(([A-Ea-e])\)\s*|\[([A-Ea-e])\]\s*)(.*)$/;
  const match = raw.match(optRegex);
  if (!match) return null;

  const letter = (match[1] || match[2] || match[3]).toUpperCase();
  let optText = (match[4] || '').trim();

  // Asterisk after letter: e.g. A.* or A*.
  if (optText.startsWith('*')) {
    isCorrect = true;
    optText = optText.replace(/^\*+\s*/, '');
  }

  // Trailing key markers: e.g. "Text *", "Text (Kunci)", "Text [Kunci]"
  if (/\s*\*+$/.test(optText)) {
    isCorrect = true;
    optText = optText.replace(/\s*\*+$/, '');
  } else if (/\s*[\(\[]\s*(?:kunci(?:\s+jawaban)?|kunci|benar|jawaban\s+benar)\s*[\)\]]$/i.test(optText)) {
    isCorrect = true;
    optText = optText.replace(
      /\s*[\(\[]\s*(?:kunci(?:\s+jawaban)?|kunci|benar|jawaban\s+benar)\s*[\)\]]$/i,
      ''
    );
  }

  return {
    letter,
    text: optText.trim(),
    isCorrect,
  };
}

/**
 * Matches an explicit key line, e.g. "Kunci: B", "Kunci Jawaban: C", "Jawaban: A"
 */
function matchKeyLine(line: string): string | null {
  const m = line.trim().match(/^(?:kunci(?:\s+jawaban)?|jawaban(?:\s+benar)?|ans(?:wer)?)\s*[:=]\s*([A-Ea-e])/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Matches an explicit question start, e.g. "1. ", "1) ", "Soal 1. ", "No. 1. "
 */
function matchQuestionNumber(line: string): { number: number; rest: string } | null {
  const m = line.trim().match(/^(?:soal\s+no(?:mor)?\.?\s*|no(?:mor)?\.?\s*|soal\s+)?(\d+)[\.\)]\s*(.*)$/i);
  if (m) {
    return {
      number: parseInt(m[1], 10),
      rest: m[2].trim(),
    };
  }
  return null;
}

/**
 * Parses raw text extracted from a Word (.doc) or text document into ParsedQuestion items.
 */
export function parseTextQuestions(rawText: string, defaultCategory: string = 'Umum'): ParsedQuestion[] {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const drafts: DraftQuestion[] = [];
  let curCategory = defaultCategory;
  let curDraft: DraftQuestion | null = null;
  let seenFirstQuestionOrCategory = false;

  function flushDraft() {
    if (curDraft && (curDraft.stemLines.length > 0 || curDraft.options.length > 0)) {
      drafts.push(curDraft);
    }
    curDraft = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Check for Category / Subtest header
    const detectedCat = detectCategory(line);
    if (detectedCat) {
      flushDraft();
      curCategory = detectedCat;
      seenFirstQuestionOrCategory = true;
      continue;
    }

    // 2. Skip metadata at top of document before any question
    if (!seenFirstQuestionOrCategory && isCandidateMetadata(line)) {
      continue;
    }

    // 3. Check for explicit Key line
    const keyMatch = matchKeyLine(line);
    if (keyMatch) {
      if (curDraft) {
        curDraft.explicitKey = keyMatch;
      }
      continue;
    }

    // 4. Skip explanation lines (Pembahasan: ...)
    if (/^(?:pembahasan|penjelasan|explanation)\s*[:=]/i.test(line)) {
      continue;
    }

    // 5. Check for Option line (A. ... - E. ...)
    const optMatch = matchOptionLine(line);
    if (optMatch) {
      seenFirstQuestionOrCategory = true;

      if (!curDraft) {
        curDraft = {
          category: curCategory,
          stemLines: [],
          options: [],
        };
      }

      // If we already have this option letter in current draft (e.g. repeated 'A'),
      // then a new question started without an explicit question number!
      const alreadyHasLetter = curDraft.options.some((o) => o.letter === optMatch.letter);
      if (alreadyHasLetter) {
        flushDraft();
        curDraft = {
          category: curCategory,
          stemLines: [],
          options: [optMatch],
        };
      } else {
        curDraft.options.push(optMatch);
      }
      continue;
    }

    // 6. Check for explicit Question Number start (e.g. "1. Teks...")
    const qNumMatch = matchQuestionNumber(line);
    if (qNumMatch) {
      seenFirstQuestionOrCategory = true;
      flushDraft();
      curDraft = {
        category: curCategory,
        stemLines: qNumMatch.rest ? [qNumMatch.rest] : [],
        options: [],
      };
      continue;
    }

    // 7. General text line:
    seenFirstQuestionOrCategory = true;
    if (!curDraft) {
      curDraft = {
        category: curCategory,
        stemLines: [line],
        options: [],
      };
    } else if (curDraft.options.length === 0) {
      // Still accumulating question stem
      curDraft.stemLines.push(line);
    } else if (curDraft.options.length < 5) {
      // Continuation of the last option text (multi-line option)
      const lastOpt = curDraft.options[curDraft.options.length - 1];
      lastOpt.text = `${lastOpt.text} ${line}`.trim();
    } else {
      // We already had 5 options, and now encountered text that isn't a key line.
      // This means a new unnumbered question stem has started!
      flushDraft();
      curDraft = {
        category: curCategory,
        stemLines: [line],
        options: [],
      };
    }
  }

  flushDraft();

  const optionLetters = ['A', 'B', 'C', 'D', 'E'];
  const questions: ParsedQuestion[] = [];
  let questionNumber = 1;

  for (const draft of drafts) {
    let rawStem = draft.stemLines.join('\n').trim();
    // Clean leading question number if present e.g. "1. " or "1) "
    rawStem = rawStem.replace(/^\d+[\.\)]\s*/, '').trim();

    // If options are missing or fewer than 2, skip or handle
    if (!rawStem && draft.options.length === 0) continue;

    // Build options
    const options: ParsedOption[] = [];
    let correctKey = 'A';

    // If an explicit key was provided: e.g. "Kunci: C"
    if (draft.explicitKey) {
      correctKey = draft.explicitKey;
    } else {
      // Check if an option was marked correct
      const markedOpt = draft.options.find((o) => o.isCorrect);
      if (markedOpt) {
        correctKey = markedOpt.letter;
      }
    }

    // Fill options up to standard list
    for (let o = 0; o < draft.options.length; o++) {
      const opt = draft.options[o];
      const letter = opt.letter || optionLetters[o] || String.fromCharCode(65 + o);
      const isCorrect = letter === correctKey;

      options.push({
        position: o + 1,
        letter,
        option_text: opt.text,
        is_correct: isCorrect,
      });
    }

    // If none marked is_correct, mark the one matching correctKey or position 1
    if (options.length > 0 && !options.some((o) => o.is_correct)) {
      const matchKeyOpt = options.find((o) => o.letter === correctKey);
      if (matchKeyOpt) {
        matchKeyOpt.is_correct = true;
      } else {
        options[0].is_correct = true;
        correctKey = options[0].letter;
      }
    }

    const catName = draft.category;
    let diff = 2;
    let weight = 5.0;
    if (catName.includes('Wawasan Kebangsaan') || catName.includes('TWK')) {
      weight = 5.0;
      diff = 2;
    } else if (catName.includes('Inteligens') || catName.includes('TIU')) {
      weight = 5.0;
      diff = 3;
    } else if (catName.includes('Karakteristik') || catName.includes('TKP')) {
      weight = 5.0;
      diff = 2;
    }

    questions.push({
      number: questionNumber++,
      category: catName,
      stem: rawStem,
      difficulty: diff,
      weight,
      correct_key: correctKey,
      options,
    });
  }

  return questions;
}

/**
 * Main parser entry point for .DOC files.
 * - If the file has a ZIP header (e.g. OOXML renamed as .doc), delegates to parseDocxQuestions.
 * - If the file is binary Word 97-2003 (.doc), extracts text using word-extractor and parses via parseTextQuestions.
 */
export async function parseDocQuestions(
  buffer: Buffer,
  defaultCategory: string = 'Umum'
): Promise<ParsedQuestion[]> {
  if (isZipBuffer(buffer)) {
    // OOXML file with .doc extension -> direct docx parser (preserves red-key font detection!)
    return parseDocxQuestions(buffer, defaultCategory);
  }

  try {
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(buffer);
    const body = extracted.getBody();
    return parseTextQuestions(body, defaultCategory);
  } catch (err: any) {
    // Fallback: If word-extractor cannot parse (e.g. utf-8 text file saved with .doc extension),
    // attempt parsing the buffer directly as UTF-8 text.
    try {
      const text = buffer.toString('utf8');
      const questions = parseTextQuestions(text, defaultCategory);
      if (questions.length > 0) {
        return questions;
      }
    } catch {
      // Ignore fallback error and throw main error below
    }
    throw new Error(`Gagal membaca berkas .DOC: ${err.message || 'Format Word tidak dikenali'}`);
  }
}
