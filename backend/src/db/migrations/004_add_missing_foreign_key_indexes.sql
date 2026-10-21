-- src/db/migrations/004_add_missing_foreign_key_indexes.sql
-- =============================================================================
-- Fix missing foreign key indexes identified via Supabase Postgres Best Practices
-- Prevents table locks during cascades and eliminates sequential scans on JOINs
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_questions_current_version_id 
  ON questions(current_version_id);

CREATE INDEX IF NOT EXISTS idx_question_versions_question_id 
  ON question_versions(question_id);

CREATE INDEX IF NOT EXISTS idx_question_corrections_version_id 
  ON question_corrections(question_version_id);

CREATE INDEX IF NOT EXISTS idx_attempt_answers_question_version_id 
  ON attempt_answers(question_version_id);

CREATE INDEX IF NOT EXISTS idx_attempt_answers_selected_option_id 
  ON attempt_answers(selected_option_id);

CREATE INDEX IF NOT EXISTS idx_session_enrollments_session_id 
  ON session_enrollments(session_id);

CREATE INDEX IF NOT EXISTS idx_session_enrollments_registered_by 
  ON session_enrollments(registered_by);

CREATE INDEX IF NOT EXISTS idx_attempts_enrollment_id 
  ON attempts(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_results_attempt_id 
  ON results(attempt_id);

CREATE INDEX IF NOT EXISTS idx_results_published_by 
  ON results(published_by);

CREATE INDEX IF NOT EXISTS idx_certificates_result_id 
  ON certificates(result_id);

CREATE INDEX IF NOT EXISTS idx_certificates_issued_by 
  ON certificates(issued_by);

CREATE INDEX IF NOT EXISTS idx_appeals_student_id 
  ON appeals(student_id);

CREATE INDEX IF NOT EXISTS idx_appeals_question_version_id 
  ON appeals(question_version_id);
