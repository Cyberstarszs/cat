import React, { useEffect, useState } from 'react';
import { sessionService, examService, reportService } from '../../services';
import { ExamSession, Exam, SessionEnrollment } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton, Skeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import {
  Plus,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Download,
  AlertTriangle,
  UserPlus,
  Search,
} from 'lucide-react';

export const AdminSchedulesPage: React.FC = () => {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Create Session Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  // Enroll Participants Modal (FR-S04)
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [activeSessionForEnroll, setActiveSessionForEnroll] = useState<ExamSession | null>(null);
  const [identifiersText, setIdentifiersText] = useState('');
  const [enrollPreview, setEnrollPreview] = useState<any>(null);
  const [previewingEnroll, setPreviewingEnroll] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  // View Enrollments Modal
  const [viewEnrollmentsModalOpen, setViewEnrollmentsModalOpen] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState<SessionEnrollment[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);

  const fetchSessionsAndExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsData, examsData] = await Promise.all([
        sessionService.getSessions(),
        examService.getExams(),
      ]);
      setSessions(sessionsData);
      setExams(examsData);
      if (examsData.length > 0 && !selectedExamId) {
        setSelectedExamId(examsData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat jadwal sesi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionsAndExams();
  }, []);

  const openCreateModal = () => {
    setSessionCode(`SES-${Date.now().toString().slice(-4)}`);
    setSessionName('');
    const now = new Date();
    const startStr = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
    const endStr = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
    setStartsAt(startStr);
    setEndsAt(endStr);
    setCreateModalOpen(true);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) {
      showToast('Pilih ujian terlebih dahulu.', 'error');
      return;
    }
    setSavingSession(true);
    try {
      await sessionService.createSession({
        exam_id: selectedExamId,
        code: sessionCode.trim().toUpperCase(),
        name: sessionName.trim(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      });
      showToast('Sesi ujian baru berhasil dijadwalkan!', 'success');
      setCreateModalOpen(false);
      fetchSessionsAndExams();
    } catch (err: any) {
      showToast(err.message || 'Gagal menjadwalkan sesi ujian.', 'error');
    } finally {
      setSavingSession(false);
    }
  };

  const openEnrollModal = (sess: ExamSession) => {
    setActiveSessionForEnroll(sess);
    setIdentifiersText('');
    setEnrollPreview(null);
    setEnrollModalOpen(true);
  };

  const handlePreviewEnrollment = async () => {
    if (!activeSessionForEnroll || !identifiersText.trim()) return;
    setPreviewingEnroll(true);
    const list = identifiersText
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const data = await sessionService.previewEnrollments(activeSessionForEnroll.id, list);
      setEnrollPreview(data);
      showToast(`Pratinjau: ${data.valid_count || list.length} siap didaftarkan.`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal memeriksa tabrakan jadwal peserta.', 'error');
    } finally {
      setPreviewingEnroll(false);
    }
  };

  const handleCommitEnrollment = async () => {
    if (!activeSessionForEnroll || !identifiersText.trim()) return;
    setEnrolling(true);
    const list = identifiersText
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await sessionService.enrollStudents(activeSessionForEnroll.id, list);
      showToast(`Berhasil mendaftarkan ${res.enrolled || list.length} peserta ke sesi ini!`, 'success');
      setEnrollModalOpen(false);
      fetchSessionsAndExams();
    } catch (err: any) {
      showToast(err.message || 'Gagal mendaftarkan peserta.', 'error');
    } finally {
      setEnrolling(false);
    }
  };

  const openViewEnrollments = async (sess: ExamSession) => {
    setActiveSessionForEnroll(sess);
    setViewEnrollmentsModalOpen(true);
    setLoadingEnrollments(true);
    try {
      const list = await sessionService.getEnrollments(sess.id);
      setEnrolledStudents(list);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat peserta terdaftar.', 'error');
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const handleFinalizeSession = async (sess: ExamSession) => {
    if (!confirm(`Apakah Anda yakin ingin memfinalisasi sesi "${sess.name}"? Seluruh pengerjaan akan dinilai dan sesi ditutup.`)) {
      return;
    }
    try {
      await sessionService.finalizeSession(sess.id);
      showToast('Sesi berhasil difinalisasi dan seluruh attempt telah dinilai!', 'success');
      fetchSessionsAndExams();
    } catch (err: any) {
      showToast(err.message || 'Gagal memfinalisasi sesi.', 'error');
    }
  };

  const handleExportCSV = async (sess: ExamSession) => {
    try {
      const blob = await reportService.exportSessionCSV(sess.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Laporan_Sesi_${sess.code}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Laporan CSV sesi berhasil diunduh!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengekspor laporan CSV.', 'error');
    }
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.exam_title && s.exam_title.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">MANAJEMEN SESI & JADWAL</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Jadwal Sesi Ujian Kompetensi
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Atur rentang waktu pengerjaan, daftarkan peserta teralokasi (FR-S04), dan finalisasi penilaian sesi.
          </p>
        </div>

        <Button variant="primary" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
          Buka Sesi Ujian Baru
        </Button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchSessionsAndExams} />}

      <div className="max-w-md">
        <Input
          placeholder="Cari kode atau nama sesi..."
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
        ) : filteredSessions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Belum Ada Sesi Ujian"
              description="Buka sesi baru untuk mulai mengizinkan mahasiswa terdaftar mengakses CAT."
              icon={<Calendar className="w-8 h-8 text-[#583682]" />}
              action={{ label: 'Buka Sesi Baru', onClick: openCreateModal }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-3.5">Kode Sesi</th>
                  <th className="px-6 py-3.5">Nama Sesi & Ujian</th>
                  <th className="px-6 py-3.5">Waktu Mulai</th>
                  <th className="px-6 py-3.5">Waktu Selesai</th>
                  <th className="px-6 py-3.5">Peserta</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e1eb]">
                {filteredSessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-[#faf9fc]/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-[#583682]">
                      <span className="bg-[#eae2f5] px-2 py-0.5 rounded">{sess.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#24212b] text-sm">{sess.name}</div>
                      <div className="text-[11px] text-[#595562] mt-0.5">
                        {sess.exam_title || 'Ujian Kompetensi FIA'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#595562]">
                      {new Date(sess.starts_at).toLocaleString('id-ID', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-6 py-4 text-[#595562]">
                      {new Date(sess.ends_at).toLocaleString('id-ID', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openViewEnrollments(sess)}
                        className="text-[#583682] hover:underline font-bold flex items-center gap-1"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>{sess.enrolled_count || 0} Terdaftar</span>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          sess.status === 'active'
                            ? 'success'
                            : sess.status === 'completed'
                            ? 'neutral'
                            : 'purple'
                        }
                      >
                        {sess.status === 'active'
                          ? 'SEDANG BERJALAN'
                          : sess.status === 'completed'
                          ? 'SELESAI'
                          : 'TERJADWAL'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEnrollModal(sess)}
                          className="p-1.5 text-[#583682] hover:bg-[#eae2f5] rounded transition"
                          title="Daftarkan Peserta (FR-S04)"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportCSV(sess)}
                          className="p-1.5 text-gray-500 hover:text-[#583682] hover:bg-[#faf9fc] rounded transition"
                          title="Unduh Laporan CSV"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {sess.status !== 'completed' && (
                          <button
                            onClick={() => handleFinalizeSession(sess)}
                            className="p-1.5 text-[#287a58] hover:bg-[#eaf4ef] rounded transition"
                            title="Finalisasi & Nilai Sesi"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Session Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Jadwalkan Sesi Ujian Baru"
        description="Tentukan paket ujian, kode sesi, dan rentang waktu akses."
      >
        <form onSubmit={handleSaveSession} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Pilih Paket Ujian <span className="text-[#b63b48]">*</span>
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b]"
              required
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.code}) - {ex.duration_minutes} Menit
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Kode Sesi"
              required
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              placeholder="Contoh: SES-01"
              className="font-mono uppercase"
            />
            <Input
              label="Nama Sesi"
              required
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Contoh: Sesi Pagi Gelombang 1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="Waktu Mulai"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <Input
              type="datetime-local"
              label="Waktu Selesai"
              required
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={savingSession}>
              Simpan Jadwal Sesi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Enroll Participants Modal (FR-S04 with Collision Preview) */}
      <Modal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        title={`Daftarkan Peserta: ${activeSessionForEnroll?.name}`}
        description="Masukkan daftar Nomor Identitas (NIM) peserta yang dialokasikan ke sesi ini."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#24212b] mb-1.5">
              Daftar NIM / Nomor Identitas (Satu per baris atau dipisahkan koma)
            </label>
            <textarea
              rows={4}
              value={identifiersText}
              onChange={(e) => setIdentifiersText(e.target.value)}
              placeholder="20261001&#10;20261002&#10;20261003"
              className="w-full p-3 font-mono text-xs bg-white border border-[#e6e1eb] rounded outline-none focus:border-[#583682]"
            />
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={handlePreviewEnrollment}
              isLoading={previewingEnroll}
              className="text-xs min-h-[34px] px-3"
            >
              Periksa Tabrakan Jadwal (Preview)
            </Button>

            <Button
              type="button"
              variant="primary"
              onClick={handleCommitEnrollment}
              isLoading={enrolling}
              className="text-xs min-h-[34px] px-3"
            >
              Konfirmasi Pendaftaran
            </Button>
          </div>

          {/* Collision Preview Results */}
          {enrollPreview && (
            <div className="p-3 bg-[#faf9fc] rounded border border-[#e6e1eb] text-xs space-y-2">
              <div className="font-bold text-[#24212b]">
                Hasil Pemeriksaan Jadwal (INV-09):
              </div>
              <div className="flex gap-4">
                <span className="text-[#287a58] font-semibold">
                  Siap Didaftarkan: {enrollPreview.valid_count || 0}
                </span>
                <span className="text-[#b63b48] font-semibold">
                  Tumpang Tindih / Tidak Valid: {enrollPreview.skipped_count || 0}
                </span>
              </div>
              {enrollPreview.skipped && enrollPreview.skipped.length > 0 && (
                <div className="mt-2 space-y-1 text-[11px] text-[#b63b48]">
                  {enrollPreview.skipped.map((s: any, idx: number) => (
                    <div key={idx}>
                      • {s.identifier}: {s.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* View Enrolled Students Modal */}
      <Modal
        isOpen={viewEnrollmentsModalOpen}
        onClose={() => setViewEnrollmentsModalOpen(false)}
        title={`Daftar Peserta: ${activeSessionForEnroll?.name}`}
        maxWidth="xl"
      >
        <div className="space-y-4">
          {loadingEnrollments ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : enrolledStudents.length === 0 ? (
            <p className="text-xs text-[#595562] text-center py-6">
              Belum ada peserta yang didaftarkan ke sesi ini.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[360px] no-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] font-bold">
                  <tr>
                    <th className="p-3">NIM / Identitas</th>
                    <th className="p-3">Nama Lengkap</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Status Ujian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e1eb]">
                  {enrolledStudents.map((st) => (
                    <tr key={st.id} className="hover:bg-[#faf9fc]">
                      <td className="p-3 font-mono font-bold text-[#583682]">{st.identifier}</td>
                      <td className="p-3 font-semibold text-[#24212b]">{st.full_name}</td>
                      <td className="p-3 text-[#595562]">{st.email}</td>
                      <td className="p-3">
                        <Badge variant={st.attempt_status === 'submitted' ? 'success' : 'neutral'}>
                          {st.attempt_status || 'Belum Mengambil'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-[#e6e1eb]">
            <Button variant="ghost" onClick={() => setViewEnrollmentsModalOpen(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
