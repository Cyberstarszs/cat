import React, { useEffect, useState } from 'react';
import { userService } from '../../services';
import { User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { alert } from '../../utils/alert';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import {
  Users,
  KeyRound,
  Search,
  UserX,
  UserCheck,
  Plus,
  Trash2,
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Add admin modal
  const [addAdminModalOpen, setAddAdminModalOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

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
    if (currentUser?.id === u.id) {
      alert.warning('Aksi Ditolak', 'Anda tidak dapat menonaktifkan akun Anda sendiri saat sedang login.');
      return;
    }
    const isSuspending = u.status === 'active';
    const confirmed = await alert.confirm({
      title: isSuspending ? 'Tangguhkan Akun Pengguna?' : 'Aktifkan Kembali Akun?',
      text: isSuspending
        ? `Pengguna "${u.email}" tidak akan dapat login lagi ke sistem hingga akun diaktifkan kembali.`
        : `Pengguna "${u.email}" akan diizinkan kembali untuk login dan beraktivitas di sistem.`,
      confirmButtonText: isSuspending ? 'Ya, Tangguhkan' : 'Ya, Aktifkan',
      isDangerous: isSuspending,
    });
    if (!confirmed) return;

    const nextStatus = isSuspending ? 'suspended' : 'active';
    try {
      await userService.updateUserStatus(u.id, nextStatus);
      alert.toast(`Status akun ${u.email} berhasil diubah menjadi ${nextStatus}.`, 'success');
      fetchUsers();
    } catch (err: any) {
      alert.error('Gagal Mengubah Status Akun', err?.response?.data?.message || err.message);
    }
  };

  const handleTriggerResetPassword = async (u: User) => {
    if (currentUser?.id === u.id) {
      alert.info('Pengaturan Profil', 'Untuk mengubah kata sandi akun Anda sendiri, silakan gunakan menu Pengaturan Profil.');
      return;
    }
    const confirmed = await alert.confirm({
      title: 'Reset Kata Sandi Akun?',
      text: `Apakah Anda yakin ingin mereset kata sandi akun "${u.email}" (${u.role.toUpperCase()}) menjadi 6 angka baru?`,
      confirmButtonText: 'Ya, Reset Sandi',
      icon: 'warning',
    });
    if (!confirmed) return;

    try {
      const res = await userService.resetPassword(u.id);
      await alert.showCredential({
        title: 'Kata Sandi Berhasil Direset!',
        description: `Kata sandi baru untuk akun <strong>${u.email}</strong> telah berhasil dibuat:`,
        credentialLabel: 'KATA SANDI BARU (6 ANGKA)',
        credentialValue: res.new_password,
        extraNote: 'Harap berikan kata sandi baru ini kepada pemilik akun.',
      });
    } catch (err: any) {
      alert.error('Gagal Mereset Kata Sandi', err?.response?.data?.message || err.message);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) {
      alert.warning('Data Belum Lengkap', 'Alamat email administrator wajib diisi.');
      return;
    }
    setCreatingAdmin(true);
    try {
      const res = await userService.createAdmin(newAdminEmail.trim());
      setNewAdminEmail('');
      setAddAdminModalOpen(false);
      fetchUsers();

      if (res.initial_password) {
        await alert.showCredential({
          title: 'Administrator Berhasil Dibuat!',
          description: `Akun administrator baru untuk <strong>${res.user.email}</strong> telah terdaftar:`,
          credentialLabel: 'KATA SANDI AWAL (6 ANGKA)',
          credentialValue: res.initial_password,
          extraNote: 'Simpan kredensial ini dan berikan kepada administrator yang bersangkutan untuk login pertama.',
        });
      } else {
        alert.toast('Administrator baru berhasil didaftarkan!', 'success');
      }
    } catch (err: any) {
      alert.error('Gagal Menambahkan Administrator', err?.response?.data?.message || err.message);
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (currentUser?.id === u.id) {
      alert.warning('Aksi Ditolak', 'Anda tidak dapat menghapus akun Anda sendiri saat sedang aktif login.');
      return;
    }
    const confirmed = await alert.confirm({
      title: 'Hapus Akun Pengguna?',
      text: `Apakah Anda yakin ingin menghapus akun "${u.email}" (${u.role.toUpperCase()})? Seluruh sesi login pengguna akan langsung dicabut.${
        u.role === 'admin' ? ' (Proteksi INV-21: sistem akan menolak jika ini admin aktif terakhir).' : ''
      }`,
      confirmButtonText: 'Ya, Hapus Akun',
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      await userService.deleteUser(u.id);
      alert.toast(`Akun ${u.email} berhasil dihapus.`, 'success');
      fetchUsers();
    } catch (err: any) {
      alert.error('Gagal Menghapus Akun', err?.response?.data?.message || err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === 'all' || u.role.toLowerCase() === roleFilter.toLowerCase();
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">PENGGUNA SISTEM</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Pengguna Sistem
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Kelola akun administrator dan peserta ujian.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setAddAdminModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="text-xs"
        >
          Tambah Admin
        </Button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchUsers} />}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Cari pengguna"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-gray-400" />}
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full h-[46px] px-3.5 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none"
            title="Filter peran pengguna"
          >
            <option value="all">Semua Peran</option>
            <option value="admin">Administrator</option>
            <option value="mahasiswa">Mahasiswa</option>
            <option value="umum">Umum</option>
          </select>
        </div>

        <div className="w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-[46px] px-3.5 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none"
            title="Filter status akun"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="suspended">Nonaktif</option>
          </select>
        </div>
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
                  <th className="px-6 py-3.5">Peran</th>
                  <th className="px-6 py-3.5">Status Akun</th>
                  <th className="px-6 py-3.5">Terdaftar</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e1eb]">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#faf9fc]/80 transition">
                    <td className="px-6 py-4 font-bold text-[#24212b]">{u.email}</td>
                    <td className="px-6 py-4">
                      <Badge variant={u.role === 'admin' ? 'purple' : u.role === 'umum' ? 'info' : 'royal'}>
                        {u.role.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={u.status === 'active' ? 'success' : 'danger'}>
                        {u.status === 'active' ? 'AKTIF' : 'NONAKTIF'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleTriggerResetPassword(u)}
                          disabled={currentUser?.id === u.id}
                          className={`p-1.5 rounded transition ${
                            currentUser?.id === u.id
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-500 hover:text-[#583682] hover:bg-[#eae2f5] cursor-pointer'
                          }`}
                          title={currentUser?.id === u.id ? 'Ubah kata sandi via Pengaturan Profil' : 'Reset Kata Sandi'}
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={currentUser?.id === u.id}
                          className={`p-1.5 rounded transition ${
                            currentUser?.id === u.id
                              ? 'text-gray-300 cursor-not-allowed'
                              : u.status === 'active'
                              ? 'text-[#b63b48] hover:bg-[#fbeeed] cursor-pointer'
                              : 'text-[#287a58] hover:bg-[#eaf4ef] cursor-pointer'
                          }`}
                          title={
                            currentUser?.id === u.id
                              ? 'Tidak dapat menonaktifkan akun sendiri'
                              : u.status === 'active'
                              ? 'Nonaktifkan Akun'
                              : 'Aktifkan Akun'
                          }
                        >
                          {u.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={currentUser?.id === u.id}
                          className={`p-1.5 rounded transition ${
                            currentUser?.id === u.id
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-500 hover:text-[#b63b48] hover:bg-[#fbeeed] cursor-pointer'
                          }`}
                          title={
                            currentUser?.id === u.id
                              ? 'Tidak dapat menghapus akun sendiri'
                              : 'Hapus Akun'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Add Admin Modal */}
      <Modal
        isOpen={addAdminModalOpen}
        onClose={() => {
          setAddAdminModalOpen(false);
          setNewAdminEmail('');
        }}
        title="Tambah Admin Baru"
        description="Buat akun administrator baru untuk sistem CAT."
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAddAdminModalOpen(false);
                setNewAdminEmail('');
              }}
              className="text-xs"
            >
              Batal
            </Button>
            <Button type="submit" form="add-admin-form" variant="primary" isLoading={creatingAdmin} className="text-xs">
              Simpan Akun
            </Button>
          </div>
        }
      >
        <form id="add-admin-form" onSubmit={handleCreateAdmin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Email Administrator <span className="text-[#b63b48]">*</span>
            </label>
            <Input
              type="email"
              required
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="admin@fia.kampus.ac.id"
              helperText="Kata sandi sementara akan di-generate otomatis dan ditampilkan setelah akun dibuat."
            />
          </div>
        </form>
      </Modal>


    </div>
  );
};
