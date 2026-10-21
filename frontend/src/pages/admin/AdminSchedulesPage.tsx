import React, { useEffect, useState, useMemo } from 'react';
import { sessionService, examService, reportService, questionService } from '../../services';
import { ExamSession, Exam, SessionEnrollment, CandidateResponse, CandidateStudent } from '../../types';
import { useToast } from '../../context/ToastContext';
import { alert } from '../../utils/alert';
import { formatToWIBInput, wibInputToISOString, formatWIBDateTime, getWIBDateString, addMinutesToWIBDateTime, calculateMinutesDuration } from '../../utils/date';
import { SessionSchedulePicker } from '../../components/sessions/SessionSchedulePicker';
import { SessionLiveProctorModal } from '../../components/sessions/SessionLiveProctorModal';
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
  Printer,
  FileText,
  Radio,
  Trash2,
  Ban,
  UserMinus,
} from 'lucide-react';

export interface QuestionYearDetail {
  year: number;
  total_count: number;
  active_count: number;
}

export const AdminSchedulesPage: React.FC = () => {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [availableQuestionYears, setAvailableQuestionYears] = useState<QuestionYearDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'completed' | 'cancelled'>('all');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [cancellingSessionId, setCancellingSessionId] = useState<string | null>(null);
  const [unenrollingStudentId, setUnenrollingStudentId] = useState<string | null>(null);

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
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // Live Proctor & BAP State (Fitur A & C)
  const [proctorModalOpen, setProctorModalOpen] = useState(false);
  const [activeSessionForProctor, setActiveSessionForProctor] = useState<ExamSession | null>(null);
  const [downloadingBapId, setDownloadingBapId] = useState<string | null>(null);

  const handleOpenProctor = (sess: ExamSession) => {
    setActiveSessionForProctor(sess);
    setProctorModalOpen(true);
  };

  const handleExportBapPDF = async (sess: ExamSession) => {
    setDownloadingBapId(sess.id);
    try {
      const blob = await sessionService.exportSessionBapPDF(sess.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BAP_Presensi_${sess.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast(`Berita Acara & Daftar Presensi Sesi "${sess.name}" berhasil diunduh (PDF)!`, 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || err.message || 'Gagal mengunduh Berita Acara PDF.', 'error');
    } finally {
      setDownloadingBapId(null);
    }
  };


  const fetchSessionsAndExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsData, examsData, yearsDetails] = await Promise.all([
        sessionService.getSessions(),
        examService.getExams(),
        questionService.getQuestionYearsDetailed().catch(() => []),
      ]);
      setSessions(sessionsData);
      setExams(examsData);

      const currentYear = new Date().getFullYear();
      let details: QuestionYearDetail[] = yearsDetails || [];
      if (!details.some((d) => d.year === currentYear)) {
        details.push({ year: currentYear, total_count: 0, active_count: 0 });
      }
      details = details.sort((a, b) => b.year - a.year);
      setAvailableQuestionYears(details);

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

  const selectedExam = useMemo(() => {
    return exams.find((x) => x.id === selectedExamId) || exams[0];
  }, [exams, selectedExamId]);

  const openCreateModal = () => {
    setSessionCode(`SES-${Date.now().toString().slice(-4)}`);
    setSessionName('');
    setSessionCapacity('27');

    const exam = exams.find((e) => e.id === selectedExamId) || exams[0];
    const duration = exam?.duration_minutes || 90;
    const today = getWIBDateString(0);
    const startStr = `${today}T08:00`;
    const endStr = addMinutesToWIBDateTime(startStr, duration);
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
    const duration = calculateMinutesDuration(startsAt, endsAt);
    if (duration <= 0) {
      showToast('Waktu selesai harus lebih lambat dari waktu mulai.', 'error');
      return;
    }
    setSavingSession(true);
    try {
      await sessionService.createSession({
        exam_id: selectedExamId,
        code: sessionCode.trim().toUpperCase(),
        name: sessionName.trim(),
        starts_at: wibInputToISOString(startsAt),
        ends_at: wibInputToISOString(endsAt),
        capacity: sessionCapacity ? parseInt(sessionCapacity, 10) : 27,
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
    const startStr = formatToWIBInput(sess.starts_at);
    const endStr = formatToWIBInput(sess.ends_at);
    setEditStartsAt(startStr);
    setEditEndsAt(endStr);
    setEditModalOpen(true);
  };

  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    const duration = calculateMinutesDuration(editStartsAt, editEndsAt);
    if (duration <= 0) {
      showToast('Waktu selesai harus lebih lambat dari waktu mulai.', 'error');
      return;
    }
    setSavingEditSession(true);
    try {
      await sessionService.updateSession(editingSession.id, {
        name: editSessionName.trim(),
        starts_at: wibInputToISOString(editStartsAt),
        ends_at: wibInputToISOString(editEndsAt),
        capacity: editSessionCapacity ? parseInt(editSessionCapacity, 10) : 27,
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
      showToast('Tidak ada peserta belum terjadwal yang siap dialokasikan.', 'info');
      return;
    }
    const toPick = available.slice(0, remainingSlots).map((c) => c.identifier);
    setSelectedIdentifiers(toPick);
    showToast(`Otomatis memilih ${toPick.length} peserta pertama yang belum terjadwal!`, 'success');
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
    showToast(`${firstPart.length} nomor peserta dimasukkan ke sesi ini. ${excessPart.length} sisa nomor peserta disiapkan untuk sesi lain.`, 'info');
  };

  const handleCopyExcessNIMs = () => {
    if (remainingExcessNIMs.length === 0) return;
    navigator.clipboard.writeText(remainingExcessNIMs.join('\n'));
    showToast(`${remainingExcessNIMs.length} nomor peserta berhasil disalin ke clipboard!`, 'success');
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
      showToast('Pilih atau masukkan minimal 1 NIM / No. Peserta terlebih dahulu.', 'warning');
      return;
    }
    setPreviewingEnroll(true);
    try {
      const data = await sessionService.previewEnrollments(activeSessionForEnroll.id, list);
      setEnrollPreview(data);
      showToast(`Pratinjau: ${data.valid_count || list.length} peserta siap didaftarkan.`, 'info');
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
      showToast('Pilih atau masukkan minimal 1 NIM / No. Peserta terlebih dahulu.', 'warning');
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
      if (res.skipped && res.skipped.length > 0) {
        showToast(
          `Pendaftaran selesai: ${res.enrolled} peserta berhasil didaftarkan, ${res.skipped.length} dilewati (cek preview untuk alasan).`,
          'warning'
        );
      } else {
        showToast(`Berhasil mendaftarkan ${res.enrolled || list.length} peserta ke sesi ini!`, 'success');
      }
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
    const confirmed = await alert.confirm({
      title: 'Finalisasi Sesi Ujian?',
      text: `Apakah Anda yakin ingin memfinalisasi sesi "${sess.name}" (${sess.code})? Seluruh attempt peserta akan dinilai secara otomatis dan status sesi ditutup.`,
      confirmButtonText: 'Ya, Finalisasi Sesi',
    });
    if (!confirmed) return;

    try {
      await sessionService.finalizeSession(sess.id);
      alert.success('Sesi Berhasil Difinalisasi', 'Seluruh pengerjaan peserta telah dinilai dan hasil siap dipublikasikan.');
      fetchSessionsAndExams();
    } catch (err: any) {
      alert.error('Gagal Memfinalisasi Sesi', err?.response?.data?.message || err.message || 'Terjadi kesalahan sistem.');
    }
  };

  const handleCancelSession = async (sess: ExamSession) => {
    const confirmed = await alert.confirm({
      title: 'Batalkan Sesi Ujian?',
      text: `Apakah Anda yakin ingin MEMBATALKAN sesi "${sess.name}" (${sess.code})? Sesi yang dibatalkan tidak dapat diakses lagi oleh mahasiswa.`,
      confirmButtonText: 'Ya, Batalkan Sesi',
      isDangerous: true,
    });
    if (!confirmed) return;

    setCancellingSessionId(sess.id);
    try {
      await sessionService.cancelSession(sess.id);
      alert.toast(`Sesi "${sess.name}" berhasil dibatalkan.`, 'warning');
      fetchSessionsAndExams();
    } catch (err: any) {
      alert.error('Gagal Membatalkan Sesi', err?.response?.data?.message || err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setCancellingSessionId(null);
    }
  };

  const handleDeleteSession = async (sess: ExamSession) => {
    const confirmed = await alert.confirm({
      title: 'Hapus Sesi Ujian Permanen?',
      text: `PERINGATAN: Sesi "${sess.name}" (${sess.code}) beserta seluruh data pendaftarannya akan dihapus permanen dari sistem. Tindakan ini tidak dapat dibatalkan.`,
      confirmButtonText: 'Ya, Hapus Permanen',
      isDangerous: true,
    });
    if (!confirmed) return;

    setDeletingSessionId(sess.id);
    try {
      await sessionService.deleteSession(sess.id);
      alert.toast(`Sesi "${sess.name}" berhasil dihapus permanen!`, 'success');
      fetchSessionsAndExams();
    } catch (err: any) {
      alert.error('Gagal Menghapus Sesi', err?.response?.data?.message || err.message || 'Sesi dengan percobaan ujian tidak dapat dihapus.');
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleUnenrollStudent = async (enrollmentId: string, studentName: string) => {
    if (!activeSessionForEnroll) return;
    const confirmed = await alert.confirm({
      title: 'Batalkan Pendaftaran Peserta?',
      text: `Batalkan alokasi peserta "${studentName}" dari sesi "${activeSessionForEnroll.name}"? Peserta akan kembali tersedia untuk dijadwalkan pada sesi lain.`,
      confirmButtonText: 'Ya, Batalkan',
      isDangerous: true,
    });
    if (!confirmed) return;

    setUnenrollingStudentId(enrollmentId);
    try {
      await sessionService.unenrollStudent(activeSessionForEnroll.id, enrollmentId);
      alert.toast(`Peserta "${studentName}" berhasil dibatalkan dari sesi.`, 'success');
      // Refresh enrollments modal & main sessions
      const list = await sessionService.getEnrollments(activeSessionForEnroll.id);
      setEnrolledStudents(list);
      fetchSessionsAndExams();
    } catch (err: any) {
      alert.error('Gagal Membatalkan Pendaftaran', err?.response?.data?.message || err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setUnenrollingStudentId(null);
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

  const handleExportCredentialsPDF = async (sess: ExamSession) => {
    if ((sess.enrolled_count || 0) === 0) {
      showToast(`Belum ada peserta yang didaftarkan ke sesi "${sess.name}".`, 'warning');
      return;
    }
    setDownloadingPdfId(sess.id);
    try {
      const blob = await sessionService.exportSessionCredentialsPDF(sess.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Kredensial_Peserta_${sess.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast(`Kartu kredensial sesi "${sess.name}" berhasil diunduh dalam format PDF!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunduh kartu kredensial PDF.', 'error');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.exam_title && s.exam_title.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return s.status === statusFilter;
  });

  const filteredCandidates: CandidateStudent[] = (candidateData?.candidates || []).filter((cand: CandidateStudent) => {
    if (candidateFilter === 'available' && cand.status !== 'available') return false;
    if (candidateFilter === 'other_session' && cand.status !== 'enrolled_other_session') return false;
    if (candidateSearch.trim()) {
      const q = candidateSearch.toLowerCase();
      const mId = cand.identifier.toLowerCase().includes(q);
      const mName = cand.full_name.toLowerCase().includes(q);
      const mEmail = cand.email ? cand.email.toLowerCase().includes(q) : false;
      const mRole = cand.role ? cand.role.toLowerCase().includes(q) : false;
      const mInst = cand.institution ? cand.institution.toLowerCase().includes(q) : false;
      return mId || mName || mEmail || mRole || mInst;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">JADWAL SESI</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Jadwal Sesi Ujian
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Kelola jadwal sesi ujian dan alokasi peserta lab komputer.
          </p>
        </div>

        <Button variant="primary" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
          Buat Sesi Baru
        </Button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchSessionsAndExams} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:max-w-md">
          <Input
            placeholder="Cari kode atau nama sesi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-gray-400" />}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#595562] shrink-0" />
          <span className="text-xs text-[#595562] font-semibold whitespace-nowrap">Status Sesi:</span>
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="h-10 px-3 text-xs bg-white border border-[#e6e1eb] rounded text-[#24212b] font-medium focus:border-[#583682] outline-none"
          >
            <option value="all">Semua Status ({sessions.length})</option>
            <option value="active">Sedang Berjalan ({sessions.filter((s) => s.status === 'active').length})</option>
            <option value="scheduled">Terjadwal ({sessions.filter((s) => s.status === 'scheduled').length})</option>
            <option value="completed">Selesai ({sessions.filter((s) => s.status === 'completed').length})</option>
            <option value="cancelled">Dibatalkan ({sessions.filter((s) => s.status === 'cancelled').length})</option>
          </select>
        </div>
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
                  <th className="px-6 py-3.5">Nama Sesi</th>
                  <th className="px-6 py-3.5">Paket Ujian Terpilih</th>
                  <th className="px-6 py-3.5">Waktu Mulai (WIB)</th>
                  <th className="px-6 py-3.5">Waktu Selesai (WIB)</th>
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
                        Kapasitas: {sess.capacity || 27} PC Lab
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#24212b] text-xs">
                        {sess.exam_title || 'Ujian Kompetensi FIA'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#583682] bg-[#f6f2fa] px-1.5 py-0.5 rounded border border-[#cfc2df]">
                          <Calendar className="w-3 h-3 text-[#583682]" /> Th. {sess.exam_year || exams.find(e => e.id === sess.exam_id)?.year || '2026'}
                        </span>
                        {exams.find(e => e.id === sess.exam_id)?.total_rules_count && (
                          <span className="text-[10px] text-[#287a58] font-semibold">
                            • {exams.find(e => e.id === sess.exam_id)?.total_rules_count} Soal
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#595562] whitespace-nowrap font-medium">
                      {formatWIBDateTime(sess.starts_at)}
                    </td>
                    <td className="px-6 py-4 text-[#595562] whitespace-nowrap font-medium">
                      {formatWIBDateTime(sess.ends_at)}
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
                            : sess.status === 'cancelled'
                            ? 'danger'
                            : 'purple'
                        }
                      >
                        {sess.status === 'active'
                          ? 'SEDANG BERJALAN'
                          : sess.status === 'completed'
                          ? 'SELESAI'
                          : sess.status === 'cancelled'
                          ? 'DIBATALKAN'
                          : 'TERJADWAL'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* 1. Tombol Operasional Lab */}
                        <div className="inline-flex items-center gap-0.5 bg-[#f6f2fa] p-0.5 rounded-lg border border-[#e6e1eb]">
                          {/* Ruang Monitor Pengawas Live */}
                          {sess.status !== 'cancelled' && (
                            <button
                              onClick={() => handleOpenProctor(sess)}
                              className="p-1.5 text-red-600 hover:bg-white rounded-md transition shadow-2xs"
                              title="Ruang Pengawas Ujian Realtime (Live Proctoring & PIN)"
                            >
                              <Radio className={`w-4 h-4 ${sess.status === 'active' ? 'animate-pulse text-red-600' : ''}`} />
                            </button>
                          )}

                          {/* Daftarkan Peserta */}
                          {sess.status !== 'completed' && sess.status !== 'cancelled' && (
                            <button
                              onClick={() => openEnrollModal(sess)}
                              className="p-1.5 text-[#583682] hover:bg-white rounded-md transition shadow-2xs"
                              title="Alokasikan Peserta (FR-S04)"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}

                          {/* Cetak BAP Presensi Sesi */}
                          <button
                            onClick={() => handleExportBapPDF(sess)}
                            disabled={downloadingBapId === sess.id}
                            className="p-1.5 text-indigo-600 hover:bg-white rounded-md transition shadow-2xs"
                            title="Cetak Berita Acara & Daftar Hadir Lab (PDF)"
                          >
                            <FileText className={`w-4 h-4 ${downloadingBapId === sess.id ? 'animate-pulse' : ''}`} />
                          </button>

                          {/* Cetak Kartu Kredensial PDF */}
                          <button
                            onClick={() => handleExportCredentialsPDF(sess)}
                            disabled={downloadingPdfId === sess.id}
                            className="p-1.5 text-amber-600 hover:bg-white rounded-md transition shadow-2xs"
                            title="Cetak Kartu Login Peserta (PDF)"
                          >
                            <Printer className={`w-4 h-4 ${downloadingPdfId === sess.id ? 'animate-pulse' : ''}`} />
                          </button>
                        </div>

                        {/* 2. Tombol Konfigurasi & Governance */}
                        <div className="inline-flex items-center gap-0.5 bg-gray-50 p-0.5 rounded-lg border border-[#e6e1eb]">
                          {/* Ubah Sesi */}
                          {sess.status !== 'completed' && sess.status !== 'cancelled' && (
                            <button
                              onClick={() => openEditModal(sess)}
                              className="p-1.5 text-[#583682] hover:bg-white rounded-md transition shadow-2xs"
                              title="Ubah Waktu & Kapasitas Sesi"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Unduh Laporan CSV */}
                          <button
                            onClick={() => handleExportCSV(sess)}
                            className="p-1.5 text-gray-600 hover:bg-white rounded-md transition shadow-2xs"
                            title="Unduh Rekapitulasi CSV"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Finalisasi Sesi */}
                          {sess.status !== 'completed' && sess.status !== 'cancelled' && (
                            <button
                              onClick={() => handleFinalizeSession(sess)}
                              className="p-1.5 text-emerald-600 hover:bg-white rounded-md transition shadow-2xs"
                              title="Finalisasi & Nilai Sesi"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Batalkan Sesi */}
                          {sess.status !== 'completed' && sess.status !== 'cancelled' && (
                            <button
                              onClick={() => handleCancelSession(sess)}
                              disabled={cancellingSessionId === sess.id}
                              className="p-1.5 text-rose-600 hover:bg-white rounded-md transition shadow-2xs"
                              title="Batalkan Sesi Ujian"
                            >
                              <Ban className={`w-4 h-4 ${cancellingSessionId === sess.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}

                          {/* Hapus Sesi Permanen */}
                          {(sess.status === 'scheduled' || sess.status === 'cancelled' || !sess.status) && (
                            <button
                              onClick={() => handleDeleteSession(sess)}
                              disabled={deletingSessionId === sess.id}
                              className="p-1.5 text-red-600 hover:bg-white rounded-md transition shadow-2xs"
                              title="Hapus Sesi Ujian Permanen"
                            >
                              <Trash2 className={`w-4 h-4 ${deletingSessionId === sess.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
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
        title="Buat Sesi Ujian"
        description="Atur paket ujian, waktu mulai, dan kapasitas peserta."
      >
        {exams.length === 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-900">Belum Ada Paket Ujian</h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Buat paket ujian terlebih dahulu sebelum membuka sesi.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-amber-200/60">
              <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Tutup
              </Button>
              <a
                href="/admin/exams"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#583682] text-white text-xs font-bold rounded hover:bg-[#432963] transition"
              >
                Buat Paket Ujian &rarr;
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveSession} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#24212b] mb-1">
                Pilih Paket Ujian <span className="text-[#b63b48]">*</span>
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedExamId(newId);
                  const ex = exams.find((x) => x.id === newId);
                  if (ex?.duration_minutes && startsAt) {
                    setEndsAt(addMinutesToWIBDateTime(startsAt, ex.duration_minutes));
                  }
                }}
                className="w-full h-10 px-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b]"
                required
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({ex.code}) — Th. {ex.year || '2026'}
                  </option>
                ))}
              </select>
            </div>

            {/* Ringkasan Konfigurasi Paket Ujian Terpilih */}
            {selectedExam && (
              <div className="p-3 bg-[#f8f6fc] rounded-[8px] border border-[#cfc2df] space-y-2">
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#583682]">
                    <FileText className="w-4 h-4 text-[#583682]" />
                    <span>{selectedExam.title} ({selectedExam.code})</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#583682] bg-white px-2 py-0.5 rounded border border-[#cfc2df]">
                    <Calendar className="w-3.5 h-3.5 text-[#583682]" /> Th. {selectedExam.year || '2026'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs bg-white p-2 rounded-[6px] border border-[#e6e1eb] text-center">
                  <div>
                    <span className="text-[10px] text-[#595562] block">Jumlah Soal</span>
                    <strong className="text-[#24212b]">{Number(selectedExam.total_rules_count) || selectedExam.question_count || 100} Soal</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#595562] block">Passing Score</span>
                    <strong className="text-[#24212b]">{selectedExam.passing_score}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#595562] block">Sumber Soal</span>
                    <strong className="text-[#287a58]">Paket Terpilih</strong>
                  </div>
                </div>
              </div>
            )}

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
                placeholder="Contoh: Sesi 1 Pagi"
              />
            </div>

            <div>
              <Input
                type="number"
                label="Kapasitas PC Lab"
                required
                min={1}
                max={100}
                value={sessionCapacity}
                onChange={(e) => setSessionCapacity(e.target.value)}
                placeholder="27"
                helperText="Maksimal 27 PC per sesi."
              />
            </div>

            <SessionSchedulePicker
              startsAt={startsAt}
              endsAt={endsAt}
              onChange={(start, end) => {
                setStartsAt(start);
                setEndsAt(end);
              }}
              examDurationMinutes={exams.find((e) => e.id === selectedExamId)?.duration_minutes}
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
              <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" variant="primary" isLoading={savingSession}>
                Simpan Sesi
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Enroll Participants Modal (FR-S04 with Collision Preview, Max 27, Auto/Manual) */}
      <Modal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        title={`Daftarkan Peserta: ${activeSessionForEnroll?.name}`}
        description="Pilih peserta untuk dialokasikan ke sesi ini."
        maxWidth="3xl"
      >
        <div className="space-y-4">
          {/* Sesi & Kuota Header Metric */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-[#faf9fc] rounded border border-[#e6e1eb] text-xs">
            <div>
              <div className="text-[11px] text-[#595562]">Kapasitas:</div>
              <div className="font-bold text-[#24212b]">
                {candidateData?.session?.capacity ?? (activeSessionForEnroll?.capacity || 27)} PC
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#595562]">Terdaftar:</div>
              <div className="font-bold text-[#583682]">
                {candidateData?.session?.current_enrolled ?? (activeSessionForEnroll?.enrolled_count || 0)} Orang
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#595562]">Sisa Kuota:</div>
              <div
                className={`font-bold ${
                  (candidateData?.session?.remaining_slots ?? 27) > 0 ? 'text-[#287a58]' : 'text-[#b63b48]'
                }`}
              >
                {candidateData?.session?.remaining_slots ?? 27} Kursi
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#595562]">Belum Terjadwal:</div>
              <div className="font-bold text-[#24212b]">
                {candidateData?.stats.available_count ?? 0} Peserta
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
              <span>Daftar Peserta</span>
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
              <span>Input Manual (Tempel NIM)</span>
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
                    Peserta)
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
                    title="Muat ulang daftar peserta"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingCandidates ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-52">
                    <Input
                      placeholder="Cari NIM, nama, email..."
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
                      Semua Peserta ({candidateData?.stats.total_students ?? 0})
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
                      {candidateSearch ? 'Tidak ada peserta yang cocok dengan pencarian.' : 'Tidak ada peserta pada filter ini.'}
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] font-bold sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5 w-10 text-center">Pilih</th>
                          <th className="p-2.5 w-24">Kategori</th>
                          <th className="p-2.5">NIM / No. Peserta</th>
                          <th className="p-2.5">Nama & Email</th>
                          <th className="p-2.5">Institusi</th>
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
                              <td className="p-2.5">
                                {cand.role === 'umum' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    UMUM
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    MAHASISWA
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 font-mono font-bold text-[#583682]">{cand.identifier}</td>
                              <td className="p-2.5">
                                <div className="font-semibold text-[#24212b]">{cand.full_name}</div>
                                <div className="text-[10px] text-[#595562]">{cand.email}</div>
                              </td>
                              <td className="p-2.5 text-[#595562] text-[11px]">{cand.institution || '-'}</td>
                              <td className="p-2.5">
                                {cand.status === 'available' ? (
                                  <Badge variant="success">Siap Didaftarkan</Badge>
                                ) : cand.status === 'already_enrolled' ? (
                                  <Badge variant="purple">Sudah di Sesi Ini</Badge>
                                ) : cand.status === 'enrolled_other_session' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                    {cand.other_session_name || 'Sesi Lain'}
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
                                    Nonaktif
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
                  / {candidateData?.session?.remaining_slots ?? 27} Sisa Kuota{' '}
                  <span className="text-[#595562] font-normal">(Maks. 27 PC)</span>
                </div>

                {selectedIdentifiers.length >= (candidateData?.session?.remaining_slots ?? 27) && (
                  <span className="text-[11px] text-[#b63b48] font-semibold">
                    ✓ Kuota sesi penuh
                  </span>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL TEXTAREA INPUT */}
          {enrollMode === 'manual_input' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#24212b] mb-1.5">
                  Daftar NIM / Nomor Peserta (Satu per baris atau pisahkan koma)
                </label>
                <textarea
                  rows={4}
                  value={identifiersText}
                  onChange={(e) => setIdentifiersText(e.target.value)}
                  placeholder="20261001&#10;UMUM-100234&#10;20261003"
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
                          Ambil {remainingSlots} NIM Pertama
                        </Button>
                      )}
                    </div>

                    {isExcess && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          Jumlah NIM ({list.length}) melebihi kuota ({remainingSlots}). Klik "Ambil {remainingSlots} NIM Pertama" untuk memotong sisanya.
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
                      Sisa {remainingExcessNIMs.length} NIM Disimpan:
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCopyExcessNIMs}
                      className="text-xs h-6 px-2 text-[#583682] hover:bg-[#eae2f5]"
                      leftIcon={<Copy className="w-3 h-3" />}
                    >
                      Salin NIM
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
              Cek Bentrok Jadwal
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
                Simpan Peserta (
                {enrollMode === 'candidate_list'
                  ? selectedIdentifiers.length
                  : identifiersText.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean).length}
                )
              </Button>
            </div>
          </div>

          {/* Collision Preview Results */}
          {enrollPreview && (
            <div className="p-3 bg-[#faf9fc] rounded border border-[#e6e1eb] text-xs space-y-2">
              <div className="font-bold text-[#24212b]">
                Hasil Cek Jadwal:
              </div>
              <div className="flex gap-4">
                <span className="text-[#287a58] font-semibold">
                  Siap Didaftarkan: {enrollPreview.valid_count || 0}
                </span>
                <span className="text-[#b63b48] font-semibold">
                  Bentrok / Tidak Valid: {enrollPreview.skipped_count || 0}
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
              Belum ada peserta di sesi ini.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[360px] no-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] font-bold">
                  <tr>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">NIM / No. Peserta</th>
                    <th className="p-3">Nama</th>
                    <th className="p-3">Email & Institusi</th>
                    <th className="p-3">Status Ujian</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e1eb]">
                  {enrolledStudents.map((st) => {
                    const enrollmentId = (st as any).enrollment_id || st.id;
                    const canUnenroll = st.attempt_status !== 'submitted' && st.attempt_status !== 'auto_submitted' && activeSessionForEnroll?.status !== 'completed';

                    return (
                      <tr key={enrollmentId} className="hover:bg-[#faf9fc]">
                        <td className="p-3">
                          {st.role === 'umum' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              UMUM
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              MAHASISWA
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-[#583682]">{st.identifier}</td>
                        <td className="p-3 font-semibold text-[#24212b]">{st.full_name}</td>
                        <td className="p-3 text-[#595562]">
                          <div>{st.email}</div>
                          {st.institution && (
                            <div className="text-[10px] text-[#595562]">{st.institution}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant={st.attempt_status === 'submitted' ? 'success' : 'neutral'}>
                            {st.attempt_status || 'Belum Mengambil'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          {canUnenroll ? (
                            <button
                              type="button"
                              onClick={() => handleUnenrollStudent(enrollmentId, st.full_name || st.identifier || 'Peserta')}
                              disabled={unenrollingStudentId === enrollmentId}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                              title="Keluarkan peserta"
                            >
                              <UserMinus className={`w-3.5 h-3.5 ${unenrollingStudentId === enrollmentId ? 'animate-spin' : ''}`} />
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400">Terkunci</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#e6e1eb]">
            {activeSessionForEnroll && enrolledStudents.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleExportCredentialsPDF(activeSessionForEnroll)}
                isLoading={downloadingPdfId === activeSessionForEnroll.id}
                leftIcon={<Printer className="w-3.5 h-3.5 text-amber-600" />}
                className="text-xs"
              >
                Cetak Kartu Login ({enrolledStudents.length} Peserta)
              </Button>
            ) : <div />}
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
        title="Ubah Sesi Ujian"
        description="Perbarui informasi sesi dan waktu pelaksanaan."
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateSession} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Kode Sesi
            </label>
            <div className="font-mono text-xs px-3 py-2 bg-[#eae2f5] rounded text-[#583682] font-bold">
              {editingSession?.code}
            </div>
          </div>

          <Input
            label="Nama Sesi"
            required
            value={editSessionName}
            onChange={(e) => setEditSessionName(e.target.value)}
            placeholder="Contoh: Sesi 1 Pagi"
          />

          <div>
            <Input
              type="number"
              label="Kapasitas Ruangan (PC)"
              required
              min={1}
              max={100}
              value={editSessionCapacity}
              onChange={(e) => setEditSessionCapacity(e.target.value)}
              placeholder="27"
              helperText="Maksimal peserta lab komputer."
            />
          </div>

          {/* Paket Ujian Terpilih Info */}
          {editingSession && (
            <div className="p-3 bg-[#f8f6fc] rounded border border-[#cfc2df] space-y-1 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-[#583682] flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#583682]" />
                  Paket: {editingSession.exam_title || exams.find((e) => e.id === editingSession.exam_id)?.title}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#583682] bg-white px-2 py-0.5 rounded border border-[#cfc2df]">
                  <Calendar className="w-3.5 h-3.5 text-[#583682]" /> Tahun {editingSession.exam_year || exams.find((e) => e.id === editingSession.exam_id)?.year || '2026'}
                </span>
              </div>
              <p className="text-[11px] text-[#595562]">
                Soal diambil otomatis dari paket ujian terpilih sesuai komposisi subtes.
              </p>
            </div>
          )}

          <SessionSchedulePicker
            startsAt={editStartsAt}
            endsAt={editEndsAt}
            onChange={(start, end) => {
              setEditStartsAt(start);
              setEditEndsAt(end);
            }}
            examDurationMinutes={
              exams.find((e) => e.id === editingSession?.exam_id)?.duration_minutes ||
              editingSession?.duration_minutes
            }
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button type="button" variant="ghost" onClick={() => setEditModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={savingEditSession}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>
      {/* Fitur A: Modal Ruang Pengawas Lab Realtime */}
      <SessionLiveProctorModal
        isOpen={proctorModalOpen}
        onClose={() => setProctorModalOpen(false)}
        session={activeSessionForProctor}
        onSessionUpdated={fetchSessionsAndExams}
      />
    </div>
  );
};
