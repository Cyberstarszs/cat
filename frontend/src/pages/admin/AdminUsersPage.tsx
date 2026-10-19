import React, { useEffect, useState } from 'react';
import { userService } from '../../services';
import { User } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import { Users, KeyRound, ShieldAlert, CheckCircle2, Search, UserX, UserCheck, Copy, Check } from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Reset password modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [activeUserForReset, setActiveUserForReset] = useState<User | null>(null);
  const [newGeneratedPass, setNewGeneratedPass] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat pengguna.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (u: User) => {
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    try {
      await userService.updateUserStatus(u.id, nextStatus);
      showToast(`Status akun ${u.email} berhasil diubah menjadi ${nextStatus}.`, 'success');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status akun.', 'error');
    }
  };

  const handleResetPassword = async () => {
    if (!activeUserForReset) return;
    setResetting(true);
    setCopied(false);
    try {
      const res = await userService.resetPassword(activeUserForReset.id);
      setNewGeneratedPass(res.new_password);
      showToast('Kata sandi berhasil direset ke 6 angka baru!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mereset kata sandi.', 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!newGeneratedPass) return;
    try {
      await navigator.clipboard.writeText(newGeneratedPass);
      setCopied(true);
      showToast('Kata sandi berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = newGeneratedPass;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      showToast('Kata sandi berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const filteredUsers = users.filter((u) => {
    return (
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">AKUN & HAK AKSES</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Manajemen Pengguna Sistem
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Daftar seluruh akun administrator dan peserta, proteksi admin tunggal (INV-21), dan reset kata sandi.
          </p>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchUsers} />}

      <div className="max-w-md">
        <Input
          placeholder="Cari email atau role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-gray-400" />}
        />
      </div>

      <Card hasShadow className="overflow-hidden p-0">
        {loading ? (
          <div className="p-6">
            <CardSkeleton />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Tidak Ada Pengguna"
              description="Tidak ada data akun pengguna yang cocok dengan kriteria pencarian."
              icon={<Users className="w-8 h-8 text-[#583682]" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-3.5">Email Pengguna</th>
                  <th className="px-6 py-3.5">Peran (Role)</th>
                  <th className="px-6 py-3.5">Status Akun</th>
                  <th className="px-6 py-3.5">Terdaftar Sejak</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e1eb]">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#faf9fc]/80 transition">
                    <td className="px-6 py-4 font-bold text-[#24212b]">{u.email}</td>
                    <td className="px-6 py-4">
                      <Badge variant={u.role === 'admin' ? 'purple' : 'neutral'}>
                        {u.role.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={u.status === 'active' ? 'success' : 'danger'}>
                        {u.status === 'active' ? 'AKTIF' : 'SUSPENDED'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setActiveUserForReset(u);
                            setNewGeneratedPass(null);
                            setCopied(false);
                            setResetModalOpen(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-[#583682] hover:bg-[#eae2f5] rounded transition"
                          title="Reset Password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`p-1.5 rounded transition ${
                            u.status === 'active'
                              ? 'text-[#b63b48] hover:bg-[#fbeeed]'
                              : 'text-[#287a58] hover:bg-[#eaf4ef]'
                          }`}
                          title={u.status === 'active' ? 'Suspend Akun' : 'Aktifkan Akun'}
                        >
                          {u.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => {
          setResetModalOpen(false);
          setNewGeneratedPass(null);
          setCopied(false);
        }}
        title="Reset Kata Sandi Akun"
        description={`Akun: ${activeUserForReset?.email}`}
      >
        <div className="space-y-4">
          {newGeneratedPass ? (
            <div className="p-5 bg-[#eaf4ef] border border-[#bce2cf] rounded-lg text-center space-y-3">
              <CheckCircle2 className="w-9 h-9 text-[#287a58] mx-auto" />
              <div>
                <div className="text-xs font-bold text-[#24212b]">Kata Sandi Baru (6 Angka):</div>
                <p className="text-[11px] text-[#595562] mt-0.5">
                  Gunakan 6 digit angka berikut untuk diberikan kepada pengguna:
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1 pb-1">
                <div
                  onClick={handleCopyPassword}
                  className="font-mono font-black text-2xl tracking-[0.35em] text-[#287a58] bg-white px-5 py-2.5 rounded-lg border-2 border-[#bce2cf] select-all cursor-pointer shadow-sm hover:border-[#287a58] transition"
                  title="Klik untuk menyalin"
                >
                  {newGeneratedPass}
                </div>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer ${
                    copied
                      ? 'bg-[#287a58] text-white hover:bg-[#1f5e44]'
                      : 'bg-[#583682] text-white hover:bg-[#352148]'
                  }`}
                  title="Salin Kata Sandi"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-white" />
                      <span>Salin Sandi</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-[#595562]">
                Berikan 6 digit angka ini kepada pemilik akun. Pengguna dapat langsung login menggunakan kata sandi ini.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-[#595562] leading-relaxed">
                Tindakan ini akan mereset kata sandi akun <strong>{activeUserForReset?.email}</strong> menjadi <strong>format 6 angka acak baru</strong>.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button
              variant="ghost"
              onClick={() => {
                setResetModalOpen(false);
                setNewGeneratedPass(null);
                setCopied(false);
              }}
            >
              {newGeneratedPass ? 'Selesai' : 'Batal'}
            </Button>
            {!newGeneratedPass && (
              <Button variant="primary" onClick={handleResetPassword} isLoading={resetting}>
                Reset Sandi Sekarang
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
