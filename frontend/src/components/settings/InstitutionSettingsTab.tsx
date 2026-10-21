import React, { useState, useEffect } from 'react';
import { settingsService, InstitutionSettings } from '../../services';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../../context/ToastContext';
import {
  Building2,
  FileCheck2,
  Save,
  RefreshCw,
  QrCode,
  Award,
  Sparkles,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export const InstitutionSettingsTab: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<InstitutionSettings>({
    faculty_name: 'Fakultas Ilmu Administrasi',
    university_name: 'Universitas Madura',
    decan_name: 'Dr. H. Abd. Razak, S.E., M.Si.',
    decan_nip: '19740512 200501 1 002',
    decan_title: 'Dekan Fakultas Ilmu Administrasi',
    cert_city: 'Pamekasan',
    cert_validity_years: 2,
    cert_no_prefix: 'CAT-FIA/UNIRA',
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsService.getInstitutionSettings();
      setForm(data);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal memuat pengaturan institusi', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await settingsService.updateInstitutionSettings(form);
      setForm(updated);
      showToast('Konfigurasi institusi dan penandatangan sertifikat berhasil diperbarui!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal menyimpan konfigurasi institusi', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Form Pengaturan (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card hasShadow className="space-y-4 border-t-4 border-t-[#583682]">
            <div className="flex items-center justify-between pb-3 border-b border-[#e6e1eb]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#583682]" />
                <h3 className="font-display font-bold text-base text-[#24212b]">
                  Data Institusi & Penandatangan
                </h3>
              </div>
              <Badge variant="purple">Dekanat FIA</Badge>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#583682]" />
                Memuat konfigurasi institusi...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Nama Universitas"
                    value={form.university_name}
                    onChange={(e) => setForm({ ...form, university_name: e.target.value })}
                    required
                    placeholder="Contoh: Universitas Madura"
                  />
                  <Input
                    label="Nama Fakultas"
                    value={form.faculty_name}
                    onChange={(e) => setForm({ ...form, faculty_name: e.target.value })}
                    required
                    placeholder="Contoh: Fakultas Ilmu Administrasi"
                  />
                </div>

                <div className="pt-2 border-t border-dashed border-[#e6e1eb]">
                  <div className="text-[11px] font-bold text-[#583682] uppercase tracking-wider mb-2">
                    Penandatangan Sertifikat
                  </div>
                  <div className="space-y-3">
                    <Input
                      label="Nama Lengkap & Gelar Dekan"
                      value={form.decan_name}
                      onChange={(e) => setForm({ ...form, decan_name: e.target.value })}
                      required
                      placeholder="Contoh: Dr. H. Abd. Razak, S.E., M.Si."
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="NIP / NIDN Pejabat"
                        value={form.decan_nip}
                        onChange={(e) => setForm({ ...form, decan_nip: e.target.value })}
                        placeholder="Contoh: 19740512 200501 1 002"
                      />
                      <Input
                        label="Jabatan Resmi"
                        value={form.decan_title}
                        onChange={(e) => setForm({ ...form, decan_title: e.target.value })}
                        required
                        placeholder="Contoh: Dekan Fakultas Ilmu Administrasi"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed border-[#e6e1eb]">
                  <div className="text-[11px] font-bold text-[#583682] uppercase tracking-wider mb-2">
                    Penerbitan Sertifikat
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="Kota Penerbitan"
                      value={form.cert_city}
                      onChange={(e) => setForm({ ...form, cert_city: e.target.value })}
                      required
                      placeholder="Contoh: Pamekasan"
                    />

                    <div>
                      <label className="block text-xs font-bold text-[#24212b] mb-1">
                        Masa Berlaku (Tahun)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={form.cert_validity_years}
                        onChange={(e) =>
                          setForm({ ...form, cert_validity_years: parseInt(e.target.value, 10) || 2 })
                        }
                        className="w-full h-[46px] px-3.5 bg-white border border-[#e6e1eb] rounded-[6px] text-xs font-bold text-[#24212b] outline-none focus:border-[#583682]"
                      />
                    </div>

                    <Input
                      label="Prefix Nomor Sertifikat"
                      value={form.cert_no_prefix}
                      onChange={(e) => setForm({ ...form, cert_no_prefix: e.target.value })}
                      required
                      placeholder="Contoh: CAT-FIA/UNIRA"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-[#e6e1eb]">
                  <div className="text-[11px] text-[#716c7a]">
                    Berlaku otomatis untuk penerbitan sertifikat baru.
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={saving}
                    leftIcon={<Save className="w-4 h-4" />}
                    className="text-xs"
                  >
                    Simpan Pengaturan
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>

        {/* Kolom Kanan: Live Certificate Signature Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 bg-gradient-to-b from-[#fcfaff] to-[#f4effa] border border-[#d9c9ec] shadow-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-[#e5dcf2]">
              <FileCheck2 className="w-4 h-4 text-[#583682]" />
              <div className="text-xs font-bold text-[#24212b] uppercase tracking-wide">
                Pratinjau Pengesahan Sertifikat
              </div>
            </div>

            <div className="mt-3 p-4 bg-white rounded-lg border border-[#e0d6ed] shadow-xs space-y-4 text-center">
              <div className="border-b border-[#f0ebf7] pb-3">
                <div className="text-[10px] font-bold text-[#583682] uppercase tracking-widest">
                  SERTIFIKAT KELULUSAN
                </div>
                <div className="text-xs font-extrabold text-gray-800 uppercase mt-0.5">
                  {form.faculty_name}
                </div>
                <div className="text-[10px] text-gray-500 uppercase">{form.university_name}</div>
              </div>

              <div className="py-1">
                <div className="text-[10px] text-gray-400">Diberikan kepada:</div>
                <div className="font-bold text-sm text-[#24212b] mt-0.5">
                  ACHMAD FAUZI, S.AP.
                </div>
                <div className="text-[10px] text-gray-500">NIM: 2022010045 • Nilai: 88.50</div>
              </div>

              {/* Bottom Signatory Preview */}
              <div className="pt-3 border-t border-dashed border-gray-200 grid grid-cols-2 gap-2 text-left items-end">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 bg-gray-100 border border-gray-300 rounded flex items-center justify-center text-gray-400">
                    <QrCode className="w-8 h-8 text-gray-700" />
                  </div>
                  <div className="text-[8px] text-gray-400 leading-tight">
                    <div>No: {form.cert_no_prefix}-2026-0042</div>
                    <div>Berlaku: {form.cert_validity_years} Tahun</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[9px] text-gray-600">
                    {form.cert_city}, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="text-[9px] font-bold text-[#583682] mt-0.5 leading-tight">
                    {form.decan_title}
                  </div>
                  <div className="h-6"></div>
                  <div className="text-[9px] font-bold text-gray-900 underline">
                    {form.decan_name}
                  </div>
                  {form.decan_nip && (
                    <div className="text-[8px] text-gray-500 font-mono">NIP. {form.decan_nip}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-[#583682]">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Dilengkapi QR Code verifikasi keaslian ijazah publik.</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
