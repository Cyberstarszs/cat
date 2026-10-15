import React, { useEffect, useState } from 'react';
import { questionService, examService } from '../../services';
import { Question, ExamCategory } from '../../types';
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
  Eye,
  Edit2,
  Sliders,
  CheckCircle2,
  HelpCircle,
  Search,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export const AdminQuestionsPage: React.FC = () => {
  const { showToast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Create Question Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [qCode, setQCode] = useState('');
  const [qCategory, setQCategory] = useState('');
  const [qStem, setQStem] = useState('');
  const [qWeight, setQWeight] = useState(1);
  const [options, setOptions] = useState([
    { label: 'A', text: '', is_correct: true },
    { label: 'B', text: '', is_correct: false },
    { label: 'C', text: '', is_correct: false },
    { label: 'D', text: '', is_correct: false },
    { label: 'E', text: '', is_correct: false },
  ]);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Preview Modal (FR-Q07)
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Key Correction Modal (FR-Q08)
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [activeQuestionForCorrection, setActiveQuestionForCorrection] = useState<Question | null>(null);
  const [correctionType, setCorrectionType] = useState<'key_changed' | 'also_accept' | 'annulled'>('key_changed');
  const [newCorrectOptionId, setNewCorrectOptionId] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [simulatedImpact, setSimulatedImpact] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [applyingCorrection, setApplyingCorrection] = useState(false);

  const fetchQuestionsAndCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const [qData, cData] = await Promise.all([
        questionService.getQuestions(),
        examService.getCategories(),
      ]);
      setQuestions(qData);
      setCategories(cData);
      if (cData.length > 0 && !qCategory) {
        setQCategory(cData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat bank soal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestionsAndCategories();
  }, []);

  const openCreateModal = () => {
    setQCode(`Q-${Date.now().toString().slice(-4)}`);
    setQStem('');
    setQWeight(1);
    setOptions([
      { label: 'A', text: '', is_correct: true },
      { label: 'B', text: '', is_correct: false },
      { label: 'C', text: '', is_correct: false },
      { label: 'D', text: '', is_correct: false },
      { label: 'E', text: '', is_correct: false },
    ]);
    setCreateModalOpen(true);
  };

  const handleOptionCorrectChange = (index: number) => {
    setOptions((prev) =>
      prev.map((opt, i) => ({
        ...opt,
        is_correct: i === index,
      }))
    );
  };

  const handleOptionTextChange = (index: number, text: string) => {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, text } : opt))
    );
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qStem.trim()) {
      showToast('Teks soal wajib diisi.', 'error');
      return;
    }
    const hasEmptyOption = options.some((o) => !o.text.trim());
    if (hasEmptyOption) {
      showToast('Semua pilihan opsi A-E wajib diisi.', 'error');
      return;
    }

    setSavingQuestion(true);
    try {
      await questionService.createQuestion({
        code: qCode.trim().toUpperCase(),
        category_id: qCategory,
        stem: qStem.trim(),
        weight: Number(qWeight),
        options: options.map((o) => ({
          label: o.label,
          text: o.text.trim(),
          is_correct: o.is_correct,
        })),
      });
      showToast('Butir soal berhasil ditambahkan ke bank soal!', 'success');
      setCreateModalOpen(false);
      fetchQuestionsAndCategories();
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan soal.', 'error');
    } finally {
      setSavingQuestion(false);
    }
  };

  const openPreview = async (q: Question) => {
    setLoadingPreview(true);
    setPreviewModalOpen(true);
    try {
      const data = await questionService.previewQuestion(q.id);
      setPreviewData(data.question);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat pratinjau soal.', 'error');
      setPreviewModalOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const openCorrectionModal = async (q: Question) => {
    try {
      const detailed = await questionService.getQuestionById(q.id);
      setActiveQuestionForCorrection(detailed);
      setCorrectionType('key_changed');
      setCorrectionReason('');
      setSimulatedImpact(null);
      if (detailed.options && detailed.options.length > 0) {
        setNewCorrectOptionId(detailed.options[0].id);
      }
      setCorrectionModalOpen(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat opsi soal untuk koreksi.', 'error');
    }
  };

  const handleSimulateImpact = async () => {
    if (!activeQuestionForCorrection?.current_version_id) return;
    setSimulating(true);
    try {
      const impact = await questionService.previewCorrection(
        activeQuestionForCorrection.current_version_id,
        correctionType,
        undefined,
        correctionType === 'annulled' ? undefined : newCorrectOptionId
      );
      setSimulatedImpact(impact);
      showToast('Simulasi dampak nilai berhasil dikalkulasi.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghitung simulasi dampak.', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const handleApplyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuestionForCorrection?.current_version_id || !correctionReason.trim()) {
      showToast('Alasan atau justifikasi koreksi wajib diisi.', 'error');
      return;
    }

    setApplyingCorrection(true);
    try {
      await questionService.applyCorrection(
        activeQuestionForCorrection.current_version_id,
        correctionType,
        correctionReason.trim(),
        undefined,
        correctionType === 'annulled' ? undefined : newCorrectOptionId
      );
      showToast('Koreksi kunci berhasil diterapkan dan nilai seluruh peserta telah dihitung ulang!', 'success');
      setCorrectionModalOpen(false);
      fetchQuestionsAndCategories();
    } catch (err: any) {
      showToast(err.message || 'Gagal menerapkan koreksi kunci.', 'error');
    } finally {
      setApplyingCorrection(false);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    const matchSearch =
      q.code.toLowerCase().includes(search.toLowerCase()) ||
      (q.stem && q.stem.toLowerCase().includes(search.toLowerCase()));
    const matchCategory = selectedCategoryFilter ? q.category_id === selectedCategoryFilter : true;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">BANK SOAL & VERSI</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Pustaka & Manajemen Butir Soal
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Daftar soal berbobot, pratinjau tampilan peserta (FR-Q07), dan mekanisme koreksi kunci teraudit (FR-Q08).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
            Tulis Soal Baru
          </Button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchQuestionsAndCategories} />}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Cari kode atau potongan teks soal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-gray-400" />}
          />
        </div>

        <div className="w-full sm:w-60">
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full h-[46px] px-3.5 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none"
          >
            <option value="">Semua Subtes / Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Card */}
      <Card hasShadow className="overflow-hidden p-0">
        {loading ? (
          <div className="p-6">
            <CardSkeleton />
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Belum Ada Butir Soal"
              description="Tulis butir soal baru atau gunakan fitur impor CSV untuk menambahkan soal secara massal."
              icon={<HelpCircle className="w-8 h-8 text-[#583682]" />}
              action={{ label: 'Tulis Soal Baru', onClick: openCreateModal }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-3.5">Kode</th>
                  <th className="px-6 py-3.5">Subtes</th>
                  <th className="px-6 py-3.5">Pokok Soal (Stem)</th>
                  <th className="px-6 py-3.5">Bobot</th>
                  <th className="px-6 py-3.5">Versi</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e1eb]">
                {filteredQuestions.map((q) => (
                  <tr key={q.id} className="hover:bg-[#faf9fc]/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-[#583682]">
                      <span className="bg-[#eae2f5] px-2 py-0.5 rounded">{q.code}</span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#24212b]">
                      {q.category_name || q.category_code || '-'}
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <div className="text-xs text-[#24212b] line-clamp-2 leading-relaxed">
                        {q.stem || 'Belum ada konten versi aktif'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#24212b]">
                      {q.weight || 1.0} Poin
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="neutral">v{q.version_number || 1}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openPreview(q)}
                          className="p-1.5 text-[#583682] hover:bg-[#eae2f5] rounded transition"
                          title="Pratinjau Soal (FR-Q07)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openCorrectionModal(q)}
                          className="p-1.5 text-[#a96817] hover:bg-[#fdf6ec] rounded transition"
                          title="Koreksi Kunci Jawaban (FR-Q08)"
                        >
                          <RotateCcw className="w-4 h-4" />
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

      {/* Create Question Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Tulis Butir Soal Baru"
        description="Masukkan pertanyaan dan opsi pilihan ganda A hingga E."
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Kode Soal"
              required
              value={qCode}
              onChange={(e) => setQCode(e.target.value.toUpperCase())}
              placeholder="Contoh: TWK-01"
              className="font-mono uppercase"
            />
            <div>
              <label className="block text-xs font-bold text-[#24212b] mb-1">
                Subtes / Kategori <span className="text-[#b63b48]">*</span>
              </label>
              <select
                value={qCategory}
                onChange={(e) => setQCategory(e.target.value)}
                className="w-full h-[46px] px-3.5 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b]"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <Input
              type="number"
              label="Bobot Nilai (Poin)"
              required
              min={0.1}
              step={0.1}
              value={qWeight}
              onChange={(e) => setQWeight(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#24212b] mb-1.5">
              Pokok Pertanyaan / Kasus (Stem) <span className="text-[#b63b48]">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={qStem}
              onChange={(e) => setQStem(e.target.value)}
              placeholder="Tuliskan butir soal atau narasi studi kasus..."
              className="w-full p-3 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none focus:border-[#583682]"
            />
          </div>

          {/* Options A - E */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#24212b] mb-2">
              Pilihan Jawaban (Pilih satu radio sebagai kunci benar)
            </label>
            <div className="space-y-2.5">
              {options.map((opt, idx) => (
                <div key={opt.label} className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="correct_option"
                      checked={opt.is_correct}
                      onChange={() => handleOptionCorrectChange(idx)}
                      className="w-4 h-4 text-[#583682] accent-[#583682] cursor-pointer"
                    />
                    <span className="font-display font-bold text-xs text-[#583682] w-4">
                      {opt.label}.
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    value={opt.text}
                    onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                    placeholder={`Teks pilihan opsi ${opt.label}...`}
                    className="flex-1 h-10 px-3 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none focus:border-[#583682]"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={savingQuestion}>
              Simpan Soal ke Bank Soal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Preview Modal (FR-Q07) */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="Pratinjau Butir Soal (FR-Q07)"
        description="Tampilan soal dan pilihan opsi persis seperti yang dilihat oleh peserta ujian."
        maxWidth="lg"
      >
        {loadingPreview ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : previewData ? (
          <div className="space-y-6">
            <div className="p-4 bg-[#faf9fc] rounded border border-[#e6e1eb] text-xs leading-relaxed text-[#24212b]">
              {previewData.stem}
            </div>

            <div className="space-y-2">
              {previewData.options?.map((opt: any) => (
                <div
                  key={opt.id}
                  className={`p-3 rounded border text-xs flex items-center justify-between ${
                    opt.is_correct
                      ? 'bg-[#eaf4ef] border-[#287a58] text-[#287a58] font-bold'
                      : 'bg-white border-[#e6e1eb] text-[#24212b]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-white border flex items-center justify-center font-bold text-xs shrink-0">
                      {opt.label}
                    </span>
                    <span>{opt.text}</span>
                  </div>
                  {opt.is_correct && <Badge variant="success">Kunci Benar Asli</Badge>}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#e6e1eb]">
              <Button variant="ghost" onClick={() => setPreviewModalOpen(false)}>
                Tutup Pratinjau
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Key Correction Modal (FR-Q08) */}
      <Modal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        title="Koreksi Kunci & Pembatalan Soal (FR-Q08)"
        description="Aturan resmi untuk mengganti kunci, menerima kunci ganda, atau menganulir butir soal."
        maxWidth="xl"
      >
        <form onSubmit={handleApplyCorrection} className="space-y-6">
          <div className="p-3 bg-[#fdf6ec] border border-[#f6ddba] rounded text-xs text-[#a96817] leading-relaxed">
            <strong>Integritas Penilaian (INV-12):</strong> Setiap koreksi yang diterapkan akan mencatat log audit permanen dan secara otomatis memicu perhitungan ulang nilai (*auto-regrade*) untuk seluruh peserta yang pernah mengerjakan butir soal ini.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#24212b] mb-1">Jenis Koreksi</label>
              <select
                value={correctionType}
                onChange={(e) => setCorrectionType(e.target.value as any)}
                className="w-full h-10 px-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b]"
              >
                <option value="key_changed">Ganti Kunci Jawaban (key_changed)</option>
                <option value="also_accept">Terima Kunci Tambahan (also_accept)</option>
                <option value="annulled">Anulir / Batalkan Soal (annulled)</option>
              </select>
            </div>

            {correctionType !== 'annulled' && (
              <div>
                <label className="block text-xs font-bold text-[#24212b] mb-1">Pilih Opsi Kunci Baru</label>
                <select
                  value={newCorrectOptionId}
                  onChange={(e) => setNewCorrectOptionId(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b]"
                >
                  {activeQuestionForCorrection?.options?.map((o) => (
                    <option key={o.id} value={o.id}>
                      Opsi {o.label} - {o.text.slice(0, 40)}...
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1">
              Alasan / Justifikasi Koreksi <span className="text-[#b63b48]">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Contoh: Berdasarkan hasil telaah tim pakar, opsi C memiliki rujukan hukum terbaru..."
              className="w-full p-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b] outline-none focus:border-[#583682]"
            />
          </div>

          {/* Simulation Preview Impact Button */}
          <div className="p-4 bg-[#faf9fc] rounded border border-[#e6e1eb] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#24212b]">
                Pratinjau Dampak Skor Peserta (Dry-Run Simulation)
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSimulateImpact}
                isLoading={simulating}
                className="text-xs min-h-[34px] px-3"
              >
                Simulasikan Dampak
              </Button>
            </div>

            {simulatedImpact && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-2">
                <div className="p-2 bg-white rounded border border-[#e6e1eb]">
                  <div className="font-bold text-sm text-[#583682]">{simulatedImpact.total_evaluated_attempts}</div>
                  <div className="text-[10px] text-[#595562]">Total Attempt</div>
                </div>
                <div className="p-2 bg-white rounded border border-[#e6e1eb]">
                  <div className="font-bold text-sm text-[#287a58]">+{simulatedImpact.students_improved}</div>
                  <div className="text-[10px] text-[#595562]">Skor Naik</div>
                </div>
                <div className="p-2 bg-white rounded border border-[#e6e1eb]">
                  <div className="font-bold text-sm text-[#287a58]">{simulatedImpact.newly_passing}</div>
                  <div className="text-[10px] text-[#595562]">Menjadi Lulus</div>
                </div>
                <div className="p-2 bg-white rounded border border-[#e6e1eb]">
                  <div className="font-bold text-sm text-[#b63b48]">{simulatedImpact.newly_failing}</div>
                  <div className="text-[10px] text-[#595562]">Menjadi Gagal</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button type="button" variant="ghost" onClick={() => setCorrectionModalOpen(false)}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={applyingCorrection}
              className="bg-[#287a58] border-[#287a58] hover:bg-[#206346]"
            >
              Terapkan Koreksi & Regrade
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
