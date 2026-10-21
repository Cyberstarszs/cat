import { pool } from '../../db/connection.js';
import { logAudit } from '../audit/audit.service.js';

export interface InstitutionSettings {
  faculty_name: string;
  university_name: string;
  decan_name: string;
  decan_nip: string;
  decan_title: string;
  cert_city: string;
  cert_validity_years: number;
  cert_no_prefix: string;
}

const DEFAULT_SETTINGS: InstitutionSettings = {
  faculty_name: 'Fakultas Ilmu Administrasi',
  university_name: 'Universitas Madura',
  decan_name: 'Dr. H. Abd. Razak, S.E., M.Si.',
  decan_nip: '19740512 200501 1 002',
  decan_title: 'Dekan Fakultas Ilmu Administrasi',
  cert_city: 'Pamekasan',
  cert_validity_years: 2,
  cert_no_prefix: 'CAT-FIA/UNIRA',
};

export async function getInstitutionSettings(): Promise<InstitutionSettings> {
  const { rows } = await pool.query(
    `SELECT value FROM system_settings WHERE key = 'institution';`
  );

  if (rows.length === 0 || !rows[0].value) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    ...DEFAULT_SETTINGS,
    ...rows[0].value,
  };
}

export async function updateInstitutionSettings(
  data: Partial<InstitutionSettings>,
  actorId: string,
  ipAddress?: string
): Promise<InstitutionSettings> {
  const current = await getInstitutionSettings();
  const updated: InstitutionSettings = {
    faculty_name: data.faculty_name?.trim() || current.faculty_name,
    university_name: data.university_name?.trim() || current.university_name,
    decan_name: data.decan_name?.trim() || current.decan_name,
    decan_nip: data.decan_nip?.trim() || current.decan_nip,
    decan_title: data.decan_title?.trim() || current.decan_title,
    cert_city: data.cert_city?.trim() || current.cert_city,
    cert_validity_years: data.cert_validity_years ?? current.cert_validity_years,
    cert_no_prefix: data.cert_no_prefix?.trim() || current.cert_no_prefix,
  };

  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ('institution', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = now();`,
    [JSON.stringify(updated)]
  );

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'settings.update',
    entityType: 'system_settings',
    entityId: null,
    beforeData: current,
    afterData: { ...updated, key: 'institution' },
    ipAddress,
  });

  return updated;
}

export interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from_name: string;
  from_email: string;
  rate_limit_per_minute: number;
  delay_between_emails_ms: number;
}

const DEFAULT_SMTP: SmtpSettings = {
  enabled: true,
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from_name: process.env.SMTP_FROM_NAME || 'CAT FIA Universitas Madura',
  from_email: process.env.SMTP_FROM_EMAIL || 'cat-noreply@unira.ac.id',
  rate_limit_per_minute: Number(process.env.EMAIL_RATE_LIMIT_PER_MINUTE) || 20,
  delay_between_emails_ms: Number(process.env.EMAIL_DELAY_BETWEEN_MS) || 2000,
};

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const { rows } = await pool.query(
    `SELECT value FROM system_settings WHERE key = 'smtp';`
  );

  if (rows.length === 0 || !rows[0].value) {
    return { ...DEFAULT_SMTP };
  }

  return {
    ...DEFAULT_SMTP,
    ...rows[0].value,
  };
}

export async function updateSmtpSettings(
  data: Partial<SmtpSettings>,
  actorId: string,
  ipAddress?: string
): Promise<SmtpSettings> {
  const current = await getSmtpSettings();
  const updated: SmtpSettings = {
    enabled: data.enabled !== undefined ? Boolean(data.enabled) : current.enabled,
    host: data.host?.trim() || current.host,
    port: data.port !== undefined ? Number(data.port) : current.port,
    secure: data.secure !== undefined ? Boolean(data.secure) : current.secure,
    user: data.user !== undefined ? data.user.trim() : current.user,
    pass: data.pass !== undefined && data.pass !== '' ? data.pass : current.pass,
    from_name: data.from_name?.trim() || current.from_name,
    from_email: data.from_email?.trim() || current.from_email,
    rate_limit_per_minute: data.rate_limit_per_minute !== undefined ? Number(data.rate_limit_per_minute) : current.rate_limit_per_minute,
    delay_between_emails_ms: data.delay_between_emails_ms !== undefined ? Number(data.delay_between_emails_ms) : current.delay_between_emails_ms,
  };

  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ('smtp', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = now();`,
    [JSON.stringify(updated)]
  );

  await logAudit({
    actorId,
    actorRole: 'admin',
    action: 'settings.update_smtp',
    entityType: 'system_settings',
    entityId: null,
    afterData: { ...updated, pass: updated.pass ? '******' : '' },
    ipAddress,
  });

  return updated;
}
