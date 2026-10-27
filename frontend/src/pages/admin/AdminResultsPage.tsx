import React, { useEffect, useState } from 'react';
import { resultService, sessionService, reportService } from '../../services';
import { ExamResult, Appeal, ExamSession, ResultDetail } from '../../types';
import { useToast } from '../../context/ToastContext';
import { alert } from '../../utils/alert';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { ExamItemAnalysisTab } from '../../components/results/ExamItemAnalysisTab';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import {
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  Filter,
  Check,
  X,
  FileText,
  BarChart3,
  Eye,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

export const AdminResultsPage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'results' | 'appeals' | 'item_analysis'>('results');

  const [results, setResults] = useState<ExamResult[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSessionFilter, setSelectedSessionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Sanggah Resolution Modal
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [activeAppeal, setActiveAppeal] = useState<Appeal | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'approved' | 'rejected'>('approved');
  const [adminNotes, setAdminNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  // Detail Transkrip Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedResultDetail, setSelectedResultDetail] = useState<ResultDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resData, appData, sessData] = await Promise.all([
        resultService.getResults({ session_id: selectedSessionFilter || undefined }),
        resultService.getAppeals(),
        sessionService.getSessions(),
      ]);
      setResults(resData);
      setAppeals(appData);
      setSessions(sessData);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat hasil ujian & sanggahan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSessionFilter]);

  const openResolveAppealModal = (appeal: Appeal) => {
    setActiveAppeal(appeal);
    setResolutionStatus('approved');
    setAdminNotes('');
    setResolveModalOpen(true);
  };

  const handleResolveAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppeal) return;
    setResolving(true);
    try {
      await resultService.resolveAppeal(activeAppeal.id, resolutionStatus, adminNotes.trim());
      alert.toast(
        resolutionStatus === 'approved'
          ? 'Sanggahan diterima dan disetujui!'
          : 'Sanggahan ditolak dengan catatan resmi.',
        'success'
      );
      setResolveModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert.error('Gagal Memproses Sanggahan', err?.response?.data?.message || err.message);
    } finally {
      setResolving(false);
    }
  };

  const filteredResults = results.filter((r) => {
    const studentName = (r.student_name || r.full_name || '').toLowerCase();
    const identifier = (r.identifier || '').toLowerCase();
    const examTitle = (r.exam_title || '').toLowerCase();
    const term = (search || '').toLowerCase();
    return (
      studentName.includes(term) ||
      identifier.includes(term) ||
      examTitle.includes(term)
    );
  });

  const pendingAppealsCount = appeals.filter(
    (a) => a.status === 'pending' || (a.status as any) === 'open'
  ).length;

  const handleViewDetail = async (resultId: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const data = await resultService.getResultById(resultId);
      setSelectedResultDetail(data);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat detail transkrip nilai peserta.', 'error');
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDownloadCert = async (certId: string, studentName: string) => {
    try {
      const blob = await resultService.downloadCertificatePDF(certId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sertifikat_${(studentName || 'Peserta').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Sertifikat kelulusan berhasil diunduh!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunduh sertifikat.', 'error');
    }
  };

  const handleExportSessionCSV = async () => {
    if (!selectedSessionFilter) return;
    setExportingCSV(true);
    try {
      const blob = await reportService.exportSessionCSV(selectedSessionFilter);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rekap_Nilai_Sesi_${selectedSessionFilter.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Rekap nilai sesi berhasil diekspor ke format CSV!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengekspor CSV rekap sesi.', 'error');
    } finally {
      setExportingCSV(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">HASIL & SANGGAHAN</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Hasil Ujian & Sanggahan
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Pantau pencapaian nilai peserta berdasarkan ambang batas kelulusan dan tindak lanjuti sanggahan.
          </p>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchData} />}

      {/* Tabs Switcher */}
      <div className="flex items-center gap-3 border-b border-[#e6e1eb]">
        <button
          onClick={() => setActiveTab('results')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
            activeTab === 'results'
              ? 'border-[#583682] text-[#583682]'
              : 'border-transparent text-[#595562] hover:text-[#583682]'
          }`}
        >
          Hasil Penilaian ({results.length})
        </button>

        <button
          onClick={() => setActiveTab('appeals')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
            activeTab === 'appeals'
              ? 'border-[#583682] text-[#583682]'
              : 'border-transparent text-[#595562] hover:text-[#583682]'
          }`}
        >
          <span>Sanggahan Peserta ({appeals.length})</span>
          {pendingAppealsCount > 0 && (
            <span className="bg-[#b63b48] text-white px-1.5 py-0.2 rounded-full text-[10px]">
              {pendingAppealsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('item_analysis')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center gap-1.5 ${
            activeTab === 'item_analysis'
              ? 'border-[#583682] text-[#583682]'
              : 'border-transparent text-[#595562] hover:text-[#583682]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analisis Butir Soal</span>
        </button>
      </div>

      {/* TAB 1: RESULTS */}
      {activeTab === 'results' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Cari peserta"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-gray-400" />}
              />
            </div>

            <div className="w-full sm:w-72">
              <select
                value={selectedSessionFilter}
                onChange={(e) => setSelectedSessionFilter(e.target.value)}
                className="w-full h-[46px] px-3.5 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none"
              >
                <option value="">Semua Sesi Ujian</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {selectedSessionFilter && (
              <Button
                variant="secondary"
                onClick={handleExportSessionCSV}
                isLoading={exportingCSV}
                leftIcon={<FileSpreadsheet className="w-4 h-4 text-[#287a58]" />}
                className="text-xs h-[46px] shrink-0"
                title="Ekspor CSV"
              >
                Ekspor CSV
              </Button>
            )}
          </div>

          <Card hasShadow className="overflow-hidden p-0">
            {loading ? (
              <div className="p-6">
                <CardSkeleton />
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="Belum Ada Hasil Ujian"
                  description="Peserta yang menyelesaikan ujian akan otomatis muncul di sini."
                  icon={<Award className="w-8 h-8 text-[#583682]" />}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-6 py-3.5">NIM / No. Peserta</th>
                      <th className="px-6 py-3.5">Nama Peserta</th>
                      <th className="px-6 py-3.5">Ujian / Sesi</th>
                      <th className="px-6 py-3.5">Skor Akhir</th>
                      <th className="px-6 py-3.5">Kelulusan</th>
                      <th className="px-6 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6e1eb]">
                    {filteredResults.map((r) => (
                      <tr key={r.id} className="hover:bg-[#faf9fc]/80 transition">
                        <td className="px-6 py-4 font-mono font-bold text-[#583682]">
                          {r.identifier || '-'}
                        </td>
                        <td className="px-6 py-4 font-bold text-[#24212b]">
                          {r.student_name || r.full_name || '-'}
                        </td>
                        <td className="px-6 py-4 text-[#595562]">
                          <div>{r.exam_title}</div>
                          <div className="text-[10px] text-gray-400">{r.session_name}</div>
                        </td>
                        <td className="px-6 py-4 font-extrabold text-sm text-[#24212b]">
                          {r.score} <span className="text-[10px] font-normal text-gray-400">/ 100</span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={r.passed ? 'success' : 'danger'}>
                            {r.passed ? 'LULUS' : 'TIDAK LULUS'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleViewDetail(r.id)}
                              className="p-1.5 text-gray-500 hover:text-[#583682] hover:bg-[#eae2f5] rounded transition cursor-pointer"
                              title="Lihat Transkrip"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {r.passed && (r as any).certificate_id && (
                              <button
                                onClick={() =>
                                  handleDownloadCert(
                                    (r as any).certificate_id,
                                    r.student_name || r.full_name || 'Peserta'
                                  )
                                }
                                className="p-1.5 text-gray-500 hover:text-[#287a58] hover:bg-[#eaf4ef] rounded transition cursor-pointer"
                                title="Unduh Sertifikat PDF"
                              >
                                <Download className="w-4 h-4" />
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
        </div>
      )}

      {/* TAB 2: APPEALS (SANGGAHAN) */}
      {activeTab === 'appeals' && (
        <Card hasShadow className="overflow-hidden p-0">
          {appeals.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="Tidak Ada Sanggahan Nilai"
                description="Peserta belum mengajukan sanggahan kunci jawaban."
                icon={<HelpCircle className="w-8 h-8 text-[#583682]" />}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-3.5">Peserta</th>
                    <th className="px-6 py-3.5">Ujian</th>
                    <th className="px-6 py-3.5">Alasan Sanggahan</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Tanggal</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e1eb]">
                  {appeals.map((app) => (
                    <tr key={app.id} className="hover:bg-[#faf9fc]/80 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-[#24212b]">
                          {app.student_name || app.full_name || '-'}
                        </div>
                        <div className="font-mono text-[11px] text-[#583682]">
                          {app.identifier || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#595562]">{app.exam_title || 'Uji Kompetensi'}</td>
                      <td className="px-6 py-4 max-w-sm">
                        <div className="text-xs text-[#24212b] leading-relaxed line-clamp-3">
                          {app.reason || app.message || '-'}
                        </div>
                        {(app.admin_notes || app.response) && (
                          <div className="mt-1 text-[11px] text-[#583682] italic bg-[#faf9fc] p-1.5 rounded border border-[#e6e1eb]">
                            Catatan Panitia: {app.admin_notes || app.response}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            app.status === 'approved' || (app.status as any) === 'accepted'
                              ? 'success'
                              : app.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {app.status === 'approved' || (app.status as any) === 'accepted'
                            ? 'DISETUJUI'
                            : app.status === 'rejected'
                            ? 'DITOLAK'
                            : 'MENUNGGU'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {new Date(app.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(app.status === 'pending' || (app.status as any) === 'open') && (
                          <Button
                            variant="secondary"
                            className="text-[11px] min-h-[30px] px-2.5"
                            onClick={() => openResolveAppealModal(app)}
                          >
                            Tanggapi
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: ITEM ANALYSIS */}
      {activeTab === 'item_analysis' && <ExamItemAnalysisTab />}

      {/* Sanggah Decision Modal */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Tanggapi Sanggahan Nilai"
        description={`Peserta: ${activeAppeal?.student_name || activeAppeal?.full_name || '-'} (${activeAppeal?.identifier || '-'})`}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="ghost" onClick={() => setResolveModalOpen(false)} className="text-xs">
              Batal
            </Button>
            <Button type="submit" form="resolve-appeal-form" variant="primary" isLoading={resolving} className="text-xs">
              Simpan Keputusan
            </Button>
          </div>
        }
      >
        <form id="resolve-appeal-form" onSubmit={handleResolveAppeal} className="space-y-4">
          <div className="p-3 bg-[#faf9fc] rounded border border-[#e6e1eb] text-xs">
            <strong className="text-[#24212b] block mb-1">Alasan Peserta:</strong>
            <p className="text-[#595562] italic leading-relaxed">{activeAppeal?.reason || activeAppeal?.message || '-'}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">Keputusan</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2 p-3 rounded border cursor-pointer text-xs font-bold transition ${
                  resolutionStatus === 'approved'
                    ? 'bg-[#eaf4ef] border-[#287a58] text-[#287a58]'
                    : 'bg-white border-[#e6e1eb] text-[#595562]'
                }`}
              >
                <input
                  type="radio"
                  name="appeal_status"
                  value="approved"
                  checked={resolutionStatus === 'approved'}
                  onChange={() => setResolutionStatus('approved')}
                  className="w-4 h-4 accent-[#287a58]"
                />
                <span>Setujui</span>
              </label>

              <label
                className={`flex items-center gap-2 p-3 rounded border cursor-pointer text-xs font-bold transition ${
                  resolutionStatus === 'rejected'
                    ? 'bg-[#fbeeed] border-[#b63b48] text-[#b63b48]'
                    : 'bg-white border-[#e6e1eb] text-[#595562]'
                }`}
              >
                <input
                  type="radio"
                  name="appeal_status"
                  value="rejected"
                  checked={resolutionStatus === 'rejected'}
                  onChange={() => setResolutionStatus('rejected')}
                  className="w-4 h-4 accent-[#b63b48]"
                />
                <span>Tolak</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Catatan untuk Peserta <span className="text-[#b63b48]">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Catatan pertimbangan"
              className="w-full p-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b] outline-none focus:border-[#583682]"
            />
          </div>
        </form>
      </Modal>

      {/* Detail Transkrip & Lembar Jawaban Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedResultDetail(null);
        }}
        title="Transkrip Lembar Jawaban"
        description={`Peserta: ${selectedResultDetail?.student_name || selectedResultDetail?.full_name || '-'} (${selectedResultDetail?.identifier || '-'})`}
        maxWidth="3xl"
        footer={
          <div className="flex items-center justify-end w-full">
            <Button
              variant="secondary"
              onClick={() => {
                setDetailModalOpen(false);
                setSelectedResultDetail(null);
              }}
            >
              Tutup
            </Button>
          </div>
        }
      >
        {loadingDetail ? (
          <div className="py-8">
            <CardSkeleton />
          </div>
        ) : !selectedResultDetail ? (
          <p className="text-xs text-gray-500 py-4 text-center">Data hasil penilaian tidak ditemukan.</p>
        ) : (
          <div className="space-y-6">
            {/* Header Ringkasan Peserta */}
            <div className="p-4 bg-[#faf9fc] rounded-[8px] border border-[#e6e1eb] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[11px] text-[#595562] block">Nama & NIM:</span>
                <strong className="text-[#24212b] block">{selectedResultDetail.student_name || selectedResultDetail.full_name}</strong>
                <span className="font-mono text-[11px] text-[#583682]">{selectedResultDetail.identifier}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#595562] block">Ujian & Sesi:</span>
                <strong className="text-[#24212b] block">{selectedResultDetail.exam_title}</strong>
                <span className="text-[11px] text-gray-400">{selectedResultDetail.session_name}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#595562] block">Skor:</span>
                <div className="text-base font-extrabold text-[#583682]">
                  {selectedResultDetail.score} <span className="text-xs font-normal text-gray-400">/ 100</span>
                </div>
                <span className="text-[10px] text-[#595562]">Ambang: {selectedResultDetail.passing_score}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#595562] block mb-1">Kelulusan:</span>
                <Badge variant={selectedResultDetail.passed ? 'success' : 'danger'}>
                  {selectedResultDetail.passed ? 'LULUS' : 'TIDAK LULUS'}
                </Badge>
              </div>
            </div>

            {/* Riwayat Jawaban Butir Soal */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-[#e6e1eb]">
                <h4 className="text-xs font-bold text-[#24212b] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#583682]" />
                  <span>Rincian Jawaban ({selectedResultDetail.answers?.length || 0} Soal)</span>
                </h4>
              </div>

              {(!selectedResultDetail.answers || selectedResultDetail.answers.length === 0) ? (
                <div className="p-4 bg-gray-50 rounded text-center text-xs text-[#595562]">
                  Detail lembar jawaban tidak tersedia.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedResultDetail.answers.map((ans: any, idx: number) => {
                    const isCorrect = ans.is_correct === true;
                    const isAnswered = !!ans.selected_label;

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-[8px] border text-xs space-y-2 transition ${
                          isCorrect
                            ? 'bg-[#eaf4ef]/40 border-[#bce2cf]'
                            : isAnswered
                            ? 'bg-[#fbeeed]/40 border-[#f3c5c9]'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#583682] text-white flex items-center justify-center font-bold text-[11px]">
                              {ans.position || idx + 1}
                            </span>
                            <Badge variant={isCorrect ? 'success' : isAnswered ? 'danger' : 'neutral'}>
                              {isCorrect ? 'BENAR' : isAnswered ? 'SALAH' : 'KOSONG'}
                            </Badge>
                          </div>
                          <span className="font-mono text-[11px] text-gray-500">
                            Poin: <strong>{ans.points_awarded ?? 0}</strong> / {ans.weight ?? 1}
                          </span>
                        </div>

                        {/* Stem Pertanyaan */}
                        <p className="text-[#24212b] font-medium leading-relaxed">
                          {ans.stem}
                        </p>

                        {/* Jawaban Siswa vs Kunci Jawaban */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                          <div className={`p-2 rounded border ${
                            isCorrect
                              ? 'bg-[#eaf4ef] border-[#bce2cf] text-[#287a58]'
                              : isAnswered
                              ? 'bg-[#fbeeed] border-[#f3c5c9] text-[#b63b48]'
                              : 'bg-gray-100 border-gray-200 text-gray-500'
                          }`}>
                            <span className="font-bold block text-[10px] uppercase">Jawaban Peserta:</span>
                            <span>{isAnswered ? `${ans.selected_label}. ${ans.selected_text || ''}` : '(Kosong)'}</span>
                          </div>

                          <div className="p-2 rounded border bg-[#eaf4ef] border-[#bce2cf] text-[#287a58]">
                            <span className="font-bold block text-[10px] uppercase">Kunci Resmi:</span>
                            <span>{ans.correct_label}. {ans.correct_text || ''}</span>
                          </div>
                        </div>

                        {/* Pembahasan / Penjelasan */}
                        {ans.explanation && (
                          <div className="p-2 bg-[#faf9fc] rounded border border-[#e6e1eb] text-[11px] text-[#595562] italic">
                            <span className="font-bold text-[#583682] not-italic block">Pembahasan:</span>
                            {ans.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
