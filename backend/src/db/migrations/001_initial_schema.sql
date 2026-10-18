-- src/db/migrations/001_initial_schema.sql
-- =============================================================================
-- CAT GOVERNANCE - INITIAL SCHEMA MIGRATION (001_initial_schema.sql)
-- 23 Tables for General Public Competency Test at FIA
-- PostgreSQL 16+ Compliant with Strict Integrity Constraints & Invariants
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. ENUMS (Bagian 5.1)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE publish_state AS ENUM ('draft', 'active', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE session_state AS ENUM ('draft', 'published', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enrollment_state AS ENUM ('registered', 'attended', 'absent', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attempt_state AS ENUM ('in_progress', 'submitted', 'auto_submitted', 'graded', 'void');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE result_state AS ENUM ('pending_publication', 'published');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE cert_state AS ENUM ('valid', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE correction_type AS ENUM ('key_changed', 'also_accept', 'annulled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE appeal_state AS ENUM ('open', 'accepted', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 2. USERS & PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(254) NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    status user_status NOT NULL DEFAULT 'active',
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON users (lower(email)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS student_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    identifier VARCHAR(50) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    institution VARCHAR(150),
    phone VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_student_profiles_identifier UNIQUE (identifier)
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);

-- -----------------------------------------------------------------------------
-- 3. BANK SOAL & UJIAN
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES question_categories(id) ON DELETE RESTRICT,
    status publish_state NOT NULL DEFAULT 'draft',
    current_version_id UUID,
    year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_questions_category_status_year ON questions(category_id, status, year);
CREATE INDEX IF NOT EXISTS idx_questions_year ON questions(year);

CREATE TABLE IF NOT EXISTS question_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    version_no INT NOT NULL,
    stem TEXT NOT NULL,
    difficulty SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
    weight NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (weight > 0),
    explanation TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_question_version_no UNIQUE (question_id, version_no)
);

-- Circular FK questions.current_version_id -> question_versions.id
DO $$ BEGIN
    ALTER TABLE questions
        ADD CONSTRAINT fk_questions_current_version
        FOREIGN KEY (current_version_id) REFERENCES question_versions(id)
        DEFERRABLE INITIALLY DEFERRED;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_version_id UUID NOT NULL REFERENCES question_versions(id) ON DELETE RESTRICT,
    position SMALLINT NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_question_options_position UNIQUE (question_version_id, position),
    CONSTRAINT uq_question_options_composite UNIQUE (question_version_id, id)
);
-- Partial unique index: tepat satu opsi benar per question_version_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_question_options_single_correct
    ON question_options(question_version_id)
    WHERE is_correct = true;

CREATE TABLE IF NOT EXISTS question_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_version_id UUID NOT NULL REFERENCES question_versions(id) ON DELETE RESTRICT,
    type correction_type NOT NULL,
    old_option_id UUID,
    new_option_id UUID,
    reason TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_corrections_old_option FOREIGN KEY (question_version_id, old_option_id)
        REFERENCES question_options(question_version_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_corrections_new_option FOREIGN KEY (question_version_id, new_option_id)
        REFERENCES question_options(question_version_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    question_count INT NOT NULL CHECK (question_count > 0),
    passing_score NUMERIC(5,2) NOT NULL CHECK (passing_score >= 0 AND passing_score <= 100),
    shuffle_questions BOOLEAN NOT NULL DEFAULT true,
    shuffle_options BOOLEAN NOT NULL DEFAULT true,
    max_attempts_per_student SMALLINT NOT NULL DEFAULT 3 CHECK (max_attempts_per_student >= 1),
    allow_review BOOLEAN NOT NULL DEFAULT false,
    status publish_state NOT NULL DEFAULT 'draft',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_question_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES question_categories(id) ON DELETE RESTRICT,
    difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 3),
    question_count INT NOT NULL CHECK (question_count > 0),
    CONSTRAINT uq_exam_rules UNIQUE (exam_id, category_id, difficulty)
);

-- -----------------------------------------------------------------------------
-- 4. SESI & PENDAFTARAN
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    capacity INT CHECK (capacity > 0),
    access_code_hash TEXT,
    question_year INT,
    status session_state NOT NULL DEFAULT 'draft',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_sessions_time CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_sessions_time ON exam_sessions(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_sessions_exam_status ON exam_sessions(exam_id, status);

CREATE TABLE IF NOT EXISTS session_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status enrollment_state NOT NULL DEFAULT 'registered',
    registered_by UUID REFERENCES users(id),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_session_student UNIQUE (session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON session_enrollments(student_id);

-- -----------------------------------------------------------------------------
-- 5. PELAKSANAAN UJIAN (ATTEMPTS, QUESTIONS, ANSWERS, EVENTS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES session_enrollments(id) ON DELETE RESTRICT,
    attempt_no INT NOT NULL DEFAULT 1,
    status attempt_state NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at TIMESTAMPTZ NOT NULL,
    extra_seconds INT NOT NULL DEFAULT 0 CHECK (extra_seconds >= 0),
    extension_reason TEXT,
    submitted_at TIMESTAMPTZ,
    submit_reason VARCHAR(20) CHECK (submit_reason IN ('manual', 'timeout', 'forced')),
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_attempt_enrollment_no UNIQUE (enrollment_id, attempt_no)
);
-- INV-01: Satu pendaftaran punya paling banyak satu percobaan non-void
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempts_single_non_void
    ON attempts (enrollment_id)
    WHERE status <> 'void';

CREATE INDEX IF NOT EXISTS idx_attempts_status_deadline
    ON attempts (status, deadline_at);

CREATE TABLE IF NOT EXISTS attempt_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE RESTRICT,
    question_version_id UUID NOT NULL REFERENCES question_versions(id) ON DELETE RESTRICT,
    position SMALLINT NOT NULL,
    option_order JSONB NOT NULL,
    CONSTRAINT uq_attempt_question_pos UNIQUE (attempt_id, position),
    CONSTRAINT uq_attempt_question_version UNIQUE (attempt_id, question_version_id),
    CONSTRAINT uq_attempt_question_composite UNIQUE (id, question_version_id)
);
CREATE INDEX IF NOT EXISTS idx_attempt_questions_attempt ON attempt_questions(attempt_id);

CREATE TABLE IF NOT EXISTS attempt_answers (
    attempt_question_id UUID PRIMARY KEY,
    question_version_id UUID NOT NULL,
    selected_option_id UUID,
    is_flagged BOOLEAN NOT NULL DEFAULT false,
    client_seq INT NOT NULL DEFAULT 0,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_correct BOOLEAN,
    points_awarded NUMERIC(6,2),
    CONSTRAINT fk_answers_attempt_question
        FOREIGN KEY (attempt_question_id, question_version_id)
        REFERENCES attempt_questions(id, question_version_id) ON DELETE CASCADE,
    -- INV-05: Opsi terpilih harus milik versi soal tersebut
    CONSTRAINT fk_answers_selected_option
        FOREIGN KEY (question_version_id, selected_option_id)
        REFERENCES question_options(question_version_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS attempt_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    client_time TIMESTAMPTZ,
    detail JSONB
);
CREATE INDEX IF NOT EXISTS idx_attempt_events_time ON attempt_events(attempt_id, occurred_at);

-- -----------------------------------------------------------------------------
-- 6. PENILAIAN, SERTIFIKAT, & SANGGAH
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL UNIQUE REFERENCES attempts(id) ON DELETE RESTRICT,
    raw_score NUMERIC(7,2) NOT NULL CHECK (raw_score >= 0),
    max_score NUMERIC(7,2) NOT NULL CHECK (max_score > 0),
    score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    passing_score NUMERIC(5,2) NOT NULL CHECK (passing_score >= 0 AND passing_score <= 100),
    passed BOOLEAN NOT NULL,
    formula_version VARCHAR(20) NOT NULL DEFAULT 'v1',
    revision_no INT NOT NULL DEFAULT 0,
    status result_state NOT NULL DEFAULT 'pending_publication',
    graded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES users(id),
    CONSTRAINT chk_results_scores CHECK (raw_score <= max_score)
);
CREATE INDEX IF NOT EXISTS idx_results_status ON results(status);

CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL UNIQUE REFERENCES results(id) ON DELETE RESTRICT,
    certificate_no VARCHAR(40) NOT NULL UNIQUE,
    verification_code VARCHAR(64) NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    status cert_state NOT NULL DEFAULT 'valid',
    revoked_at TIMESTAMPTZ,
    revoke_source VARCHAR(10) CHECK (revoke_source IN ('manual', 'regrade')),
    revoked_reason TEXT,
    issued_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_certificates_verify_code ON certificates(verification_code);

CREATE TABLE IF NOT EXISTS certificate_counters (
    year SMALLINT PRIMARY KEY,
    last_seq INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES results(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    question_version_id UUID REFERENCES question_versions(id),
    message TEXT NOT NULL CHECK (char_length(message) <= 1000),
    status appeal_state NOT NULL DEFAULT 'open',
    response TEXT,
    responded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_appeals_result ON appeals(result_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);

-- -----------------------------------------------------------------------------
-- 7. NOTIFIKASI & AUDIT LOGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    entity_type VARCHAR(40),
    entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ,
    dedupe_key VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read_at, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedupe
    ON notifications (recipient_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role user_role,
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id UUID,
    reason TEXT,
    before_data JSONB,
    after_data JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at);

-- -----------------------------------------------------------------------------
-- 8. TRIGGERS UNTUK IMMUTABILITY (INV-06 & INV-19)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Table % is append-only/immutable and cannot be modified or deleted', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_question_versions ON question_versions;
CREATE TRIGGER trg_immutable_question_versions
    BEFORE UPDATE OR DELETE ON question_versions
    FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

DROP TRIGGER IF EXISTS trg_immutable_attempt_questions ON attempt_questions;
CREATE TRIGGER trg_immutable_attempt_questions
    BEFORE UPDATE OR DELETE ON attempt_questions
    FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

DROP TRIGGER IF EXISTS trg_append_only_audit_logs ON audit_logs;
CREATE TRIGGER trg_append_only_audit_logs
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

DROP TRIGGER IF EXISTS trg_append_only_corrections ON question_corrections;
CREATE TRIGGER trg_append_only_corrections
    BEFORE UPDATE OR DELETE ON question_corrections
    FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();
