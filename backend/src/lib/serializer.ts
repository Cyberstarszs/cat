/**
 * INV-15: Kunci dan pembahasan tidak ada di respons mahasiswa (kecuali allow_review = true).
 */

export interface RawQuestionOption {
  id: string;
  position: number;
  option_text: string;
  is_correct?: boolean;
}

export interface RawAttemptQuestion {
  id: string;
  position: number;
  stem: string;
  difficulty: number;
  weight: number;
  explanation?: string | null;
  options: RawQuestionOption[];
  selected_option_id?: string | null;
  is_flagged?: boolean;
}

export function sanitizeQuestionForStudent(
  q: RawAttemptQuestion,
  allowReview: boolean = false
) {
  return {
    id: q.id,
    position: q.position,
    stem: q.stem,
    difficulty: q.difficulty,
    weight: q.weight,
    explanation: allowReview ? q.explanation : undefined,
    selected_option_id: q.selected_option_id,
    is_flagged: q.is_flagged,
    options: q.options.map((opt) => ({
      id: opt.id,
      position: opt.position,
      option_text: opt.option_text,
      is_correct: allowReview ? opt.is_correct : undefined,
    })),
  };
}

export function sanitizeStudentReview(rawRows: any[], allowReview: boolean) {
  if (!allowReview) return null;

  const questionsMap = new Map<number, any>();

  for (const r of rawRows) {
    let q = questionsMap.get(r.position);
    if (!q) {
      q = {
        position: r.position,
        stem: r.stem || r.prompt,
        explanation: r.explanation,
        weight: r.weight,
        selected_option_id: r.selected_option_id,
        is_correct: r.is_correct,
        points_awarded: r.points_awarded,
        options: [],
      };
      questionsMap.set(r.position, q);
    }

    if (r.option_id) {
      q.options.push({
        id: r.option_id,
        label: r.option_label,
        text: r.option_text,
        is_correct: r.option_is_correct,
      });
    }
  }

  return Array.from(questionsMap.values());
}

export function sanitizeUser(user: any) {
  const { password_hash, refresh_token_hash, ...safe } = user;
  return safe;
}
