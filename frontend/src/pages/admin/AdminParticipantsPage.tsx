import React, { useEffect, useState } from 'react';
import { userService } from '../../services';
import { StudentProfile } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import { Plus, Upload, User, Search, Download, CheckCircle2, KeyRound } from 'lucide-react';

export const AdminParticipantsPage: React.FC = () => {
  const { showToast } = useToast();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Add single student modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [phone, setPhone] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);
  const [createdPasswordNotice, setCreatedPasswordNotice] = useState<{ identifier: string; pass: string } | null>(null);

  // Import CSV modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getStudents();
      setStudents(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar peserta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStudent(true);
    try {
      const res = await userService.createStudent({
        identifier: identifier.trim(),
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        institution: institution.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      showToast('Peserta berhasil didaftarkan!', 'success');
      setAddModalOpen(false);

      if (res.initial_password) {
        setCreatedPasswordNotice({
          identifier: identifier.trim(),
          pass: res.initial_password,
        });
      }

      fetchStudents();
    } catch (err: any) {
      showToast(err.message || 'Gagal mendaftarkan peserta.', 'error');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setImporting(true);
    try {
      const res = await userService.importStudentsCSV(csvFile);
      showToast(`Berhasil mengimpor ${res.imported_count || 'sejumlah'} peserta baru!`, 'success');
      setImportModalOpen(false);
      setCsvFile(null);
      fetchStudents();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengimpor berkas CSV peserta.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      'identifier,full_name,email,institution,phone\n' +
      '20261001,"Budi Santoso",budi@fia.kampus.ac.id,"FIA UNIRA",08123456789\n' +
      '20261002,"Siti Aminah",siti@fia.kampus.ac.id,"FIA UNIRA",08123456780\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Template_Peserta_FIA.csv';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const filteredStudents = students.filter(
    (s) =>
      s.identifier.toLowerCase().includes(search.toLowerCase()) ||
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.institution && s.institution.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">DATA PESERTA UJIAN</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Pendaftaran & Manajemen Mahasiswa
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Daftarkan peserta secara tunggal atau impor massal melalui file CSV untuk dialokasikan ke sesi ujian.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setImportModalOpen(true)}
            leftIcon={<Upload className="w-4 h-4" />}
            className="text-xs"
          >
            Impor CSV
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setIdentifier(`FIA-${Date.now().toString().slice(-4)}`);
              setFullName('');
              setEmail('');
              setInstitution('FIA UNIRA');
              setPhone('');
              setAddModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
            className="text-xs"
          >
            Tambah Peserta
          </Button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchStudents} />}

      {/* Notice popup after adding a student with initial password */}
      {createdPasswordNotice && (
        <div className="p-4 bg-[#eaf4ef] border border-[#bce2cf] rounded-[8px] flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-[#287a58] shrink-0" />
            <div>
              <div className="font-bold text-[#24212b]">Akun Peserta Berhasil Dibuat!</div>
              <div className="text-[#595562] mt-0.5">
                NIM / Identitas: <strong className="font-mono text-[#24212b]">{createdPasswordNotice.identifier}</strong> | Kata Sandi Awal:{' '}
                <strong className="font-mono text-[#287a58] bg-white px-2 py-0.5 rounded border border-[#bce2cf]">
                  {createdPasswordNotice.pass}
                </strong>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setCreatedPasswordNotice(null)}
            className="text-xs text-gray-400 hover:text-gray-600 min-h-[30px]"
          >
            Tutup
          </Button>
        </div>
      )}

      {/* Search Input */}
      <div className="max-w-md">
        <Input
          placeholder="Cari NIM, nama, atau instansi peserta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-gray-400" />}
        />
      </div>

      {/* Table Card */}
      <Card hasShadow className="overflow-hidden p-0">
        {loading ? (
          <div className="p-6">
            <CardSkeleton />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Belum Ada Peserta Terdaftar"
              description="Daftarkan mahasiswa atau peserta eksternal untuk mulai mengikutsertakan mereka ke dalam sesi CAT."
              icon={<User className="w-8 h-8 text-[#583682]" />}
              action={{
                label: 'Tambah Peserta Pertama',
                onClick: () => setAddModalOpen(true),
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-3.5">NIM / Nomor Identitas</th>
                  <th className="px-6 py-3.5">Nama Lengkap</th>
                  <th className="px-6 py-3.5">Instansi</th>
                  <th className="px-6 py-3.5">Telepon</th>
                  <th className="px-6 py-3.5">Terdaftar Pada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e1eb]">
                {filteredStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-[#faf9fc]/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-[#583682]">
                      <span className="bg-[#eae2f5] px-2 py-0.5 rounded">{st.identifier}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#24212b] text-sm">{st.full_name}</td>
                    <td className="px-6 py-4 text-[#595562]">{st.institution || 'Umum'}</td>
                    <td className="px-6 py-4 text-[#595562]">{st.phone || '-'}</td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(st.created_at).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Student Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Daftarkan Peserta Ujian Baru"
        description="Sistem akan otomatis meng-generate akun login dan kata sandi sementara."
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          <Input
            label="Nomor Identitas (NIM / No. Peserta)"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Contoh: 20261001"
            className="font-mono"
          />

          <Input
            label="Nama Lengkap"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Contoh: Budi Santoso"
          />

          <Input
            type="email"
            label="Alamat Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="budi@fia.kampus.ac.id"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Instansi / Asal"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="FIA UNIRA atau Umum"
            />
            <Input
              label="Nomor Telepon"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08123456789"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button type="button" variant="ghost" onClick={() => setAddModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={savingStudent}>
              Simpan & Terbitkan Akun
            </Button>
          </div>
        </form>
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Impor Massal Peserta CSV"
        description="Unggah file .CSV berisi daftar peserta."
      >
        <form onSubmit={handleImportCSV} className="space-y-4">
          <div className="flex justify-between items-center pb-2">
            <span className="text-xs text-[#595562]">Gunakan template resmi:</span>
            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="text-xs text-[#583682] hover:underline font-bold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Unduh Template CSV
            </button>
          </div>

          <div className="border-2 border-dashed border-[#cfc2df] rounded p-6 text-center">
            <input
              type="file"
              accept=".csv"
              required
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setCsvFile(e.target.files[0]);
                }
              }}
              className="text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button type="button" variant="ghost" onClick={() => setImportModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={importing} disabled={!csvFile}>
              Impor Sekarang
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
