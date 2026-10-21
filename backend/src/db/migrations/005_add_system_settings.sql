-- Migration: 005_add_system_settings.sql
-- Table untuk menyimpan konfigurasi tata kelola institusi, sertifikat, dan pengaturan operasional

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed konfigurasi default Fakultas Ilmu Administrasi (FIA) Universitas Madura
INSERT INTO system_settings (key, value, updated_at)
VALUES (
  'institution',
  '{
    "faculty_name": "Fakultas Ilmu Administrasi",
    "university_name": "Universitas Madura",
    "decan_name": "Dr. H. Abd. Razak, S.E., M.Si.",
    "decan_nip": "19740512 200501 1 002",
    "decan_title": "Dekan Fakultas Ilmu Administrasi",
    "cert_city": "Pamekasan",
    "cert_validity_years": 2,
    "cert_no_prefix": "CAT-FIA/UNIRA"
  }'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;
