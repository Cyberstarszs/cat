import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { User, Phone, Building, KeyRound, CheckCircle2 } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  // Profile fields
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [institution, setInstitution] = useState(profile?.institution || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await authService.updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        institution: institution.trim(),
      });
      await refreshProfile();
      showToast('Profil Anda berhasil diperbarui!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui profil.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10 w-full space-y-8">
      <div className="pb-4 border-b border-[#e6e1eb]">
        <div className="eyebrow mb-1">PENGATURAN AKUN</div>
        <h1 className="font-display font-bold text-2xl md:text-3xl text-[#24212b]">
          Profil & Keamanan Akun
        </h1>
        <p className="text-xs text-[#595562] mt-1">
          Kelola informasi identitas peserta dan kata sandi akun ujian Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Profile Card */}
        <Card hasShadow>
          <h3 className="font-display font-bold text-base text-[#24212b] mb-4 pb-3 border-b border-[#e6e1eb] flex items-center gap-2">
            <User className="w-4 h-4 text-[#583682]" />
            Informasi Pribadi Peserta
          </h3>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nomor Identitas (NIM / No. Peserta)"
                value={profile?.identifier || '-'}
                disabled
                helperText="Nomor identitas ditetapkan oleh sistem dan tidak dapat diubah."
              />
              <Input
                label="Alamat Email"
                value={user?.email || '-'}
                disabled
                helperText="Email akun utama terdaftar."
              />
            </div>

            <Input
              label="Nama Lengkap"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masukkan nama lengkap Anda"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nomor Telepon / WhatsApp"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 08123456789"
                leftIcon={<Phone className="w-4 h-4 text-gray-400" />}
              />
              <Input
                label="Instansi / Asal"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Contoh: FIA UNIRA atau Umum"
                leftIcon={<Building className="w-4 h-4 text-gray-400" />}
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary" isLoading={savingProfile}>
                Simpan Perubahan Profil
              </Button>
            </div>
          </form>
        </Card>

        {/* Security & Password Info Card */}
        <Card hasShadow>
          <h3 className="font-display font-bold text-base text-[#24212b] mb-3 pb-3 border-b border-[#e6e1eb] flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#583682]" />
            Keamanan & Kata Sandi Akun
          </h3>
          <div className="p-4 bg-[#faf9fc] rounded border border-[#e6e1eb] text-xs text-[#595562] leading-relaxed space-y-2">
            <p>
              Pengaturan dan reset kata sandi akun peserta dikelola secara terpusat oleh <strong>Administrator Sistem</strong> untuk menjamin keamanan dan ketertiban administrasi ujian.
            </p>
            <p>
              Jika Anda memerlukan reset kata sandi, silakan hubungi pengawas atau panitia ujian CAT FIA UNIRA.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
