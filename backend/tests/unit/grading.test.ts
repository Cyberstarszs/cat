import { describe, it, expect } from 'vitest';
import {
  calculateAttemptGrade,
  resolveValidKeys,
  roundHalfUp,
  evaluateScore,
  calculateQuestionPoints,
} from '../../src/lib/grading.js';

describe('Pure Grading Engine (INV-12, BR-01, BR-02)', () => {
  it('should correctly round half-up to 2 decimals', () => {
    expect(roundHalfUp(83.333333)).toBe(83.33);
    expect(roundHalfUp(83.335)).toBe(83.34);
    expect(roundHalfUp(66.66666)).toBe(66.67);
    expect(roundHalfUp(100.0)).toBe(100.0);
    expect(roundHalfUp(0.0)).toBe(0.0);
  });

  it('should grade standard attempts with no corrections', () => {
    const items = [
      {
        question_version_id: 'q1',
        weight: 1.0,
        original_correct_option_id: 'opt-a',
        selected_option_id: 'opt-a', // Benar
      },
      {
        question_version_id: 'q2',
        weight: 1.0,
        original_correct_option_id: 'opt-b',
        selected_option_id: 'opt-c', // Salah
      },
      {
        question_version_id: 'q3',
        weight: 2.0,
        original_correct_option_id: 'opt-d',
        selected_option_id: 'opt-d', // Benar
      },
      {
        question_version_id: 'q4',
        weight: 1.0,
        original_correct_option_id: 'opt-a',
        selected_option_id: null, // Kosong
      },
    ];

    // Total max weight = 1 + 1 + 2 + 1 = 5
    // Raw score = 1 + 0 + 2 + 0 = 3
    // Percentage = (3 / 5) * 100 = 60.0
    const grade = calculateAttemptGrade(items, 65.0);

    expect(grade.raw_score).toBe(3.0);
    expect(grade.max_score).toBe(5.0);
    expect(grade.score).toBe(60.0);
    expect(grade.passed).toBe(false);
  });

  it('should handle also_accept correction allowing both keys', () => {
    const corrections = [
      {
        type: 'also_accept' as const,
        old_option_id: 'opt-a',
        new_option_id: 'opt-b',
        created_at: new Date(),
      },
    ];

    const student1 = calculateQuestionPoints('opt-a', 'opt-a', 2.0, corrections);
    expect(student1.isCorrect).toBe(true);
    expect(student1.pointsAwarded).toBe(2.0);

    const student2 = calculateQuestionPoints('opt-b', 'opt-a', 2.0, corrections);
    expect(student2.isCorrect).toBe(true);
    expect(student2.pointsAwarded).toBe(2.0);

    const student3 = calculateQuestionPoints('opt-c', 'opt-a', 2.0, corrections);
    expect(student3.isCorrect).toBe(false);
    expect(student3.pointsAwarded).toBe(0.0);
  });

  it('should handle key_changed correction invalidating old key', () => {
    const corrections = [
      {
        type: 'key_changed' as const,
        old_option_id: 'opt-a',
        new_option_id: 'opt-c',
        created_at: new Date(),
      },
    ];

    const studentOldKey = calculateQuestionPoints('opt-a', 'opt-a', 1.5, corrections);
    expect(studentOldKey.isCorrect).toBe(false);
    expect(studentOldKey.pointsAwarded).toBe(0.0);

    const studentNewKey = calculateQuestionPoints('opt-c', 'opt-a', 1.5, corrections);
    expect(studentNewKey.isCorrect).toBe(true);
    expect(studentNewKey.pointsAwarded).toBe(1.5);
  });

  it('should handle annulled question removing it from raw and max score', () => {
    const items = [
      {
        question_version_id: 'q1',
        weight: 2.0,
        original_correct_option_id: 'opt-a',
        selected_option_id: 'opt-a',
      },
      {
        question_version_id: 'q2-annulled',
        weight: 3.0,
        original_correct_option_id: 'opt-b',
        selected_option_id: 'opt-b',
        corrections: [{ type: 'annulled' as const, created_at: new Date() }],
      },
    ];

    // Soal 2 dianulir -> maxScore = 2.0 (bukan 5.0), rawScore = 2.0
    // Persentase = (2.0 / 2.0) * 100 = 100%
    const grade = calculateAttemptGrade(items, 75.0);
    expect(grade.max_score).toBe(2.0);
    expect(grade.raw_score).toBe(2.0);
    expect(grade.score).toBe(100.0);
    expect(grade.passed).toBe(true);
  });
});
