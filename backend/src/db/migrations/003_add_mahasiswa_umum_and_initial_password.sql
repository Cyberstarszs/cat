-- src/db/migrations/003_add_mahasiswa_umum_and_initial_password.sql
-- =============================================================================
-- Ensure user_role enum contains 'mahasiswa' and 'umum'
-- Ensure student_profiles contains 'initial_password' column
-- =============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'mahasiswa';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'umum';

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS initial_password VARCHAR(50);
