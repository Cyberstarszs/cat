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
import { Users, KeyRound, ShieldAlert, CheckCircle2, Search, UserX, UserCheck } from 'lucide-react';

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
    try {
      const res = await userService.resetPassword(activeUserForReset.id);
      setNewGeneratedPass(res.new_password);
      showToast('Kata sandi berhasil direset!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mereset kata sandi.', 'error');
    } finally {
      setResetting(false);
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
                  <th className="px-6 py-3.5">Wajib Ganti Password</th>
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
                    <td className="px-6 py-4 text-[#595562]">
                      {u.must_change_password ? (
                        <span className="text-[#a96817] font-semibold">Ya</span>
                      ) : (
                        <span className="text-[#287a58]">Tidak</span>
                      )}
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
        onClose={() => setResetModalOpen(false)}
        title="Reset Kata Sandi Akun"
        description={`Akun: ${activeUserForReset?.email}`}
      >
        <div className="space-y-4">
          {newGeneratedPass ? (
            <div className="p-4 bg-[#eaf4ef] border border-[#bce2cf] rounded text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#287a58] mx-auto" />
              <div className="text-xs font-bold text-[#24212b]">Kata Sandi Baru Sementara:</div>
              <div className="font-mono font-extrabold text-base text-[#287a58] bg-white p-2 rounded border border-[#bce2cf]">
                {newGeneratedPass}
              </div>
              <p className="text-[11px] text-[#595562]">
                Berikan kata sandi ini kepada pemilik akun. Pengguna wajib mengganti kata sandi ini pada saat pertama kali login.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-[#595562] leading-relaxed">
                Tindakan ini akan membuat kata sandi acak baru yang aman dan menandai akun agar wajib memperbarui sandinya saat pertama login.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button variant="ghost" onClick={() => setResetModalOpen(false)}>
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
