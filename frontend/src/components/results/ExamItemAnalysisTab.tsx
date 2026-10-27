import React, { useState, useEffect } from 'react';
import { reportService, examService } from '../../services';
import { Exam } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  BarChart3,
  TrendingUp,
  Award,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Check,
  Percent,
  Sparkles,
} from 'lucide-react';

export const ExamItemAnalysisTab: React.FC = () => {
  const { showToast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterDiscrimination, setFilterDiscrimination] = useState<string>('all');

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Fetch Exams
  useEffect(() => {
    const fetchExams = async () => {
      setLoadingExams(true);
      try {
        const list = await examService.getExams();
        setExams(list);
        if (list.length > 0) {
          setSelectedExamId(list[0].id);
        }
      } catch (err: any) {
        showToast(err.message || 'Gagal memuat paket ujian', 'error');
      } finally {
        setLoadingExams(false);
      }
    };
    fetchExams();
  }, [showToast]);

  // Fetch Item Analysis when selectedExamId changes
  const fetchItemAnalysis = async () => {
    if (!selectedExamId) return;
    setLoadingAnalysis(true);
    try {
      const data = await reportService.getExamItemAnalysis(selectedExamId);
      setAnalysisData(data);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err.message || 'Gagal memuat analisis butir soal', 'error');
      setAnalysisData(null);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      fetchItemAnalysis();
    }
  }, [selectedExamId]);

  const items = analysisData?.items || [];
  const filteredItems = items.filter((item: any) => {
    const term = search.toLowerCase();
    const matchesSearch =
      (item.question_code || '').toLowerCase().includes(term) ||
      (item.subtest_name || '').toLowerCase().includes(term) ||
      (item.stem || '').toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (filterDifficulty !== 'all' && item.difficulty_category !== filterDifficulty) {
      return false;
    }

    const disc = Number(item.discrimination_index ?? 0);
    if (filterDiscrimination === 'good' && disc < 0.3) {
      return false;
    }
    if (filterDiscrimination === 'poor' && disc >= 0.2) {
      return false;
    }

    return true;
  });

  const stats = analysisData?.statistics;

  return (
    <div className="space-y-6">
      {/* Exam Selector Toolbar */}
      <Card className="p-4 bg-[#fcfaff] border-[#e6e1eb]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#eae2f5] text-[#583682] rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-[#24212b]">
                Pilih Paket Ujian
              </div>
              <div className="text-xs text-[#595562]">
                Analisis daya pembeda, tingkat kesulitan, dan fungsi pengecoh soal.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              disabled={loadingExams}
              className="h-10 px-3 bg-white border border-[#e6e1eb] rounded-lg text-xs font-semibold text-[#24212b] outline-none min-w-[240px] focus:border-[#583682]"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.duration_minutes} mnt)
                </option>
              ))}
            </select>

            <Button
              variant="secondary"
              onClick={fetchItemAnalysis}
              disabled={loadingAnalysis}
              className="text-xs min-h-[38px] px-3"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalysis ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="bg-white border border-[#e6e1eb] p-3 rounded-xl shadow-xs">
            <div className="text-[11px] text-[#595562] font-medium">Total Peserta</div>
            <div className="text-xl font-bold text-[#24212b] mt-1">{stats.total_examinees}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Selesai ujian</div>
          </div>

          <div className="bg-white border border-[#e6e1eb] p-3 rounded-xl shadow-xs">
            <div className="text-[11px] text-[#595562] font-medium">Tingkat Kelulusan</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">{stats.pass_rate_percentage}%</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{stats.passed_count} peserta lulus</div>
          </div>

          <div className="bg-white border border-[#e6e1eb] p-3 rounded-xl shadow-xs">
            <div className="text-[11px] text-[#595562] font-medium">Rata-rata Nilai</div>
            <div className="text-xl font-bold text-[#583682] mt-1">{stats.average_score}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Batas: {analysisData?.exam?.passing_score}</div>
          </div>

          <div className="bg-white border border-[#e6e1eb] p-3 rounded-xl shadow-xs">
            <div className="text-[11px] text-[#595562] font-medium">Skor Tertinggi / Terendah</div>
            <div className="text-xl font-bold text-gray-800 mt-1">
              {stats.max_score} <span className="text-xs font-normal text-gray-400">/ {stats.min_score}</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Rentang nilai</div>
          </div>

          <div className="bg-white border border-[#e6e1eb] p-3 rounded-xl shadow-xs">
            <div className="text-[11px] text-[#595562] font-medium">Standar Deviasi</div>
            <div className="text-xl font-bold text-blue-700 mt-1">{stats.std_deviation}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Sebaran nilai</div>
          </div>

          <div className="bg-white border border-[#e6e1eb] p-3 rounded-xl shadow-xs">
            <div className="text-[11px] text-[#595562] font-medium">Total Soal</div>
            <div className="text-xl font-bold text-[#24212b] mt-1">{items.length}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Soal teranalisis</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari soal"
            className="w-full !pl-10 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#583682]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty Filter */}
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-[#583682]"
          >
            <option value="all">Semua Kesulitan</option>
            <option value="Mudah">Mudah (P ≥ 0.70)</option>
            <option value="Sedang">Sedang (0.30 ≤ P &lt; 0.70)</option>
            <option value="Sukar">Sukar (P &lt; 0.30)</option>
          </select>

          {/* Discrimination Filter */}
          <select
            value={filterDiscrimination}
            onChange={(e) => setFilterDiscrimination(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-[#583682]"
          >
            <option value="all">Semua Daya Pembeda</option>
            <option value="good">Daya Pembeda Baik (D ≥ 0.30)</option>
            <option value="poor">Perlu Revisi (D &lt; 0.20)</option>
          </select>
        </div>
      </div>

      {/* Item Analysis Table */}
      <Card className="overflow-hidden border border-gray-200 shadow-xs">
        {loadingAnalysis ? (
          <div className="py-16 text-center text-gray-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#583682]" />
            Mengkalkulasi parameter psikometri butir soal...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-xs">
            Tidak ada butir soal yang cocok atau belum ada riwayat pengerjaan pada ujian ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fafc] text-gray-600 border-b border-gray-200 font-bold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Kode & Subtes</th>
                  <th className="py-3 px-4 max-w-xs">Teks Soal</th>
                  <th className="py-3 px-4">Tingkat Kesulitan</th>
                  <th className="py-3 px-4">Daya Pembeda</th>
                  <th className="py-3 px-4">Sebaran Pilihan</th>
                  <th className="py-3 px-4">Rekomendasi</th>
                  <th className="py-3 px-4 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item: any, idx: number) => {
                  const p = item.empirical_difficulty;
                  const d = item.discrimination_index;

                  return (
                    <tr key={item.question_version_id || idx} className="hover:bg-[#faf9fc] transition">
                      <td className="py-3 px-4 text-center text-gray-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-[#583682] font-mono">{item.question_code}</span>
                        <div className="text-[11px] text-gray-500 mt-0.5">{item.subtest_name || 'Umum'}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="line-clamp-2 text-gray-800 text-[11px] font-medium" title={item.stem}>
                          {item.stem}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-gray-900">{p}</span>
                          <Badge
                            variant={
                              item.difficulty_category === 'Mudah'
                                ? 'success'
                                : item.difficulty_category === 'Sedang'
                                ? 'purple'
                                : 'warning'
                            }
                            className="text-[10px]"
                          >
                            {item.difficulty_category}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {item.correct_count} dari {item.total_answered} benar
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-gray-900">{d}</span>
                          <Badge
                            variant={
                              d >= 0.4
                                ? 'success'
                                : d >= 0.3
                                ? 'purple'
                                : d >= 0.2
                                ? 'neutral'
                                : 'danger'
                            }
                            className="text-[10px]"
                          >
                            {item.discrimination_category}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {item.options?.map((opt: any) => (
                            <span
                              key={opt.id}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                opt.is_correct
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : opt.is_functioning
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-red-50 text-red-600 border border-red-200'
                              }`}
                              title={`Opsi ${opt.label}: ${opt.selection_percentage}% (${opt.selection_count} orang)`}
                            >
                              {opt.label}:{opt.selection_percentage}%
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[11px] text-gray-700 font-medium">
                          {item.recommendations?.[0] || 'Kualitas baik'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setDetailModalOpen(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-[#583682] hover:bg-[#eae2f5] rounded transition"
                          title="Lihat Detail Butir Soal"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Detail Butir Soal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Detail Analisis Soal: ${selectedItem?.question_code || ''}`}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end w-full">
            <Button variant="secondary" className="min-h-[36px] px-4" onClick={() => setDetailModalOpen(false)}>
              Tutup
            </Button>
          </div>
        }
      >
        {selectedItem && (
          <div className="space-y-4 text-xs">
            {/* Stem Soal */}
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Teks Pertanyaan
              </div>
              <div className="font-medium text-gray-900 leading-relaxed text-sm">
                {selectedItem.stem}
              </div>
            </div>

            {/* Metrik Nilai */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-purple-50/50 border border-purple-200 rounded">
                <div className="text-gray-500 font-medium">Tingkat Kesulitan</div>
                <div className="text-xl font-bold text-[#583682] mt-0.5">
                  {selectedItem.empirical_difficulty}{' '}
                  <span className="text-xs font-normal">({selectedItem.difficulty_category})</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {selectedItem.correct_count} dari {selectedItem.total_answered} peserta benar
                </div>
              </div>

              <div className="p-3 bg-blue-50/50 border border-blue-200 rounded">
                <div className="text-gray-500 font-medium">Daya Pembeda</div>
                <div className="text-xl font-bold text-blue-900 mt-0.5">
                  {selectedItem.discrimination_index}{' '}
                  <span className="text-xs font-normal">({selectedItem.discrimination_category})</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  Kelompok atas (27%) vs kelompok bawah (27%)
                </div>
              </div>
            </div>

            {/* Opsi Jawaban & Distractor Analysis */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Pilihan Jawaban & Pengecoh:
              </div>
              <div className="space-y-2">
                {selectedItem.options?.map((opt: any) => (
                  <div
                    key={opt.id}
                    className={`p-2.5 rounded border flex items-start justify-between gap-3 ${
                      opt.is_correct
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                        : opt.is_functioning
                        ? 'bg-white border-gray-200 text-gray-800'
                        : 'bg-red-50/50 border-red-200 text-red-900'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          opt.is_correct
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <div>
                        <div className="font-medium text-xs leading-tight">{opt.option_text}</div>
                        {opt.is_correct && (
                          <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
                            ★ Kunci Benar
                          </div>
                        )}
                        {!opt.is_correct && !opt.is_functioning && (
                          <div className="text-[10px] font-semibold text-red-600 mt-0.5">
                            ⚠ Pengecoh tidak berfungsi (&lt;5% pemilih)
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-xs">{opt.selection_percentage}%</div>
                      <div className="text-[10px] text-gray-400">{opt.selection_count} orang</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rekomendasi */}
            <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-900">
              <div className="font-bold text-[11px] mb-1">Rekomendasi Soal:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {selectedItem.recommendations?.map((rec: string, i: number) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
