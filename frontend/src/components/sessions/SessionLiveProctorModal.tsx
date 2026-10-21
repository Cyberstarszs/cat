import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../context/ToastContext';
import { sessionService, attemptService } from '../../services';
import { ExamSession } from '../../types';
import {
  ShieldAlert,
  Clock,
  RefreshCw,
  Copy,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Users,
  Search,
  Zap,
  Eye,
  Ban,
  Activity,
  FileText,
  Radio,
  Timer,
} from 'lucide-react';

interface SessionLiveProctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ExamSession | null;
  onSessionUpdated?: () => void;
}

interface ParticipantMonitor {
  enrollment_id: string;
  enrollment_status: string;
  identifier: string;
  full_name: string;
  institution?: string;
  attempt_id?: string;
  attempt_status?: 'in_progress' | 'submitted' | 'auto_submitted' | 'void';
  started_at?: string;
  deadline_at?: string;
  extra_seconds?: number;
  submitted_at?: string;
  submit_reason?: string;
  void_reason?: string;
  score?: number;
  passed?: boolean;
  answered_count: number | string;
  flagged_count: number | string;
  violation_count?: number | string;
}

export const SessionLiveProctorModal: React.FC<SessionLiveProctorModalProps> = ({
  isOpen,
  onClose,
  session,
  onSessionUpdated,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    session: any;
    summary: {
      total_enrolled: number;
      in_progress: number;
      submitted: number;
      absent: number;
    };
    participants: ParticipantMonitor[];
  } | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'submitted' | 'violation' | 'void'>('all');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(5); // seconds, 0 = off
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Token Release State
  const [customToken, setCustomToken] = useState('');
  const [generatingToken, setGeneratingToken] = useState(false);

  // Extend All State
  const [extendAllOpen, setExtendAllOpen] = useState(false);
  const [extendAllMinutes, setExtendAllMinutes] = useState('10');
  const [extendingAll, setExtendingAll] = useState(false);

  // Individual Extend State
  const [extendIndivOpen, setExtendIndivOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantMonitor | null>(null);
  const [extendIndivMinutes, setExtendIndivMinutes] = useState('10');
  const [extendIndivReason, setExtendIndivReason] = useState('Kendala teknis koneksi internet lab');
  const [extendingIndiv, setExtendingIndiv] = useState(false);

  // Void State
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('Terbukti membuka materi di luar ujian berulang kali.');
  const [voiding, setVoiding] = useState(false);

  // Event Log State
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [participantEvents, setParticipantEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const fetchMonitorData = useCallback(async (isSilent = false) => {
    if (!session) return;
    if (!isSilent) setLoading(true);
    try {
      const res = await sessionService.getSessionMonitor(session.id);
      setData(res);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      if (!isSilent) {
        showToast(err?.response?.data?.message || 'Gagal memuat status pengawas sesi', 'error');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [session, showToast]);

  useEffect(() => {
    if (isOpen && session) {
      fetchMonitorData();
    } else {
      setData(null);
    }
  }, [isOpen, session, fetchMonitorData]);

  // Auto-refresh timer
  useEffect(() => {
    if (!isOpen || autoRefreshInterval === 0 || !session) return;

    const timer = setInterval(() => {
      fetchMonitorData(true);
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [isOpen, autoRefreshInterval, session, fetchMonitorData]);

  const handleGenerateRandomToken = async () => {
    if (!session) return;
    // Generate 6-digit random token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratingToken(true);
    try {
      await sessionService.generateAccessCode(session.id, token);
      setCustomToken(token);
      showToast(`Token Sesi Berhasil Dirilis: ${token}`, 'success');
      fetchMonitorData(true);
      if (onSessionUpdated) onSessionUpdated();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal merilis token sesi', 'error');
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleSetCustomToken = async () => {
    if (!session || !customToken.trim()) return;
    setGeneratingToken(true);
    try {
      await sessionService.generateAccessCode(session.id, customToken.trim());
      showToast(`Token akses sesi diperbarui menjadi: ${customToken.trim()}`, 'success');
      fetchMonitorData(true);
      if (onSessionUpdated) onSessionUpdated();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal mengatur token akses', 'error');
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleExtendAll = async () => {
    if (!session) return;
    const mins = parseInt(extendAllMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      showToast('Durasi penambahan waktu minimal 1 menit', 'error');
      return;
    }

    setExtendingAll(true);
    try {
      await sessionService.extendAllSession(session.id, mins);
      showToast(`Waktu seluruh peserta aktif berhasil diperpanjang +${mins} menit!`, 'success');
      setExtendAllOpen(false);
      fetchMonitorData(true);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal memperpanjang waktu sesi massal', 'error');
    } finally {
      setExtendingAll(false);
    }
  };

  const handleOpenExtendIndiv = (p: ParticipantMonitor) => {
    setSelectedParticipant(p);
    setExtendIndivMinutes('10');
    setExtendIndivReason('Kendala teknis lab / komputer restart');
    setExtendIndivOpen(true);
  };

  const handleExtendIndivSubmit = async () => {
    if (!selectedParticipant || !selectedParticipant.attempt_id) return;
    const mins = parseInt(extendIndivMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      showToast('Durasi minimal 1 menit', 'error');
      return;
    }
    if (!extendIndivReason.trim()) {
      showToast('Alasan penambahan waktu wajib diisi', 'error');
      return;
    }

    setExtendingIndiv(true);
    try {
      await attemptService.extendAttempt(selectedParticipant.attempt_id, mins, extendIndivReason.trim());
      showToast(`Waktu ${selectedParticipant.full_name} berhasil ditambah +${mins} menit!`, 'success');
      setExtendIndivOpen(false);
      fetchMonitorData(true);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal menambah waktu peserta', 'error');
    } finally {
      setExtendingIndiv(false);
    }
  };

  const handleOpenVoidModal = (p: ParticipantMonitor) => {
    setSelectedParticipant(p);
    setVoidReason('Terbukti membuka tab lain / kecurangan berulang di lab.');
    setVoidModalOpen(true);
  };

  const handleVoidSubmit = async () => {
    if (!selectedParticipant || !selectedParticipant.attempt_id) return;
    if (!voidReason.trim()) {
      showToast('Alasan diskualifikasi wajib diisi', 'error');
      return;
    }

    setVoiding(true);
    try {
      await attemptService.voidAttempt(selectedParticipant.attempt_id, voidReason.trim());
      showToast(`Percobaan ujian ${selectedParticipant.full_name} telah DIBATALKAN (VOID).`, 'warning');
      setVoidModalOpen(false);
      fetchMonitorData(true);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal membatalkan ujian peserta', 'error');
    } finally {
      setVoiding(false);
    }
  };

  const handleViewEvents = async (p: ParticipantMonitor) => {
    if (!p.attempt_id) return;
    setSelectedParticipant(p);
    setEventsModalOpen(true);
    setLoadingEvents(true);
    try {
      const logs = await attemptService.getAttemptEvents(p.attempt_id);
      setParticipantEvents(logs || []);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal memuat log pelanggaran', 'error');
    } finally {
      setLoadingEvents(false);
    }
  };

  if (!isOpen || !session) return null;

  // Filter participants
  const participants = data?.participants || [];
  const filteredParticipants = participants.filter((p) => {
    const matchesSearch =
      p.identifier.toLowerCase().includes(search.toLowerCase()) ||
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.institution || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'in_progress') return p.attempt_status === 'in_progress';
    if (statusFilter === 'submitted') return p.attempt_status === 'submitted' || p.attempt_status === 'auto_submitted';
    if (statusFilter === 'violation') return Number(p.violation_count || 0) > 0;
    if (statusFilter === 'void') return p.attempt_status === 'void';
    return true;
  });

  const totalViolations = participants.reduce((acc, curr) => acc + Number(curr.violation_count || 0), 0);
  const totalVoidCount = participants.filter((p) => p.attempt_status === 'void').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🚨 Ruang Pengawas Lab (Live Proctoring & Monitoring)"
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {/* Header Information & Live Status Banner */}
        <div className="bg-gradient-to-r from-[#2a1b4e] to-[#43236e] p-4 rounded-xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-400 text-[#2a1b4e] text-xs font-bold tracking-wide">
                {session.code}
              </span>
              <h3 className="font-bold text-lg">{session.name}</h3>
            </div>
            <p className="text-xs text-purple-200 mt-1">
              {data?.session?.exam_title || 'Ujian Kompetensi FIA UNIRA'} • Durasi: {data?.session?.duration_minutes || 90} Menit • Passing Grade: {data?.session?.passing_score || 65}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Auto refresh control */}
            <div className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Auto-refresh:</span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-purple-900/60 text-white border border-purple-400/30 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-purple-300"
              >
                <option value={3}>3 Detik</option>
                <option value={5}>5 Detik</option>
                <option value={10}>10 Detik</option>
                <option value={0}>Mati (Manual)</option>
              </select>
            </div>

            <Button
              variant="secondary"
              onClick={() => fetchMonitorData()}
              disabled={loading}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs min-h-[36px] px-3 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Segarkan
            </Button>

            <Button
              onClick={() => setExtendAllOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-[#24212b] font-bold text-xs min-h-[36px] px-3 flex items-center gap-1.5 shadow"
            >
              <Zap className="w-3.5 h-3.5" />
              + Waktu Massal Lab
            </Button>
          </div>
        </div>

        {/* Token Access Code Banner & Release Section */}
        <div className="bg-[#fcfaff] border border-[#e5dcf2] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#eae2f5] text-[#583682] rounded-lg">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#595562] uppercase tracking-wider">
                Token Rilis Masuk Sesi Ujian (Lab Access Code)
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-black tracking-widest text-[#583682] font-mono">
                  {customToken || (data?.session?.has_access_code ? 'AKTIF (Telah Diatur)' : 'BELUM DIRILIS')}
                </span>
                {customToken && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(customToken);
                      showToast('Token disalin ke clipboard!', 'info');
                    }}
                    className="p-1 text-gray-500 hover:text-[#583682] transition"
                    title="Salin Token"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="text-[11px] text-[#716c7a]">
                Tulis kode ini di papan tulis lab setelah seluruh peserta siap di depan komputer.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={customToken}
              onChange={(e) => setCustomToken(e.target.value.toUpperCase())}
              placeholder="Ketik / Kode 6-Digit"
              className="w-36 text-center font-mono font-bold tracking-widest uppercase text-sm"
              maxLength={12}
            />
            <Button
              variant="secondary"
              onClick={handleSetCustomToken}
              disabled={generatingToken || !customToken.trim()}
              className="text-xs min-h-[38px] px-3"
            >
              Simpan
            </Button>
            <Button
              onClick={handleGenerateRandomToken}
              disabled={generatingToken}
              className="bg-[#583682] hover:bg-[#43236e] text-white text-xs font-semibold whitespace-nowrap min-h-[38px] px-3"
            >
              <Zap className="w-3.5 h-3.5 mr-1" />
              Acak Token Baru
            </Button>
          </div>
        </div>

        {/* Realtime KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white border border-[#eae2f5] p-3 rounded-xl shadow-xs">
            <div className="text-xs text-[#595562] font-medium flex items-center justify-between">
              <span>Total Peserta</span>
              <Users className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-[#24212b] mt-1">
              {data?.summary.total_enrolled || 0}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Kapasitas: {session.capacity || 27}</div>
          </div>

          <div className="bg-blue-50/60 border border-blue-200 p-3 rounded-xl shadow-xs">
            <div className="text-xs text-blue-700 font-medium flex items-center justify-between">
              <span>Mengerjakan</span>
              <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
            </div>
            <div className="text-xl font-bold text-blue-900 mt-1">
              {data?.summary.in_progress || 0}
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">Sedang aktif di lab</div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-xl shadow-xs">
            <div className="text-xs text-emerald-700 font-medium flex items-center justify-between">
              <span>Selesai / Submit</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-emerald-900 mt-1">
              {data?.summary.submitted || 0}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Terkumpul ke server</div>
          </div>

          <div className="bg-red-50/60 border border-red-200 p-3 rounded-xl shadow-xs">
            <div className="text-xs text-red-700 font-medium flex items-center justify-between">
              <span>Pelanggaran Tab</span>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-xl font-bold text-red-700 mt-1">
              {totalViolations}
            </div>
            <div className="text-[10px] text-red-600 mt-0.5">Keluar jendela ujian</div>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl shadow-xs">
            <div className="text-xs text-gray-700 font-medium flex items-center justify-between">
              <span>Mangkir / Void</span>
              <Ban className="w-4 h-4 text-gray-500" />
            </div>
            <div className="text-xl font-bold text-gray-900 mt-1">
              {totalVoidCount} <span className="text-xs font-normal text-gray-500">/ {data?.summary.absent || 0} abs</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">Gugur / Didiskualifikasi</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari NIM, Nama Peserta, atau Instansi..."
              className="w-full !pl-10 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#583682]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                statusFilter === 'all'
                  ? 'bg-[#583682] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Semua ({participants.length})
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                statusFilter === 'in_progress'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Mengerjakan ({data?.summary.in_progress || 0})
            </button>
            <button
              onClick={() => setStatusFilter('submitted')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                statusFilter === 'submitted'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Selesai ({data?.summary.submitted || 0})
            </button>
            <button
              onClick={() => setStatusFilter('violation')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                statusFilter === 'violation'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              Ada Pelanggaran
            </button>
            <button
              onClick={() => setStatusFilter('void')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                statusFilter === 'void'
                  ? 'bg-gray-800 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Void ({totalVoidCount})
            </button>
          </div>
        </div>

        {/* Live Participants Table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs bg-white">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8fafc] text-gray-600 border-b border-gray-200 sticky top-0 z-10 font-bold">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">No</th>
                  <th className="py-2.5 px-4">Peserta & NIM</th>
                  <th className="py-2.5 px-4">Status Ujian</th>
                  <th className="py-2.5 px-4">Kemajuan Soal</th>
                  <th className="py-2.5 px-4">Pelanggaran</th>
                  <th className="py-2.5 px-4">Nilai / Hasil</th>
                  <th className="py-2.5 px-4 text-right">Aksi Pengawas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      Tidak ada peserta yang cocok dengan filter atau kata kunci.
                    </td>
                  </tr>
                ) : (
                  filteredParticipants.map((p, idx) => {
                    const violationNum = Number(p.violation_count || 0);
                    const isVoid = p.attempt_status === 'void';
                    const isInProgress = p.attempt_status === 'in_progress';
                    const isDone = p.attempt_status === 'submitted' || p.attempt_status === 'auto_submitted';

                    return (
                      <tr
                        key={p.enrollment_id}
                        className={`hover:bg-[#faf9fc] transition ${
                          isVoid ? 'bg-red-50/40 opacity-70' : violationNum > 0 ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center font-medium text-gray-400">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#24212b]">{p.full_name}</div>
                          <div className="text-[11px] text-[#595562] font-mono mt-0.5">{p.identifier}</div>
                          <div className="text-[10px] text-gray-400">{p.institution || 'FIA UNIRA'}</div>
                        </td>
                        <td className="py-3 px-4">
                          {isVoid ? (
                            <div>
                              <Badge variant="danger">DISKUALIFIKASI (VOID)</Badge>
                              {p.void_reason && (
                                <div className="text-[10px] text-red-600 mt-0.5 max-w-[150px] truncate" title={p.void_reason}>
                                  {p.void_reason}
                                </div>
                              )}
                            </div>
                          ) : isInProgress ? (
                            <Badge variant="purple" className="flex items-center gap-1 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                              Sedang Mengerjakan
                            </Badge>
                          ) : isDone ? (
                            <Badge variant="success">Selesai</Badge>
                          ) : (
                            <Badge variant="neutral">Belum Masuk</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {p.attempt_id ? (
                            <div>
                              <div className="font-semibold text-gray-800">
                                {p.answered_count} <span className="text-gray-400 font-normal">/ {session.capacity ? 'Soal' : 'Soal'}</span>
                              </div>
                              {Number(p.flagged_count) > 0 && (
                                <div className="text-[10px] text-amber-600 font-medium">
                                  🚩 {p.flagged_count} ragu-ragu
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {violationNum > 0 ? (
                            <button
                              onClick={() => handleViewEvents(p)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[11px] hover:bg-red-200 transition"
                              title="Klik untuk melihat detail kejadian pelanggaran"
                            >
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              <span>{violationNum}x Peringatan</span>
                            </button>
                          ) : (
                            <span className="text-emerald-600 text-[11px] font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Bersih
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {p.score !== undefined && p.score !== null ? (
                            <div>
                              <span className="font-bold text-sm text-[#24212b]">{p.score}</span>
                              <span className="text-gray-400 text-[10px]"> / 100</span>
                              <div>
                                {p.passed ? (
                                  <span className="text-[10px] font-bold text-emerald-600">LULUS</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-red-600">TIDAK LULUS</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Tombol Lihat Log Pelanggaran */}
                            {p.attempt_id && (
                              <button
                                onClick={() => handleViewEvents(p)}
                                className="p-1.5 text-gray-500 hover:text-[#583682] hover:bg-[#eae2f5] rounded transition"
                                title="Lihat Log Event / Pelanggaran Peserta"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Tombol Tambah Waktu Peserta */}
                            {isInProgress && (
                              <button
                                onClick={() => handleOpenExtendIndiv(p)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[11px] font-medium transition flex items-center gap-1"
                                title="Tambah Waktu Khusus untuk Peserta Ini"
                              >
                                <Clock className="w-3 h-3" />
                                <span>+Waktu</span>
                              </button>
                            )}

                            {/* Tombol Diskualifikasi Void */}
                            {p.attempt_id && !isVoid && (
                              <button
                                onClick={() => handleOpenVoidModal(p)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                                title="Diskualifikasi / Void Ujian Peserta"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info & close */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-500 gap-2 border-t border-gray-100 pt-3">
          <div>
            Terakhir diperbarui: <span className="font-medium text-gray-700">{lastRefreshedAt.toLocaleTimeString('id-ID')} WIB</span>
          </div>
          <Button variant="secondary" className="min-h-[36px] px-4" onClick={onClose}>
            Tutup Ruang Pengawas
          </Button>
        </div>
      </div>

      {/* MODAL 1: PERPANJANG WAKTU MASSAL SATU LAB */}
      <Modal
        isOpen={extendAllOpen}
        onClose={() => setExtendAllOpen(false)}
        title="⚡ Tambah Waktu Darurat Sesi (Massal Satu Lab)"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-600">
            Aksi ini akan menambahkan durasi waktu pengerjaan untuk <strong>seluruh peserta yang saat ini sedang aktif (in_progress)</strong> di ruangan lab ini.
          </p>

          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Tambahan Durasi (Menit):
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {['5', '10', '15', '30'].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setExtendAllMinutes(val)}
                  className={`py-1.5 text-center font-bold rounded-lg border transition ${
                    extendAllMinutes === val
                      ? 'bg-[#583682] text-white border-[#583682]'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  +{val} mnt
                </button>
              ))}
            </div>
            <Input
              type="number"
              value={extendAllMinutes}
              onChange={(e) => setExtendAllMinutes(e.target.value)}
              placeholder="Jumlah menit (1-60)"
              min={1}
              max={60}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="secondary" className="min-h-[36px] px-4" onClick={() => setExtendAllOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleExtendAll}
              disabled={extendingAll}
              className="bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold min-h-[36px] px-4"
            >
              {extendingAll ? 'Memproses...' : 'Terapkan ke Seluruh Lab'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: PERPANJANG WAKTU INDIVIDUAL */}
      <Modal
        isOpen={extendIndivOpen}
        onClose={() => setExtendIndivOpen(false)}
        title="⏱️ Tambah Waktu Khusus Peserta"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
            <div className="font-bold text-purple-900">{selectedParticipant?.full_name}</div>
            <div className="text-[11px] text-purple-700">NIM: {selectedParticipant?.identifier}</div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Durasi Perpanjangan (Menit):
            </label>
            <Input
              type="number"
              value={extendIndivMinutes}
              onChange={(e) => setExtendIndivMinutes(e.target.value)}
              min={1}
              max={60}
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Alasan Penambahan Waktu (Wajib untuk Audit):
            </label>
            <textarea
              value={extendIndivReason}
              onChange={(e) => setExtendIndivReason(e.target.value)}
              rows={3}
              placeholder="Contoh: Komputer lab sempat restart selama 5 menit karena kendala listrik..."
              className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#583682]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="secondary" className="min-h-[36px] px-4" onClick={() => setExtendIndivOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleExtendIndivSubmit}
              disabled={extendingIndiv}
              className="bg-[#583682] hover:bg-[#43236e] text-white font-bold min-h-[36px] px-4"
            >
              {extendingIndiv ? 'Menyimpan...' : 'Tambah Waktu'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: VOID / DISKUALIFIKASI KECURANGAN */}
      <Modal
        isOpen={voidModalOpen}
        onClose={() => setVoidModalOpen(false)}
        title="🚫 Diskualifikasi Peserta (Void Ujian)"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-red-900">
            <p className="font-bold">PERINGATAN: Tindakan ini permanen.</p>
            <p className="mt-1">
              Hasil pengerjaan <strong>{selectedParticipant?.full_name} ({selectedParticipant?.identifier})</strong> akan dibatalkan, status dinyatakan VOID, dan peserta tidak akan menerima nilai.
            </p>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Alasan Diskualifikasi (Tercatat di Berita Acara & Audit):
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              placeholder="Contoh: Terbukti berulang kali membuka catatan dan tidak mengindahkan teguran pengawas..."
              className="w-full text-xs p-2 border border-red-200 rounded-lg focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="secondary" className="min-h-[36px] px-4" onClick={() => setVoidModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={handleVoidSubmit}
              disabled={voiding}
              className="min-h-[36px] px-4"
            >
              {voiding ? 'Memproses Diskualifikasi...' : 'Diskualifikasi Sekarang'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: LOG PELANGGARAN & EVENT PESERTA */}
      <Modal
        isOpen={eventsModalOpen}
        onClose={() => setEventsModalOpen(false)}
        title="📋 Rekaman Log Pelanggaran & Aktivitas Layar"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 flex justify-between items-center">
            <div>
              <span className="font-bold text-gray-800">{selectedParticipant?.full_name}</span>
              <div className="text-[11px] text-gray-500">NIM: {selectedParticipant?.identifier}</div>
            </div>
            <Badge variant="purple">Total Log: {participantEvents.length}</Badge>
          </div>

          <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg">
            {loadingEvents ? (
              <div className="p-6 text-center text-gray-400">Memuat log kejadian...</div>
            ) : participantEvents.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                Tidak ada catatan event khusus yang terekam pada peserta ini.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 sticky top-0 border-b">
                  <tr>
                    <th className="py-2 px-3">Waktu Kejadian</th>
                    <th className="py-2 px-3">Jenis Kejadian</th>
                    <th className="py-2 px-3">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {participantEvents.map((ev, i) => (
                    <tr key={ev.id || i} className="hover:bg-gray-50">
                      <td className="py-2 px-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        {new Date(ev.occurred_at).toLocaleTimeString('id-ID')}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          {ev.event_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-600 text-[11px]">
                        {ev.detail ? JSON.stringify(ev.detail) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button variant="secondary" className="min-h-[36px] px-4" onClick={() => setEventsModalOpen(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
};
