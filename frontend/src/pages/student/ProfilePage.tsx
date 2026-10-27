import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStudentPhoto } from '../../services/unira';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { User, Phone, Building, KeyRound, CheckCircle2 } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { photoUrl } = useStudentPhoto(profile?.identifier, user?.role, profile?.institution);
  const { showToast } = useToast();

  // Profile fields
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [institution, setInstitution] = useState(profile?.institution || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Sinkronisasi data saat profile selesai dimuat dari server
  React.useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setInstitution(profile.institution || '');
    }
  }, [profile]);

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
          Profil Akun
        </h1>
        <p className="text-xs text-[#595562] mt-1">
          Informasi identitas akun peserta ujian Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Profile Card */}
        <Card hasShadow>
          <h3 className="font-display font-bold text-base text-[#24212b] mb-4 pb-3 border-b border-[#e6e1eb] flex items-center gap-2">
            <User className="w-4 h-4 text-[#583682]" />
            Data Pribadi
          </h3>

          {/* Student Photo & Profile Header */}
          <div className="flex items-center gap-4 p-4 bg-[#faf9fc] rounded border border-[#e6e1eb] mb-5">
            <div className="w-16 h-16 rounded-full bg-[#eae2f5] text-[#583682] flex items-center justify-center overflow-hidden border-2 border-[#583682]/20 shadow-sm shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={profile?.full_name || 'Foto Mahasiswa'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <User className="w-8 h-8 stroke-1" />
              )}
            </div>
            <div>
              <h4 className="font-display font-bold text-base text-[#24212b]">
                {profile?.full_name || user?.email}
              </h4>
              <p className="text-xs text-[#595562]">
                {user?.role === 'umum' || profile?.identifier?.startsWith('UMUM') ? 'No. Peserta' : 'NIM'}:{' '}
                {profile?.identifier || '-'}
              </p>
              <span className="inline-block text-[11px] font-semibold text-[#583682] bg-[#f2ecf8] px-2 py-0.5 rounded mt-1">
                {profile?.institution || (user?.role === 'mahasiswa' ? 'Mahasiswa UNIRA' : 'Peserta Ujian')}
              </span>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nomor Identitas"
                value={profile?.identifier || '-'}
                disabled
                helperText="Ditetapkan otomatis oleh sistem."
              />
              <Input
                label="Email"
                value={user?.email || '-'}
                disabled
                helperText="Email akun terdaftar."
              />
            </div>

            <Input
              label="Nama Lengkap"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nama lengkap"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nomor Telepon / WhatsApp"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nomor telepon"
                leftIcon={<Phone className="w-4 h-4 text-gray-400" />}
              />
              <Input
                label="Instansi / Asal"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Prodi atau instansi"
                leftIcon={<Building className="w-4 h-4 text-gray-400" />}
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary" isLoading={savingProfile}>
                Simpan Profil
              </Button>
            </div>
          </form>
        </Card>

        {/* Security & Password Info Card */}
        <Card hasShadow>
          <h3 className="font-display font-bold text-base text-[#24212b] mb-3 pb-3 border-b border-[#e6e1eb] flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#583682]" />
            Keamanan Akun
          </h3>
          <div className="p-4 bg-[#faf9fc] rounded border border-[#e6e1eb] text-xs text-[#595562] leading-relaxed space-y-2">
            <p>
              Kata sandi akun peserta dikelola oleh <strong>Administrator Sistem</strong> untuk menjaga ketertiban administrasi ujian.
            </p>
            <p>
              Hubungi pengawas atau panitia ujian CAT FIA jika Anda memerlukan bantuan reset kata sandi.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
