import React, { useEffect, useState } from 'react';
import { sessionService, examService, reportService, questionService } from '../../services';
import { ExamSession, Exam, SessionEnrollment, CandidateResponse, CandidateStudent } from '../../types';
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
  Edit2,
  Sparkles,
  CheckSquare,
  Square,
  Scissors,
  Copy,
  Info,
  Filter,
  RefreshCw,
} from 'lucide-react';

export const AdminSchedulesPage: React.FC = () => {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [availableQuestionYears, setAvailableQuestionYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Create Session Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedQuestionYear, setSelectedQuestionYear] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [sessionCapacity, setSessionCapacity] = useState('27');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  // Edit Session Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ExamSession | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [editSessionCapacity, setEditSessionCapacity] = useState('27');
  const [editQuestionYear, setEditQuestionYear] = useState('');
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editEndsAt, setEditEndsAt] = useState('');
  const [savingEditSession, setSavingEditSession] = useState(false);

  // Enroll Participants Modal (FR-S04)
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [activeSessionForEnroll, setActiveSessionForEnroll] = useState<ExamSession | null>(null);
  const [enrollMode, setEnrollMode] = useState<'candidate_list' | 'manual_input'>('candidate_list');
  const [candidateData, setCandidateData] = useState<CandidateResponse | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateFilter, setCandidateFilter] = useState<'available' | 'all' | 'other_session'>('available');
  const [selectedIdentifiers, setSelectedIdentifiers] = useState<string[]>([]);
  const [identifiersText, setIdentifiersText] = useState('');
  const [remainingExcessNIMs, setRemainingExcessNIMs] = useState<string[]>([]);
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
      const [sessionsData, examsData, yearsData] = await Promise.all([
        sessionService.getSessions(),
        examService.getExams(),
        questionService.getQuestionYears().catch(() => []),
      ]);
      setSessions(sessionsData);
      setExams(examsData);
      const distinctYears = Array.from(
        new Set([
          ...(yearsData || []),
          new Date().getFullYear(),
        ])
      ).sort((a, b) => b - a);
      setAvailableQuestionYears(distinctYears);
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
    setSessionCapacity('27');
    setSelectedQuestionYear('');
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
        capacity: sessionCapacity ? parseInt(sessionCapacity, 10) : 27,
        question_year: selectedQuestionYear ? parseInt(selectedQuestionYear, 10) : null,
      });
      showToast('Sesi ujian baru berhasil dijadwalkan (Kapasitas: ' + (sessionCapacity || 27) + ' peserta)!', 'success');
      setCreateModalOpen(false);
      fetchSessionsAndExams();
    } catch (err: any) {
      showToast(err.message || 'Gagal menjadwalkan sesi ujian.', 'error');
    } finally {
      setSavingSession(false);
    }
  };

  const openEditModal = (sess: ExamSession) => {
    setEditingSession(sess);
    setEditSessionName(sess.name);
    setEditSessionCapacity(sess.capacity ? sess.capacity.toString() : '27');
    setEditQuestionYear(sess.question_year ? sess.question_year.toString() : '');
    const startStr = new Date(sess.starts_at).toISOString().slice(0, 16);
    const endStr = new Date(sess.ends_at).toISOString().slice(0, 16);
    setEditStartsAt(startStr);
    setEditEndsAt(endStr);
    setEditModalOpen(true);
  };

  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    setSavingEditSession(true);
    try {
      await sessionService.updateSession(editingSession.id, {
        name: editSessionName.trim(),
        starts_at: new Date(editStartsAt).toISOString(),
        ends_at: new Date(editEndsAt).toISOString(),
        capacity: editSessionCapacity ? parseInt(editSessionCapacity, 10) : 27,
        question_year: editQuestionYear ? parseInt(editQuestionYear, 10) : null,
      });
      showToast('Pengaturan sesi ujian berhasil diperbarui!', 'success');
      setEditModalOpen(false);
      fetchSessionsAndExams();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui pengaturan sesi ujian.', 'error');
    } finally {
      setSavingEditSession(false);
    }
  };

  const fetchCandidatesForSession = async (sessionId: string) => {
    setLoadingCandidates(true);
    try {
      const data = await sessionService.getCandidates(sessionId);
      setCandidateData(data);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat kandidat mahasiswa.', 'error');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const openEnrollModal = (sess: ExamSession) => {
    setActiveSessionForEnroll(sess);
    setEnrollMode('candidate_list');
    setIdentifiersText('');
    setRemainingExcessNIMs([]);
    setSelectedIdentifiers([]);
    setCandidateSearch('');
    setCandidateFilter('available');
    setEnrollPreview(null);
    setEnrollModalOpen(true);
    fetchCandidatesForSession(sess.id);
  };

  const handleAutoSelectCandidates = () => {
    if (!candidateData) return;
    const remainingSlots = candidateData.session.remaining_slots;
    if (remainingSlots <= 0) {
      showToast('Kapasitas sesi sudah penuh (maksimal 27).', 'warning');
      return;
    }
    const available = candidateData.candidates.filter((c) => c.status === 'available');
    if (available.length === 0) {
      showToast('Tidak ada mahasiswa belum terjadwal yang siap dialokasikan.', 'info');
      return;
    }
    const toPick = available.slice(0, remainingSlots).map((c) => c.identifier);
    setSelectedIdentifiers(toPick);
    showToast(`Otomatis memilih ${toPick.length} mahasiswa pertama yang belum terjadwal!`, 'success');
  };

  const toggleSelectCandidate = (identifier: string) => {
    if (!candidateData) return;
    const remainingSlots = candidateData.session.remaining_slots;

    if (selectedIdentifiers.includes(identifier)) {
      setSelectedIdentifiers(selectedIdentifiers.filter((id) => id !== identifier));
    } else {
      if (selectedIdentifiers.length >= remainingSlots) {
        showToast(`Batas maksimal kuota sesi (${remainingSlots} peserta tersisa) telah tercapai!`, 'warning');
        return;
      }
      setSelectedIdentifiers([...selectedIdentifiers, identifier]);
    }
  };

  const handleClearSelectedCandidates = () => {
    setSelectedIdentifiers([]);
    showToast('Pilihan peserta dibatalkan.', 'info');
  };

  const handleSplitManualNIMs = () => {
    const list = identifiersText
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const remainingSlots = candidateData?.session?.remaining_slots ?? (activeSessionForEnroll?.capacity || 27);
    const firstPart = list.slice(0, remainingSlots);
    const excessPart = list.slice(remainingSlots);
    setIdentifiersText(firstPart.join('\n'));
    setRemainingExcessNIMs(excessPart);
    showToast(`${firstPart.length} NIM dimasukkan ke sesi ini. ${excessPart.length} sisa NIM disiapkan untuk sesi lain.`, 'info');
  };

  const handleCopyExcessNIMs = () => {
    if (remainingExcessNIMs.length === 0) return;
    navigator.clipboard.writeText(remainingExcessNIMs.join('\n'));
    showToast(`${remainingExcessNIMs.length} NIM berhasil disalin ke clipboard!`, 'success');
  };

  const getActiveIdentifiers = (): string[] => {
    if (enrollMode === 'candidate_list') {
      return selectedIdentifiers;
    }
    return identifiersText
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const handlePreviewEnrollment = async () => {
    if (!activeSessionForEnroll) return;
    const list = getActiveIdentifiers();
    if (list.length === 0) {
      showToast('Pilih atau masukkan minimal 1 NIM peserta terlebih dahulu.', 'warning');
      return;
    }
    setPreviewingEnroll(true);
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
    if (!activeSessionForEnroll) return;
    const list = getActiveIdentifiers();
    if (list.length === 0) {
      showToast('Pilih atau masukkan minimal 1 NIM peserta terlebih dahulu.', 'warning');
      return;
    }
    const remainingSlots = candidateData?.session?.remaining_slots ?? (activeSessionForEnroll?.capacity || 27);
    if (list.length > remainingSlots) {
      showToast(`Jumlah peserta (${list.length}) melebihi sisa kapasitas sesi (${remainingSlots} peserta)!`, 'error');
      return;
    }

    setEnrolling(true);
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

  const filteredCandidates: CandidateStudent[] = (candidateData?.candidates || []).filter((cand: CandidateStudent) => {
    if (candidateFilter === 'available' && cand.status !== 'available') return false;
    if (candidateFilter === 'other_session' && cand.status !== 'enrolled_other_session') return false;
    if (candidateSearch.trim()) {
      const q = candidateSearch.toLowerCase();
      const mId = cand.identifier.toLowerCase().includes(q);
      const mName = cand.full_name.toLowerCase().includes(q);
      const mInst = cand.institution ? cand.institution.toLowerCase().includes(q) : false;
      return mId || mName || mInst;
    }
    return true;
  });

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
                  <th className="px-6 py-3.5">Tahun Soal</th>
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
                    <td className="px-6 py-4">
                      {sess.question_year ? (
                        <Badge variant="purple">Tahun {sess.question_year}</Badge>
                      ) : (
                        <Badge variant="neutral">Semua Tahun</Badge>
                      )}
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
                        <span>{sess.enrolled_count || 0} / {sess.capacity || 27} Peserta</span>
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
                        {sess.status !== 'completed' && (
                          <button
                            onClick={() => openEditModal(sess)}
                            className="p-1.5 text-[#583682] hover:bg-[#eae2f5] rounded transition"
                            title="Ubah Sesi & Tahun Soal"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
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

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Tahun Soal yang Digunakan
            </label>
            <select
              value={selectedQuestionYear}
              onChange={(e) => setSelectedQuestionYear(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b]"
            >
              <option value="">Semua Tahun (Fleksibel / Lintas Tahun)</option>
              {availableQuestionYears.map((yr) => (
                <option key={yr} value={yr}>
                  Soal Tahun {yr}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#595562] mt-1">
              Peserta pada sesi ini hanya akan mengerjakan bank soal dari tahun yang dipilih.
            </p>
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

          <div>
            <Input
              type="number"
              label="Kapasitas Ruangan / PC Lab (Maksimal Peserta)"
              required
              min={1}
              max={100}
              value={sessionCapacity}
              onChange={(e) => setSessionCapacity(e.target.value)}
              placeholder="27"
              helperText="Default 27 PC per sesi sesuai kapasitas laboratorium ujian FIA."
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

      {/* Enroll Participants Modal (FR-S04 with Collision Preview, Max 27, Auto/Manual) */}
      <Modal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        title={`Daftarkan Peserta: ${activeSessionForEnroll?.name}`}
        description="Alokasikan mahasiswa ke sesi ujian ini (Maksimal 27 peserta per sesi lab)."
        maxWidth="3xl"
      >
        <div className="space-y-4">
          {/* Sesi & Kuota Header Metric */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-[#faf9fc] rounded border border-[#e6e1eb] text-xs">
            <div>
              <div className="text-[11px] text-[#595562]">Kapasitas Ruang:</div>
              <div className="font-bold text-[#24212b]">
                {candidateData?.session?.capacity ?? (activeSessionForEnroll?.capacity || 27)} PC / Peserta
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#595562]">Sudah Terdaftar:</div>
              <div className="font-bold text-[#583682]">
                {candidateData?.session?.current_enrolled ?? (activeSessionForEnroll?.enrolled_count || 0)} Orang
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#595562]">Sisa Kuota Sesi:</div>
              <div
                className={`font-bold ${
                  (candidateData?.session?.remaining_slots ?? 27) > 0 ? 'text-[#287a58]' : 'text-[#b63b48]'
                }`}
              >
                {candidateData?.session?.remaining_slots ?? 27} Kursi Tersedia
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#595562]">Belum Terjadwal:</div>
              <div className="font-bold text-[#24212b]">
                {candidateData?.stats.available_count ?? 0} Mahasiswa
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-[#e6e1eb] gap-2">
            <button
              type="button"
              onClick={() => setEnrollMode('candidate_list')}
              className={`pb-2 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
                enrollMode === 'candidate_list'
                  ? 'border-[#583682] text-[#583682]'
                  : 'border-transparent text-[#595562] hover:text-[#24212b]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Pilih dari Daftar Mahasiswa (Checklist & Otomatis)</span>
            </button>
            <button
              type="button"
              onClick={() => setEnrollMode('manual_input')}
              className={`pb-2 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
                enrollMode === 'manual_input'
                  ? 'border-[#583682] text-[#583682]'
                  : 'border-transparent text-[#595562] hover:text-[#24212b]'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Input Manual / Tempel NIM</span>
            </button>
          </div>

          {/* TAB 1: CANDIDATE LIST (CHECKLIST & AUTO SELECT) */}
          {enrollMode === 'candidate_list' && (
            <div className="space-y-3">
              {/* Toolbar: Auto-Select + Search + Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleAutoSelectCandidates}
                    disabled={
                      (candidateData?.session?.remaining_slots ?? 0) <= 0 ||
                      (candidateData?.stats.available_count || 0) === 0
                    }
                    className="text-xs min-h-[32px] px-3 bg-[#583682] hover:bg-[#432963]"
                    leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                  >
                    Pilih Otomatis (
                    {Math.min(
                      candidateData?.session?.remaining_slots ?? 27,
                      candidateData?.stats.available_count || 0
                    )}{' '}
                    Mahasiswa)
                  </Button>

                  {selectedIdentifiers.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClearSelectedCandidates}
                      className="text-xs min-h-[32px] px-2 text-[#b63b48] hover:bg-[#feecee]"
                    >
                      Batal Pilih ({selectedIdentifiers.length})
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => activeSessionForEnroll && fetchCandidatesForSession(activeSessionForEnroll.id)}
                    disabled={loadingCandidates}
                    className="p-1.5 text-gray-500 hover:text-[#583682] hover:bg-[#faf9fc] rounded border border-[#e6e1eb]"
                    title="Muat ulang daftar mahasiswa"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingCandidates ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-44">
                    <Input
                      placeholder="Cari NIM/Nama..."
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>

                  <select
                    value={candidateFilter}
                    onChange={(e: any) => setCandidateFilter(e.target.value)}
                    className="h-8 px-2 text-xs bg-white border border-[#e6e1eb] rounded text-[#24212b]"
                  >
                    <option value="available">
                      Belum Terjadwal ({candidateData?.stats.available_count ?? 0})
                    </option>
                    <option value="all">
                      Semua ({candidateData?.stats.total_students ?? 0})
                    </option>
                    <option value="other_session">
                      Sesi Lain ({candidateData?.stats.enrolled_other_session ?? 0})
                    </option>
                  </select>
                </div>
              </div>

              {/* Candidates Table */}
              <div className="border border-[#e6e1eb] rounded overflow-hidden">
                <div className="max-h-64 overflow-y-auto no-scrollbar">
                  {loadingCandidates ? (
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-7 w-full" />
                      <Skeleton className="h-7 w-full" />
                      <Skeleton className="h-7 w-full" />
                    </div>
                  ) : filteredCandidates.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#595562]">
                      {candidateSearch ? 'Tidak ada mahasiswa yang cocok dengan pencarian.' : 'Tidak ada mahasiswa pada filter ini.'}
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] font-bold sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5 w-10 text-center">Pilih</th>
                          <th className="p-2.5">NIM / Identitas</th>
                          <th className="p-2.5">Nama & Email</th>
                          <th className="p-2.5">Institusi / Prodi</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e6e1eb]">
                        {filteredCandidates.map((cand) => {
                          const isSelected = selectedIdentifiers.includes(cand.identifier);
                          const remainingSlots = candidateData?.session?.remaining_slots ?? 27;
                          const isSelectionDisabled =
                            cand.status !== 'available' || (!isSelected && selectedIdentifiers.length >= remainingSlots);

                          return (
                            <tr
                              key={cand.identifier}
                              onClick={() => {
                                if (cand.status === 'available') {
                                  toggleSelectCandidate(cand.identifier);
                                }
                              }}
                              className={`transition ${
                                isSelected
                                  ? 'bg-[#f7f2fc] hover:bg-[#efe6f8]'
                                  : cand.status === 'available'
                                  ? 'hover:bg-[#faf9fc] cursor-pointer'
                                  : 'opacity-60 bg-gray-50/50 cursor-not-allowed'
                              }`}
                            >
                              <td className="p-2.5 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isSelectionDisabled}
                                  onChange={() => toggleSelectCandidate(cand.identifier)}
                                  className="w-4 h-4 rounded text-[#583682] border-gray-300 focus:ring-[#583682]"
                                />
                              </td>
                              <td className="p-2.5 font-mono font-bold text-[#583682]">{cand.identifier}</td>
                              <td className="p-2.5">
                                <div className="font-semibold text-[#24212b]">{cand.full_name}</div>
                                <div className="text-[10px] text-[#595562]">{cand.email}</div>
                              </td>
                              <td className="p-2.5 text-[#595562] text-[11px]">{cand.institution || '-'}</td>
                              <td className="p-2.5">
                                {cand.status === 'available' ? (
                                  <Badge variant="success">Belum Terjadwal (Siap)</Badge>
                                ) : cand.status === 'already_enrolled' ? (
                                  <Badge variant="purple">Sudah di Sesi Ini</Badge>
                                ) : cand.status === 'enrolled_other_session' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                    Terjadwal: {cand.other_session_name || 'Sesi Lain'}
                                  </span>
                                ) : cand.status === 'schedule_overlap' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                    Bentrok Jadwal
                                  </span>
                                ) : cand.status === 'already_passed' ? (
                                  <Badge variant="neutral">Sudah Lulus</Badge>
                                ) : cand.status === 'quota_exceeded' ? (
                                  <Badge variant="neutral">Kuota Habis</Badge>
                                ) : cand.status === 'suspended' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
                                    Akun Nonaktif
                                  </span>
                                ) : (
                                  <Badge variant="neutral">{cand.status}</Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Table Live Counter & Status */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="font-bold text-[#24212b]">
                  Terpilih:{' '}
                  <span
                    className={
                      selectedIdentifiers.length >= (candidateData?.session?.remaining_slots ?? 27)
                        ? 'text-[#b63b48]'
                        : 'text-[#583682]'
                    }
                  >
                    {selectedIdentifiers.length}
                  </span>{' '}
                  / {candidateData?.session?.remaining_slots ?? 27} Kuota Tersisa{' '}
                  <span className="text-[#595562] font-normal">(Maksimal 27 per sesi lab)</span>
                </div>

                {selectedIdentifiers.length >= (candidateData?.session?.remaining_slots ?? 27) && (
                  <span className="text-[11px] text-[#b63b48] font-semibold">
                    ✓ Kuota sesi penuh (Maksimal tercapai)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL TEXTAREA INPUT */}
          {enrollMode === 'manual_input' && (
            <div className="space-y-3">
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

              {/* Live Count & Split Helper */}
              {(() => {
                const list = identifiersText.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
                const remainingSlots = candidateData?.session?.remaining_slots ?? (activeSessionForEnroll?.capacity || 27);
                const isExcess = list.length > remainingSlots;

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#595562]">
                        Terdeteksi:{' '}
                        <span className={`font-bold ${isExcess ? 'text-[#b63b48]' : 'text-[#287a58]'}`}>
                          {list.length} NIM
                        </span>{' '}
                        / {remainingSlots} Sisa Kuota
                      </span>

                      {isExcess && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleSplitManualNIMs}
                          className="text-xs h-7 px-2 bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                          leftIcon={<Scissors className="w-3.5 h-3.5 text-amber-700" />}
                        >
                          Ambil {remainingSlots} NIM Pertama (Sisihkan {list.length - remainingSlots} NIM)
                        </Button>
                      )}
                    </div>

                    {isExcess && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Perhatian:</strong> Jumlah NIM yang ditempel ({list.length}) melebihi sisa kapasitas sesi ({remainingSlots} peserta). Klik tombol <strong>"Ambil {remainingSlots} NIM Pertama"</strong> di atas agar sisa {list.length - remainingSlots} NIM dapat disalin untuk sesi berikutnya.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Excess NIM Storage & Copy */}
              {remainingExcessNIMs.length > 0 && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#583682]">
                      Sisa {remainingExcessNIMs.length} NIM (Untuk Sesi Berikutnya):
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCopyExcessNIMs}
                      className="text-xs h-6 px-2 text-[#583682] hover:bg-[#eae2f5]"
                      leftIcon={<Copy className="w-3 h-3" />}
                    >
                      Salin ke Clipboard
                    </Button>
                  </div>
                  <div className="font-mono text-[11px] text-[#595562] max-h-20 overflow-y-auto bg-white p-2 rounded border border-purple-100">
                    {remainingExcessNIMs.join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-[#e6e1eb]">
            <Button
              type="button"
              variant="secondary"
              onClick={handlePreviewEnrollment}
              isLoading={previewingEnroll}
              className="text-xs min-h-[34px] px-3"
            >
              Periksa Tabrakan Jadwal (Preview)
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEnrollModalOpen(false)}
                className="text-xs min-h-[34px] px-3"
              >
                Batal
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={handleCommitEnrollment}
                isLoading={enrolling}
                className="text-xs min-h-[34px] px-4 font-bold"
              >
                Konfirmasi Pendaftaran (
                {enrollMode === 'candidate_list'
                  ? selectedIdentifiers.length
                  : identifiersText.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean).length}{' '}
                Peserta)
              </Button>
            </div>
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

      {/* Edit Session Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Ubah Pengaturan Sesi Ujian"
        description="Perbarui informasi sesi, jadwal waktu pengerjaan, atau tahun bank soal yang digunakan."
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateSession} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Kode Sesi (ID Unik)
            </label>
            <div className="font-mono text-xs px-3 py-2 bg-[#eae2f5] rounded text-[#583682] font-bold">
              {editingSession?.code}
            </div>
          </div>

          <Input
            label="Nama Sesi Ujian"
            required
            value={editSessionName}
            onChange={(e) => setEditSessionName(e.target.value)}
            placeholder="Contoh: Sesi Pagi Gelombang 1"
          />

          <div>
            <Input
              type="number"
              label="Kapasitas Ruangan / PC Lab (Maksimal Peserta)"
              required
              min={1}
              max={100}
              value={editSessionCapacity}
              onChange={(e) => setEditSessionCapacity(e.target.value)}
              placeholder="27"
              helperText="Default 27 PC per sesi lab."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Tahun Soal yang Digunakan
            </label>
            <select
              value={editQuestionYear}
              onChange={(e) => setEditQuestionYear(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b]"
            >
              <option value="">Semua Tahun (Fleksibel / Lintas Tahun)</option>
              {availableQuestionYears.map((yr) => (
                <option key={yr} value={yr}>
                  Soal Tahun {yr}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#595562] mt-1">
              Peserta pada sesi ini hanya akan mengerjakan butir soal dari bank soal tahun yang dipilih.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="Waktu Mulai"
              required
              value={editStartsAt}
              onChange={(e) => setEditStartsAt(e.target.value)}
            />
            <Input
              type="datetime-local"
              label="Waktu Selesai"
              required
              value={editEndsAt}
              onChange={(e) => setEditEndsAt(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button type="button" variant="ghost" onClick={() => setEditModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={savingEditSession}>
              Simpan Perubahan Sesi
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
