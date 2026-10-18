-- Add year column to questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

-- Set any existing questions without year to 2026
UPDATE questions SET year = 2026 WHERE year IS NULL;

-- Index on questions for category, status, and year
CREATE INDEX IF NOT EXISTS idx_questions_category_status_year ON questions(category_id, status, year);
CREATE INDEX IF NOT EXISTS idx_questions_year ON questions(year);

-- Add question_year column to exam_sessions (nullable: specific year or NULL for all years)
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS question_year INT;
