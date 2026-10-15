import AdmZip from 'adm-zip';

export interface ParsedOption {
  position: number;
  letter: string;
  option_text: string;
  is_correct: boolean;
}

export interface ParsedQuestion {
  number: number;
  category: string;
  stem: string;
  difficulty: number;
  weight: number;
  correct_key: string;
  options: ParsedOption[];
}

interface RawParaItem {
  pIndex: number;
  text: string;
  ilvl: string;
  isRed: boolean;
}

interface SectionBlock {
  category: string;
  items: RawParaItem[];
}

export function parseDocxQuestions(buffer: Buffer, defaultCategory: string = 'Umum'): ParsedQuestion[] {
  const zip = new AdmZip(buffer);
  const docEntry = zip.getEntry('word/document.xml');
  if (!docEntry) {
    throw new Error('Berkas DOCX tidak valid: komponen word/document.xml tidak ditemukan.');
  }

  const xml = docEntry.getData().toString('utf8');

  // Extract all paragraphs <w:p ...>...</w:p>
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  const pMatches = xml.match(pRegex) || [];

  const rawItems: RawParaItem[] = [];

  for (let i = 0; i < pMatches.length; i++) {
    const pXml = pMatches[i];

    // Extract text from <w:t>
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    const texts: string[] = [];
    let tMatch;
    while ((tMatch = tRegex.exec(pXml)) !== null) {
      texts.push(tMatch[1]);
    }
    const fullText = texts.join('').trim();
    if (!fullText) continue;

    // Check ilvl
    const ilvlMatch = pXml.match(/<w:ilvl\s+w:val="(\d+)"/);
    const ilvl = ilvlMatch ? ilvlMatch[1] : 'none';

    // Check red color in non-empty run: <w:r> containing <w:color w:val="FF0000"/> and <w:t> with non-space text
    const rRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
    const runs = pXml.match(rRegex) || [];
    let isRed = false;

    for (const r of runs) {
      if (/<w:color\s+w:val="(FF0000|ff0000|Red|red)"/i.test(r)) {
        let rText = '';
        let rtMatch;
        const rtRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
        while ((rtMatch = rtRegex.exec(r)) !== null) {
          rText += rtMatch[1];
        }
        if (rText.trim().length > 0) {
          isRed = true;
          break;
        }
      }
    }

    rawItems.push({
      pIndex: i,
      text: fullText,
      ilvl,
      isRed,
    });
  }

  // 1. Group items into sections
  const sections: SectionBlock[] = [];
  let curCategory = defaultCategory;
  let curSectionItems: RawParaItem[] = [];

  for (const item of rawItems) {
    const textUpper = item.text.toUpperCase();

    // Check for Section Header
    if (
      textUpper.includes('TES WAWASAN KEBANGSAAN') ||
      textUpper.includes('(TWK)') ||
      /^[A-Z]\.\s+TES\s+WAWASAN/i.test(item.text)
    ) {
      if (curSectionItems.length > 0) {
        sections.push({ category: curCategory, items: curSectionItems });
      }
      curCategory = 'Tes Wawasan Kebangsaan';
      curSectionItems = [];
      continue;
    }

    if (
      textUpper.includes('TES INTELIGENSI UMUM') ||
      textUpper.includes('TES INTELEGENSI UMUM') ||
      textUpper.includes('(TIU)') ||
      /^[A-Z]\.\s+TES\s+INTEL/i.test(item.text)
    ) {
      if (curSectionItems.length > 0) {
        sections.push({ category: curCategory, items: curSectionItems });
      }
      curCategory = 'Tes Inteligensia Umum';
      curSectionItems = [];
      continue;
    }

    if (
      textUpper.includes('TES KARAKTERISTIK PRIBADI') ||
      textUpper.includes('(TKP)') ||
      /^[A-Z]\.\s+TES\s+KARAKTERISTIK/i.test(item.text)
    ) {
      if (curSectionItems.length > 0) {
        sections.push({ category: curCategory, items: curSectionItems });
      }
      curCategory = 'Tes Karakteristik Pribadi';
      curSectionItems = [];
      continue;
    }

    // Skip candidate metadata at top of document (Nama, NIM, Fakultas, Program Studi)
    if (
      /^(Nama|NIM|Fakultas|Program\s+Studi|Tanggal|Waktu)\s*:/i.test(item.text) &&
      sections.length === 0 &&
      curSectionItems.length === 0
    ) {
      continue;
    }

    curSectionItems.push(item);
  }

  if (curSectionItems.length > 0) {
    sections.push({ category: curCategory, items: curSectionItems });
  }

  const optionLetters = ['A', 'B', 'C', 'D', 'E'];
  const allQuestions: ParsedQuestion[] = [];
  let questionNumber = 1;

  for (const sec of sections) {
    const secItems = sec.items;
    const catName = sec.category;

    // Find indices of all red marked items in this section
    const redIndices: number[] = [];
    for (let i = 0; i < secItems.length; i++) {
      if (secItems[i].isRed) {
        redIndices.push(i);
      }
    }

    // If red text exists, use red-anchored algorithm
    if (redIndices.length > 0) {
      let curStart = 0;

      for (let q = 0; q < redIndices.length; q++) {
        const redPos = redIndices[q];
        let bestOptEnd = -1;

        if (q === redIndices.length - 1) {
          bestOptEnd = secItems.length - 1;
        } else {
          const nextRed = redIndices[q + 1];
          const maxEnd = Math.min(redPos + 4, nextRed - 2);

          let bestScore = -999;
          for (let candEnd = redPos; candEnd <= maxEnd; candEnd++) {
            const candStart = candEnd - 4;
            if (candStart > curStart) {
              const stemLast = secItems[candStart - 1].text;
              let score = 0;
              if (
                /\?$/.test(stemLast) ||
                /\.{2,}$/.test(stemLast) ||
                /:\s*$/.test(stemLast) ||
                /adalah\s*\.*$/i.test(stemLast) ||
                /merupakan\s*\.*$/i.test(stemLast)
              ) {
                score += 10;
              }
              if (secItems[candStart].ilvl === '1') score += 5;
              if (score > bestScore) {
                bestScore = score;
                bestOptEnd = candEnd;
              }
            }
          }

          if (bestOptEnd === -1) {
            bestOptEnd = Math.min(redPos + 4, nextRed - 2);
          }
        }

        const optStart = bestOptEnd - 4;
        if (optStart > curStart && optStart >= 0) {
          const stemParas = secItems.slice(curStart, optStart);
          const stemText = stemParas.map((p) => p.text).join('\n');
          const cleanStem = stemText.replace(/^\d+[\.\)]\s*/, '').trim();

          const options: ParsedOption[] = [];
          let correctKey = 'A';

          for (let o = 0; o < 5; o++) {
            const optItem = secItems[optStart + o];
            if (!optItem) continue;
            const letter = optionLetters[o];
            const cleanOptText = optItem.text.replace(/^[A-Ea-e][\.\)]\s*/, '').trim();
            if (optItem.isRed) {
              correctKey = letter;
            }
            options.push({
              position: o + 1,
              letter,
              option_text: cleanOptText,
              is_correct: optItem.isRed,
            });
          }

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

          allQuestions.push({
            number: questionNumber++,
            category: catName,
            stem: cleanStem,
            difficulty: diff,
            weight,
            correct_key: correctKey,
            options,
          });

          curStart = bestOptEnd + 1;
        }
      }
    } else {
      // Fallback: If no red highlight is used, parse by option letter markers A. B. C. D. E.
      let currentStem: string[] = [];
      let currentOpts: ParsedOption[] = [];

      function flush() {
        if (currentStem.length > 0 && currentOpts.length >= 2) {
          const correct = currentOpts.find((o) => o.is_correct) || currentOpts[0];
          allQuestions.push({
            number: questionNumber++,
            category: catName,
            stem: currentStem.join('\n').replace(/^\d+[\.\)]\s*/, '').trim(),
            difficulty: 2,
            weight: 5.0,
            correct_key: correct.letter,
            options: [...currentOpts],
          });
        }
        currentStem = [];
        currentOpts = [];
      }

      for (const it of secItems) {
        const optMatch = it.text.match(/^([A-E])[\.\)]\s*(.*)$/i);
        if (optMatch && currentStem.length > 0) {
          const letter = optMatch[1].toUpperCase();
          currentOpts.push({
            position: currentOpts.length + 1,
            letter,
            option_text: optMatch[2].trim() || it.text,
            is_correct: it.isRed,
          });
          if (currentOpts.length === 5) flush();
        } else {
          if (currentOpts.length > 0) flush();
          currentStem.push(it.text);
        }
      }
      flush();
    }
  }

  return allQuestions;
}
