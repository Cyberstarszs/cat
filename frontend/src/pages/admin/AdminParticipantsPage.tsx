import React, { useEffect, useState } from 'react';
import { userService } from '../../services';
import { StudentProfile } from '../../types';
import { useToast } from '../../context/ToastContext';
import { alert } from '../../utils/alert';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import {
  Plus,
  Upload,
  User,
  Search,
  Download,
  CheckCircle2,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Filter,
  X,
  Edit2,
  Trash2,
  AlertTriangle,
  UserCheck,
  UserX,
} from 'lucide-react';

export const AdminParticipantsPage: React.FC = () => {
  const { showToast } = useToast();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'mahasiswa' | 'umum'>('all');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [institutionsList, setInstitutionsList] = useState<string[]>([]);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Add single student modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [role, setRole] = useState<'mahasiswa' | 'umum'>('mahasiswa');
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('ADMINISTRASI PUBLIK');
  const [phone, setPhone] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);
  const [createdPasswordNotice, setCreatedPasswordNotice] = useState<{ identifier: string; pass: string } | null>(null);

  // Edit single student modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeStudentForEdit, setActiveStudentForEdit] = useState<StudentProfile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editRole, setEditRole] = useState<'mahasiswa' | 'umum'>('mahasiswa');
  const [savingEdit, setSavingEdit] = useState(false);

  const generateUmumIdentifier = () => `UMUM-${Math.floor(100000 + Math.random() * 900000)}`;

  const resetAddForm = (targetRole: 'mahasiswa' | 'umum' = 'mahasiswa') => {
    setRole(targetRole);
    setIdentifier(targetRole === 'umum' ? generateUmumIdentifier() : '');
    setFullName('');
    setEmail('');
    setInstitution(targetRole === 'umum' ? 'Umum' : 'ADMINISTRASI PUBLIK');
    setPhone('');
  };

  const handleOpenAddModal = () => {
    resetAddForm('mahasiswa');
    setAddModalOpen(true);
  };

  const handleSwitchRole = (newRole: 'mahasiswa' | 'umum') => {
    setRole(newRole);
    if (newRole === 'umum') {
      if (!identifier.trim()) {
        setIdentifier(generateUmumIdentifier());
      }
      if (institution === 'ADMINISTRASI PUBLIK' || !institution.trim()) {
        setInstitution('Umum');
      }
    } else {
      if (identifier.startsWith('UMUM-')) {
        setIdentifier('');
      }
      if (institution === 'Umum' || !institution.trim()) {
        setInstitution('ADMINISTRASI PUBLIK');
      }
    }
  };

  const [copiedNotice, setCopiedNotice] = useState(false);

  // Import CSV modal & state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [downloadingCredentials, setDownloadingCredentials] = useState(false);
  const [importNotice, setImportNotice] = useState<{
    total_rows: number;
    imported_count: number;
    skipped_count: number;
    import_id?: string;
  } | null>(null);

  const handleDownloadCredentials = async (importId: string) => {
    setDownloadingCredentials(true);
    try {
      const blob = await userService.downloadImportCredentials(importId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Kredensial_Peserta_${importId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Berkas kredensial berhasil diunduh.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunduh berkas kredensial.', 'error');
    } finally {
      setDownloadingCredentials(false);
    }
  };

  const loadInstitutions = async () => {
    try {
      const data = await userService.getInstitutions();
      const defaults = ['ADMINISTRASI PUBLIK', 'Umum'];
      const merged = Array.from(new Set([...defaults, ...(data || [])])).filter(Boolean);
      setInstitutionsList(merged);
    } catch {
      setInstitutionsList(['ADMINISTRASI PUBLIK', 'Umum']);
    }
  };

  useEffect(() => {
    loadInstitutions();
  }, []);

  // Debounce search input by 350ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userService.getStudents({
        search: debouncedSearch.trim() || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        institution: institutionFilter !== 'all' ? institutionFilter : undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setStudents(res.data);
      setTotalStudents(res.meta?.total ?? res.data.length);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar peserta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, limit, debouncedSearch, roleFilter, institutionFilter]);

  const handleRoleFilterChange = (newRole: 'all' | 'mahasiswa' | 'umum') => {
    setRoleFilter(newRole);
    setPage(1);
  };

  const handleInstitutionFilterChange = (newInst: string) => {
    setInstitutionFilter(newInst);
    setPage(1);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setRoleFilter('all');
    setInstitutionFilter('all');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalStudents / limit));
  const fromIndex = totalStudents === 0 ? 0 : (page - 1) * limit + 1;
  const toIndex = Math.min(page * limit, totalStudents);
  const isFiltered = Boolean(search.trim() || roleFilter !== 'all' || institutionFilter !== 'all');

  const getPaginationPages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) {
        pages.push('...');
      }
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return pages;
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'mahasiswa' && !identifier.trim()) {
      showToast('NIM wajib diisi secara manual untuk peserta mahasiswa.', 'error');
      return;
    }
    if (!fullName.trim()) {
      showToast('Nama lengkap wajib diisi.', 'error');
      return;
    }
    if (!email.trim()) {
      showToast('Alamat email wajib diisi.', 'error');
      return;
    }

    setSavingStudent(true);
    try {
      const res = await userService.createStudent({
        role,
        identifier: identifier.trim() || undefined,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        institution: institution.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      showToast('Peserta berhasil didaftarkan!', 'success');
      setAddModalOpen(false);

      if (res.initial_password) {
        setCreatedPasswordNotice({
          identifier: res.student?.identifier || identifier.trim() || 'Peserta',
          pass: res.initial_password,
        });
        await alert.showCredential({
          title: 'Peserta Berhasil Didaftarkan!',
          description: `Akun atas nama <strong>${fullName.trim()}</strong> berhasil dibuat. Berikut kata sandi awal untuk peserta:`,
          credentialLabel: 'KATA SANDI AWAL (6 ANGKA)',
          credentialValue: res.initial_password,
          extraNote: `NIM / No Identitas: <strong>${res.student?.identifier || identifier.trim()}</strong>. Simpan dan serahkan ke peserta.`,
        });
      }

      resetAddForm('mahasiswa');
      fetchStudents();
      loadInstitutions();
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
      showToast(`Berhasil mengimpor ${res.imported_count} peserta baru!`, 'success');
      setImportModalOpen(false);
      setCsvFile(null);
      setImportNotice({
        total_rows: res.total_rows,
        imported_count: res.imported_count,
        skipped_count: res.skipped_count,
        import_id: res.import_id,
      });
      fetchStudents();
      loadInstitutions();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengimpor berkas CSV peserta.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      'identifier;full_name;email;institution;phone\n' +
      '20261001;Budi Santoso;budi@student.unira.ac.id;ADMINISTRASI PUBLIK;8123456789\n' +
      ';Siti Aminah;siti@gmail.com;Umum;\n' +
      '20261003;Ahmad Fauzi;ahmad@student.unira.ac.id;ADMINISTRASI PUBLIK;\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Template_Peserta_Ujian.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleTriggerResetPassword = async (st: StudentProfile) => {
    const confirmed = await alert.confirm({
      title: 'Reset Kata Sandi Peserta?',
      text: `Apakah Anda yakin ingin mereset kata sandi peserta "${st.full_name}" (${st.identifier}) menjadi format 6 angka acak baru?`,
      confirmButtonText: 'Ya, Reset Sandi',
      icon: 'warning',
    });
    if (!confirmed) return;

    try {
      const res = await userService.resetPassword(st.id);
      await alert.showCredential({
        title: 'Kata Sandi Berhasil Direset!',
        description: `Kata sandi baru untuk peserta <strong>${st.full_name}</strong> (${st.identifier}) telah digenerate:`,
        credentialLabel: 'KATA SANDI BARU (6 ANGKA)',
        credentialValue: res.new_password,
        extraNote: 'Harap berikan kata sandi ini kepada peserta untuk login ke ruang ujian.',
      });
    } catch (err: any) {
      alert.error('Gagal Mereset Kata Sandi', err?.response?.data?.message || err.message || 'Terjadi kesalahan sistem.');
    }
  };

  const handleCopyNoticePassword = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
      alert.toast('Kata sandi berhasil disalin!', 'success');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
      alert.toast('Kata sandi berhasil disalin!', 'success');
    }
  };

  const handleOpenEditModal = (st: StudentProfile) => {
    setActiveStudentForEdit(st);
    setEditFullName(st.full_name || '');
    setEditEmail(st.email || '');
    setEditInstitution(st.institution || (st.role === 'umum' ? 'Umum' : 'ADMINISTRASI PUBLIK'));
    setEditPhone(st.phone || '');
    setEditStatus(((st as any).status as any) || 'active');
    setEditRole((st.role as any) === 'umum' ? 'umum' : 'mahasiswa');
    setEditModalOpen(true);
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudentForEdit) return;
    if (!editFullName.trim()) {
      showToast('Nama lengkap wajib diisi.', 'error');
      return;
    }
    setSavingEdit(true);
    try {
      await userService.updateStudent(activeStudentForEdit.id, {
        full_name: editFullName.trim(),
        email: editEmail.trim() || undefined,
        institution: editInstitution.trim() || undefined,
        phone: editPhone.trim() || undefined,
        status: editStatus,
        role: editRole,
      });

      setStudents((prev) =>
        prev.map((s) =>
          s.id === activeStudentForEdit.id
            ? {
                ...s,
                full_name: editFullName.trim(),
                email: editEmail.trim(),
                institution: editInstitution.trim(),
                phone: editPhone.trim(),
                status: editStatus,
                role: editRole as any,
              }
            : s
        )
      );

      showToast('Data peserta berhasil diperbarui!', 'success');
      setEditModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui data peserta.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteStudent = async (st: StudentProfile) => {
    const confirmed = await alert.confirm({
      title: 'Hapus Peserta Ujian?',
      text: `Apakah Anda yakin ingin menghapus peserta "${st.full_name}" (${st.identifier})? Akun peserta akan dinonaktifkan dan sesi login aktif akan langsung dicabut.`,
      confirmButtonText: 'Ya, Hapus Peserta',
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      await userService.deleteStudent(st.id);
      setTotalStudents((prev) => Math.max(0, prev - 1));
      if (students.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        setStudents((prev) => prev.filter((s) => s.id !== st.id));
      }
      alert.toast(`Peserta ${st.full_name} berhasil dihapus.`, 'success');
    } catch (err: any) {
      alert.error('Gagal Menghapus Peserta', err?.response?.data?.message || err.message || 'Terjadi kesalahan sistem.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">DATA PESERTA</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Data Peserta Ujian
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Kelola data peserta ujian dan impor massal CSV.
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
            onClick={handleOpenAddModal}
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
        <div className="p-4 bg-[#eaf4ef] border border-[#bce2cf] rounded-[8px] flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-[#287a58] shrink-0" />
            <div>
              <div className="font-bold text-[#24212b]">Akun Peserta Berhasil Dibuat</div>
              <div className="text-[#595562] mt-1 flex flex-wrap items-center gap-2">
                <span>NIM / Identitas: <strong className="font-mono text-[#24212b]">{createdPasswordNotice.identifier}</strong> | Kata Sandi:</span>
                <strong className="font-mono text-[#287a58] bg-white px-2.5 py-0.5 rounded border border-[#bce2cf] tracking-wider">
                  {createdPasswordNotice.pass}
                </strong>
                <button
                  type="button"
                  onClick={() => handleCopyNoticePassword(createdPasswordNotice.pass)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition shadow-xs cursor-pointer ${
                    copiedNotice
                      ? 'bg-[#287a58] text-white hover:bg-[#1f5e44]'
                      : 'bg-[#583682] text-white hover:bg-[#352148]'
                  }`}
                  title="Salin Kata Sandi"
                >
                  {copiedNotice ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedNotice ? 'Tersalin!' : 'Salin'}</span>
                </button>
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

      {/* Notice popup after importing students via CSV */}
      {importNotice && (
        <div className="p-4 bg-[#eaf4ef] border border-[#bce2cf] rounded-[8px] flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#287a58] shrink-0" />
            <div>
              <div className="font-bold text-[#24212b]">
                Impor CSV Berhasil: {importNotice.imported_count} Peserta Ditambahkan
              </div>
              <div className="text-[#595562] mt-1 flex flex-wrap items-center gap-2">
                <span>
                  Total diproses: <strong>{importNotice.total_rows}</strong> baris
                  {importNotice.skipped_count > 0 && ` • Dilewati: ${importNotice.skipped_count} (sudah terdaftar)`}
                </span>
                {importNotice.import_id && (
                  <Button
                    variant="secondary"
                    onClick={() => handleDownloadCredentials(importNotice.import_id!)}
                    isLoading={downloadingCredentials}
                    leftIcon={<Download className="w-3.5 h-3.5 text-[#583682]" />}
                    className="text-xs h-[30px] ml-2"
                  >
                    Unduh Kredensial (.csv)
                  </Button>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setImportNotice(null)}
            className="text-xs text-gray-400 hover:text-gray-600 min-h-[30px]"
          >
            Tutup
          </Button>
        </div>
      )}

      {/* Search and Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#e6e1eb] shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Main search input */}
          <div className="lg:col-span-5 relative">
            <Input
              placeholder="Cari peserta"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-gray-400" />}
              className="pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                title="Hapus teks pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div className="lg:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => handleRoleFilterChange(e.target.value as any)}
              className="w-full min-h-[46px] px-3.5 bg-white border border-[#e6e1eb] focus:border-[#583682] rounded-[6px] text-xs font-medium text-[#24212b] outline-none transition cursor-pointer"
            >
              <option value="all">Semua Kategori</option>
              <option value="mahasiswa">Mahasiswa</option>
              <option value="umum">Umum</option>
            </select>
          </div>

          {/* Institution Filter */}
          <div className="lg:col-span-2">
            <select
              value={institutionFilter}
              onChange={(e) => handleInstitutionFilterChange(e.target.value)}
              className="w-full min-h-[46px] px-3.5 bg-white border border-[#e6e1eb] focus:border-[#583682] rounded-[6px] text-xs font-medium text-[#24212b] outline-none transition cursor-pointer"
            >
              <option value="all">Semua Instansi</option>
              {institutionsList.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          </div>

          {/* Items per page & Reset Button */}
          <div className="lg:col-span-2 flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="w-full min-h-[46px] px-3 bg-white border border-[#e6e1eb] focus:border-[#583682] rounded-[6px] text-xs font-medium text-[#24212b] outline-none transition cursor-pointer"
              title="Jumlah baris per halaman"
            >
              <option value={10}>10 / hal</option>
              <option value={25}>25 / hal</option>
              <option value={50}>50 / hal</option>
              <option value={100}>100 / hal</option>
            </select>

            {isFiltered && (
              <Button
                variant="secondary"
                onClick={handleResetFilters}
                className="min-h-[46px] px-3 text-xs shrink-0 text-[#b63b48] hover:bg-[#b63b48]/10 border-[#e6e1eb]"
                title="Reset semua filter"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Filter stats & Reset link */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#f2eff6] text-xs text-[#595562]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">
              Total: <strong className="text-[#24212b]">{totalStudents}</strong> peserta
            </span>
            {isFiltered && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eae2f5] text-[#583682] text-[11px] font-semibold">
                <Filter className="w-3 h-3" /> Filter Aktif
              </span>
            )}
          </div>

          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="text-[#583682] hover:underline font-medium text-[11px] inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <Card hasShadow className="overflow-hidden p-0">
        {loading ? (
          <div className="p-6">
            <CardSkeleton />
          </div>
        ) : students.length === 0 ? (
          <div className="p-8">
            {isFiltered ? (
              <EmptyState
                title="Tidak Ada Peserta yang Sesuai"
                description={`Tidak ditemukan peserta dengan filter saat ini.`}
                icon={<Search className="w-8 h-8 text-[#583682]" />}
                action={{
                  label: 'Reset Filter',
                  onClick: handleResetFilters,
                }}
              />
            ) : (
              <EmptyState
                title="Belum Ada Peserta"
                description="Daftarkan mahasiswa atau peserta umum untuk mulai mengikutsertakan mereka ke ujian."
                icon={<User className="w-8 h-8 text-[#583682]" />}
                action={{
                  label: 'Tambah Peserta Pertama',
                  onClick: handleOpenAddModal,
                }}
              />
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-3.5">Kategori</th>
                  <th className="px-6 py-3.5">NIM / No. Identitas</th>
                  <th className="px-6 py-3.5">Nama & Email</th>
                  <th className="px-6 py-3.5">Instansi</th>
                  <th className="px-6 py-3.5">Telepon</th>
                  <th className="px-6 py-3.5">Terdaftar</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e1eb]">
                {students.map((st) => (
                  <tr key={st.id} className="hover:bg-[#faf9fc]/80 transition">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={st.role === 'umum' ? 'info' : 'royal'}>
                          {st.role === 'umum' ? 'UMUM' : 'MAHASISWA'}
                        </Badge>
                        {((st as any).status === 'suspended') && (
                          <span className="text-[10px] font-bold text-[#b63b48] bg-[#fbeeed] px-1.5 py-0.2 rounded border border-[#b63b48]/30">
                            NONAKTIF
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-[#583682]">
                      <span className="bg-[#eae2f5] px-2 py-0.5 rounded">{st.identifier}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#24212b] text-sm">{st.full_name}</div>
                      {st.email && <div className="text-[11px] text-[#595562] font-mono mt-0.5">{st.email}</div>}
                    </td>
                    <td className="px-6 py-4 text-[#595562]">{st.institution || (st.role === 'umum' ? 'Umum' : 'ADMINISTRASI PUBLIK')}</td>
                    <td className="px-6 py-4 text-[#595562]">{st.phone || '-'}</td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(st.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(st)}
                          className="p-1.5 text-gray-500 hover:text-[#583682] hover:bg-[#eae2f5] rounded transition cursor-pointer"
                          title="Ubah data peserta"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleTriggerResetPassword(st)}
                          className="p-1.5 text-gray-500 hover:text-[#287a58] hover:bg-[#eaf4ef] rounded transition cursor-pointer"
                          title="Reset kata sandi (6 angka)"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(st)}
                          className="p-1.5 text-gray-500 hover:text-[#b63b48] hover:bg-[#fbeeed] rounded transition cursor-pointer"
                          title="Hapus peserta"
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

        {/* Pagination Footer */}
        {totalStudents > 0 && (
          <div className="px-6 py-4 bg-[#faf9fc] border-t border-[#e6e1eb] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#595562]">
              Menampilkan <span className="font-semibold text-[#24212b]">{fromIndex}</span> -{' '}
              <span className="font-semibold text-[#24212b]">{toIndex}</span> dari{' '}
              <span className="font-semibold text-[#24212b]">{totalStudents}</span> peserta
            </div>

            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {/* First Page */}
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="p-1.5 rounded border border-[#e6e1eb] bg-white text-[#595562] hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Prev Page */}
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-[#e6e1eb] bg-white text-[#595562] hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Numbers */}
              {getPaginationPages().map((pNum, idx) => {
                if (pNum === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-gray-400 font-semibold select-none">
                      ...
                    </span>
                  );
                }

                const isCurrent = pNum === page;
                return (
                  <button
                    key={`page-${pNum}`}
                    type="button"
                    onClick={() => setPage(Number(pNum))}
                    className={`min-w-[32px] h-[32px] px-2 rounded text-xs font-bold transition cursor-pointer ${
                      isCurrent
                        ? 'bg-[#583682] text-white shadow-xs'
                        : 'border border-[#e6e1eb] bg-white text-[#595562] hover:bg-[#eae2f5]/50 hover:text-[#583682]'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}

              {/* Next Page */}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded border border-[#e6e1eb] bg-white text-[#595562] hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Last Page */}
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="p-1.5 rounded border border-[#e6e1eb] bg-white text-[#595562] hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Student Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Tambah Peserta Baru"
        description="Pilih kategori peserta dan isi data pendaftaran."
        maxWidth="xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAddModalOpen(false);
                resetAddForm('mahasiswa');
              }}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="add-student-form"
              variant="primary"
              isLoading={savingStudent}
              leftIcon={<Plus className="w-4 h-4" />}
              className="text-xs"
            >
              Simpan Akun
            </Button>
          </div>
        }
      >
        <form id="add-student-form" onSubmit={handleAddStudent} className="space-y-4">
          {/* Role selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#24212b]">
              Kategori Peserta <span className="text-[#b63b48]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSwitchRole('mahasiswa')}
                className={`p-3 rounded-lg border text-left flex items-start justify-between transition cursor-pointer ${
                  role === 'mahasiswa'
                    ? 'border-[#583682] bg-[#f6f2fa] ring-1 ring-[#583682]'
                    : 'border-[#e6e1eb] bg-white hover:border-[#cfc2df]'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-[#24212b]">Mahasiswa</div>
                  <div className="text-[11px] text-[#595562] mt-0.5">Wajib isi NIM manual</div>
                </div>
                {role === 'mahasiswa' && (
                  <span className="p-0.5 bg-[#583682] text-white rounded-full">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSwitchRole('umum')}
                className={`p-3 rounded-lg border text-left flex items-start justify-between transition cursor-pointer ${
                  role === 'umum'
                    ? 'border-[#583682] bg-[#f6f2fa] ring-1 ring-[#583682]'
                    : 'border-[#e6e1eb] bg-white hover:border-[#cfc2df]'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-[#24212b]">Umum</div>
                  <div className="text-[11px] text-[#595562] mt-0.5">Nomor otomatis</div>
                </div>
                {role === 'umum' && (
                  <span className="p-0.5 bg-[#583682] text-white rounded-full">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Identifier input */}
          {role === 'mahasiswa' ? (
            <div>
              <Input
                label="NIM (Nomor Induk Mahasiswa)"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="NIM peserta"
                className="font-mono"
              />
            </div>
          ) : (
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="Nomor Peserta (Opsional)"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Nomor peserta (opsional)"
                    className="font-mono bg-[#faf9fc]"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIdentifier(generateUmumIdentifier())}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  className="text-xs h-[42px] shrink-0"
                  title="Buat nomor acak baru"
                >
                  Acak
                </Button>
              </div>
            </div>
          )}

          <Input
            label="Nama Lengkap"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nama lengkap"
          />

          <Input
            type="email"
            label="Alamat Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Instansi / Prodi"
                required
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Prodi atau instansi"
              />
            </div>
            <div>
              <Input
                label="Nomor Telepon (Opsional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nomor telepon"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setCsvFile(null);
        }}
        title="Impor Peserta CSV"
        description="Unggah berkas CSV untuk mendaftarkan peserta secara massal."
        maxWidth="xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setImportModalOpen(false);
                setCsvFile(null);
              }}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="import-csv-form"
              variant="primary"
              isLoading={importing}
              disabled={!csvFile}
              leftIcon={<Upload className="w-4 h-4" />}
              className="text-xs"
            >
              Impor Sekarang
            </Button>
          </div>
        }
      >
        <form id="import-csv-form" onSubmit={handleImportCSV} className="space-y-4">
          {/* Rules / guidance box */}
          <div className="p-3 bg-[#f6f2fa] border border-[#cfc2df] rounded text-xs space-y-1.5">
            <div className="font-bold text-[#583682] flex items-center gap-1.5">
              <Info className="w-4 h-4 shrink-0" />
              <span>Petunjuk Format CSV:</span>
            </div>
            <ul className="text-[11px] text-[#595562] space-y-0.5 list-disc pl-4">
              <li>Header kolom: <strong className="font-mono text-[#24212b]">identifier, full_name, email, institution, phone</strong></li>
              <li>Pemisah kolom: Mendukung koma (,) atau titik koma (;).</li>
              <li>Mahasiswa wajib isi NIM. Peserta Umum nomor dibuat otomatis bila kosong.</li>
            </ul>
          </div>

          <div className="flex justify-between items-center pt-1 pb-1">
            <span className="text-xs text-[#595562]">Template berkas:</span>
            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="text-xs text-[#583682] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Unduh Template CSV
            </button>
          </div>

          <div className="border-2 border-dashed border-[#cfc2df] hover:border-[#583682] rounded p-6 text-center bg-[#faf9fc] transition">
            <input
              type="file"
              id="csv-file-input"
              accept=".csv"
              required
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setCsvFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer block">
              <Upload className="w-8 h-8 text-[#583682] mx-auto mb-2 opacity-80" />
              {csvFile ? (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#24212b]">{csvFile.name}</p>
                  <p className="text-[11px] text-[#595562]">{(csvFile.size / 1024).toFixed(1)} KB — Klik untuk ganti</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#24212b]">Pilih atau tarik berkas CSV ke sini</p>
                  <p className="text-[11px] text-[#595562]">Format .csv pemisah koma (,) atau titik koma (;)</p>
                </div>
              )}
            </label>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Ubah Data Peserta"
        description={`Mengubah data peserta: ${activeStudentForEdit?.full_name} (${activeStudentForEdit?.identifier})`}
        maxWidth="xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="ghost" onClick={() => setEditModalOpen(false)} className="text-xs">
              Batal
            </Button>
            <Button
              type="submit"
              form="edit-student-form"
              variant="primary"
              isLoading={savingEdit}
              className="text-xs"
            >
              Simpan Perubahan
            </Button>
          </div>
        }
      >
        <form id="edit-student-form" onSubmit={handleSaveEditStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Nomor Identitas / NIM
            </label>
            <Input
              value={activeStudentForEdit?.identifier || ''}
              disabled
              className="bg-gray-100 font-mono text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Kategori Peserta <span className="text-[#b63b48]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditRole('mahasiswa')}
                className={`p-2.5 rounded border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  editRole === 'mahasiswa'
                    ? 'bg-[#eae2f5] border-[#583682] text-[#583682]'
                    : 'bg-white border-[#e6e1eb] text-[#595562] hover:bg-gray-50'
                }`}
              >
                Mahasiswa
              </button>
              <button
                type="button"
                onClick={() => setEditRole('umum')}
                className={`p-2.5 rounded border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  editRole === 'umum'
                    ? 'bg-[#eae2f5] border-[#583682] text-[#583682]'
                    : 'bg-white border-[#e6e1eb] text-[#595562] hover:bg-gray-50'
                }`}
              >
                Umum
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Nama Lengkap <span className="text-[#b63b48]">*</span>
            </label>
            <Input
              required
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              placeholder="Nama lengkap"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Alamat Email
            </label>
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="Email"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#24212b] mb-1">
                Instansi / Prodi
              </label>
              <Input
                value={editInstitution}
                onChange={(e) => setEditInstitution(e.target.value)}
                placeholder="Prodi atau instansi"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24212b] mb-1">
                Nomor Telepon
              </label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Nomor telepon"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Status Akun
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditStatus('active')}
                className={`p-2.5 rounded border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  editStatus === 'active'
                    ? 'bg-[#eaf4ef] border-[#287a58] text-[#287a58]'
                    : 'bg-white border-[#e6e1eb] text-[#595562] hover:bg-gray-50'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Aktif</span>
              </button>
              <button
                type="button"
                onClick={() => setEditStatus('suspended')}
                className={`p-2.5 rounded border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  editStatus === 'suspended'
                    ? 'bg-[#fbeeed] border-[#b63b48] text-[#b63b48]'
                    : 'bg-white border-[#e6e1eb] text-[#595562] hover:bg-gray-50'
                }`}
              >
                <UserX className="w-4 h-4" />
                <span>Nonaktif</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

    </div>
  );
};
