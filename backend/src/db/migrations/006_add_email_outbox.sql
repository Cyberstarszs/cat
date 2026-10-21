-- Migration: 006_add_email_outbox.sql
-- Queue outbox untuk pengiriman sertifikat ke email kampus mahasiswa
-- Dilengkapi rate limiting, anti-spam delay, retry backoff, dan perlindungan konkurensi

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, sending, sent, failed
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index parsial untuk worker antrean email
CREATE INDEX IF NOT EXISTS idx_email_outbox_queue 
  ON email_outbox (status, next_retry_at) 
  WHERE status IN ('pending', 'failed');

-- Index foreign key
CREATE INDEX IF NOT EXISTS idx_email_outbox_certificate_id 
  ON email_outbox (certificate_id);

-- Cegah duplikasi pengiriman email untuk sertifikat yang sama
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_outbox_cert_unique 
  ON email_outbox (certificate_id) 
  WHERE certificate_id IS NOT NULL;

-- Default SMTP / Campus Email Configuration
INSERT INTO system_settings (key, value, updated_at)
VALUES (
  'smtp',
  '{
    "enabled": true,
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": false,
    "user": "",
    "pass": "",
    "from_name": "CAT FIA Universitas Madura",
    "from_email": "cat-noreply@unira.ac.id",
    "rate_limit_per_minute": 20,
    "delay_between_emails_ms": 2000
  }'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;
