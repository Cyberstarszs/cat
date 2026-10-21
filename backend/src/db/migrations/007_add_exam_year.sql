-- Migration 007: Add year column to exams table
ALTER TABLE exams ADD COLUMN IF NOT EXISTS year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

-- Index for querying exams by year
CREATE INDEX IF NOT EXISTS idx_exams_year ON exams(year);
