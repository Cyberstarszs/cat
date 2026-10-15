/**
 * BR-01 & BR-02: SATU-SATUNYA fungsi hitung nilai dan aturan kunci berlaku (INV-12).
 * Digunakan seragam untuk penilaian instan, nilai ulang (regrade), dan pratinjau koreksi.
 */

export interface QuestionCorrectionInfo {
  type: 'key_changed' | 'also_accept' | 'annulled';
  old_option_id?: string | null;
  new_option_id?: string | null;
  created_at?: Date;
}

export type CorrectionRule = QuestionCorrectionInfo;

export interface QuestionAnswerItem {
  question_version_id: string;
  weight: number;
  original_correct_option_id: string;
  selected_option_id?: string | null;
  corrections?: QuestionCorrectionInfo[];
}

export interface GradedItemResult {
  question_version_id: string;
  is_annulled: boolean;
  is_correct: boolean;
  points_awarded: number;
  weight: number;
  valid_option_ids: string[];
}

export interface GradingResult {
  raw_score: number;
  max_score: number;
  score: number;
  passed: boolean;
  passing_score: number;
  items: GradedItemResult[];
}

/**
 * Pembulatan desimal setengah ke atas (round half-up) sesuai D-01 & BR-01.
 */
export function roundHalfUp(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Menentukan kunci berlaku berdasarkan opsi benar asli dan riwayat koreksi (BR-02).
 */
export function resolveValidKeys(
  originalCorrectId: string,
  corrections?: QuestionCorrectionInfo[]
): { isAnnulled: boolean; validOptionIds: Set<string> } {
  if (!corrections || corrections.length === 0) {
    return { isAnnulled: false, validOptionIds: new Set([originalCorrectId]) };
  }

  // Cek apakah ada koreksi annulled
  const hasAnnulled = corrections.some((c) => c.type === 'annulled');
  if (hasAnnulled) {
    return { isAnnulled: true, validOptionIds: new Set() };
  }

  // Urutkan koreksi jika memiliki created_at
  const sorted = [...corrections].sort((a, b) => {
    if (a.created_at && b.created_at) {
      return a.created_at.getTime() - b.created_at.getTime();
    }
    return 0;
  });

  let baseKey = originalCorrectId;
  const alsoAcceptKeys = new Set<string>();

  for (const corr of sorted) {
    if (corr.type === 'key_changed' && corr.new_option_id) {
      baseKey = corr.new_option_id;
    } else if (corr.type === 'also_accept' && corr.new_option_id) {
      alsoAcceptKeys.add(corr.new_option_id);
    }
  }

  const validKeys = new Set<string>([baseKey, ...alsoAcceptKeys]);
  return { isAnnulled: false, validOptionIds: validKeys };
}

/**
 * Helper untuk menghitung poin pada satu butir soal
 */
export function calculateQuestionPoints(
  selectedOptionId: string | null | undefined,
  originalCorrectOptionId: string,
  weight: number,
  corrections?: QuestionCorrectionInfo[]
): {
  pointsAwarded: number;
  isCorrect: boolean;
  isAnnulled: boolean;
  weight: number;
} {
  const { isAnnulled, validOptionIds } = resolveValidKeys(originalCorrectOptionId, corrections);

  if (isAnnulled) {
    return {
      pointsAwarded: 0,
      isCorrect: false,
      isAnnulled: true,
      weight,
    };
  }

  const isCorrect = !!(selectedOptionId && validOptionIds.has(selectedOptionId));
  const pointsAwarded = isCorrect ? weight : 0;

  return {
    pointsAwarded,
    isCorrect,
    isAnnulled: false,
    weight,
  };
}

/**
 * Helper untuk mengevaluasi total skor dari daftar butir penilaian
 */
export function evaluateScore(
  items: Array<{
    pointsAwarded?: number;
    points_awarded?: number;
    weight: number;
    isAnnulled?: boolean;
    is_annulled?: boolean;
  }>,
  passingScore: number
): {
  rawScore: number;
  maxScore: number;
  score: number;
  passed: boolean;
} {
  let rawScore = 0;
  let maxScore = 0;

  for (const item of items) {
    if (item.isAnnulled || item.is_annulled) continue;
    const points = item.pointsAwarded !== undefined ? item.pointsAwarded : (item.points_awarded || 0);
    maxScore += Number(item.weight);
    rawScore += Number(points);
  }

  if (maxScore <= 0) {
    return {
      rawScore: 0,
      maxScore: 0,
      score: 0,
      passed: false,
    };
  }

  const rawRounded = roundHalfUp(rawScore, 2);
  const maxRounded = roundHalfUp(maxScore, 2);
  const percentage = (rawScore / maxScore) * 100;
  const finalScore = roundHalfUp(percentage, 2);
  const passed = finalScore >= passingScore;

  return {
    rawScore: rawRounded,
    maxScore: maxRounded,
    score: finalScore,
    passed,
  };
}

/**
 * Fungsi kalkulasi penilaian lengkap untuk satu attempt (BR-01, D-01).
 */
export function calculateAttemptGrade(
  items: QuestionAnswerItem[],
  passingScore: number
): GradingResult {
  const itemResults = items.map((item) => {
    const res = calculateQuestionPoints(
      item.selected_option_id,
      item.original_correct_option_id,
      Number(item.weight),
      item.corrections
    );
    return {
      question_version_id: item.question_version_id,
      is_annulled: res.isAnnulled,
      is_correct: res.isCorrect,
      points_awarded: res.pointsAwarded,
      weight: res.weight,
      valid_option_ids: [],
    };
  });

  const evaluated = evaluateScore(itemResults, passingScore);

  return {
    raw_score: evaluated.rawScore,
    max_score: evaluated.maxScore,
    score: evaluated.score,
    passed: evaluated.passed,
    passing_score: passingScore,
    items: itemResults,
  };
}
