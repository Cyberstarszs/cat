-- Migration 008: Fix unique constraint on email_outbox table
-- Convert partial unique index to standard unique index for seamless ON CONFLICT handling
DROP INDEX IF EXISTS idx_email_outbox_cert_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_outbox_cert_unique ON email_outbox (certificate_id);
