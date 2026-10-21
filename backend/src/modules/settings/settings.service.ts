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
