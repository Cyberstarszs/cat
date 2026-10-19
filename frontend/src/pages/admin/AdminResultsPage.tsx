import React, { useEffect, useState } from 'react';
import { resultService, sessionService } from '../../services';
import { ExamResult, Appeal, ExamSession } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import {
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Send,
  Search,
  Filter,
  Check,
  X,
  FileText,
} from 'lucide-react';

export const AdminResultsPage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'results' | 'appeals'>('results');

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

  // Bulk publish
  const [publishing, setPublishing] = useState(false);

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

  const handlePublishSingle = async (resultId: string) => {
    try {
      await resultService.publishResult(resultId);
      showToast('Hasil penilaian berhasil dipublikasikan ke peserta!', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mempublikasikan hasil.', 'error');
    }
  };

  const handleBulkPublishSession = async () => {
    if (!selectedSessionFilter) {
      showToast('Pilih filter sesi terlebih dahulu untuk mempublikasikan sekaligus.', 'warning');
      return;
    }
    setPublishing(true);
    try {
      await resultService.publishSessionResults(selectedSessionFilter);
      showToast('Seluruh hasil ujian sesi ini berhasil dipublikasikan!', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mempublikasikan sesi.', 'error');
    } finally {
      setPublishing(false);
    }
  };

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
      showToast(
        resolutionStatus === 'approved'
          ? 'Sanggahan diterima dan disetujui!'
          : 'Sanggahan ditolak dengan catatan resmi.',
        'success'
      );
      setResolveModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses keputusan sanggahan.', 'error');
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">EVALUASI & TRANSPARANSI</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Hasil Penilaian & Sanggahan Nilai
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Publikasikan hasil ujian peserta dan tinjau sanggahan keberatan kunci jawaban secara resmi.
          </p>
        </div>

        {selectedSessionFilter && activeTab === 'results' && (
          <Button
            variant="primary"
            onClick={handleBulkPublishSession}
            isLoading={publishing}
            leftIcon={<Send className="w-4 h-4" />}
            className="text-xs bg-[#287a58] border-[#287a58] hover:bg-[#206346]"
          >
            Publikasikan Hasil Sesi Ini
          </Button>
        )}
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
          Daftar Hasil Penilaian ({results.length})
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
      </div>

      {/* TAB 1: RESULTS */}
      {activeTab === 'results' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Cari nama atau NIM peserta..."
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
                  description="Peserta yang telah menyelesaikan sesi ujian atau difinalisasi akan otomatis muncul di sini."
                  icon={<Award className="w-8 h-8 text-[#583682]" />}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-6 py-3.5">NIM</th>
                      <th className="px-6 py-3.5">Nama Peserta</th>
                      <th className="px-6 py-3.5">Ujian / Sesi</th>
                      <th className="px-6 py-3.5">Skor Akhir</th>
                      <th className="px-6 py-3.5">Status Kelulusan</th>
                      <th className="px-6 py-3.5">Publikasi</th>
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
                        <td className="px-6 py-4">
                          <Badge variant={r.status === 'published' ? 'success' : 'neutral'}>
                            {r.status === 'published' ? 'DIPUBLIKASIKAN' : 'DRAFT'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {r.status !== 'published' ? (
                            <Button
                              variant="secondary"
                              className="text-[11px] min-h-[30px] px-2.5"
                              onClick={() => handlePublishSingle(r.id)}
                            >
                              Publikasikan
                            </Button>
                          ) : (
                            <span className="text-[11px] text-[#287a58] font-bold">Terbit</span>
                          )}
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
                    <th className="px-6 py-3.5">Argumen Sanggahan</th>
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
                            : 'MENUNGGU VERIFIKASI'}
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

      {/* Sanggah Decision Modal */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Keputusan Sanggahan Nilai"
        description={`Pemohon: ${activeAppeal?.student_name || activeAppeal?.full_name || '-'} (${activeAppeal?.identifier || '-'})`}
      >
        <form onSubmit={handleResolveAppeal} className="space-y-4">
          <div className="p-3 bg-[#faf9fc] rounded border border-[#e6e1eb] text-xs">
            <strong className="text-[#24212b] block mb-1">Argumen Mahasiswa:</strong>
            <p className="text-[#595562] italic leading-relaxed">{activeAppeal?.reason || activeAppeal?.message || '-'}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">Keputusan Akhir</label>
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
                <span>Setujui Sanggahan</span>
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
                <span>Tolak Sanggahan</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Catatan Resmi untuk Mahasiswa <span className="text-[#b63b48]">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Tuliskan justifikasi keputusan tim verifikator..."
              className="w-full p-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b] outline-none focus:border-[#583682]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button type="button" variant="ghost" onClick={() => setResolveModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={resolving}>
              Simpan Keputusan Resmi
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
