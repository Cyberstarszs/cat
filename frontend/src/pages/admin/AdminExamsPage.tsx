import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SubtestsManagerView } from './AdminSubtestsPage';
import { examService, questionService } from '../../services';
import { Exam, ExamCategory } from '../../types';
import { useToast } from '../../context/ToastContext';
import { alert } from '../../utils/alert';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import {
  Plus,
  Edit2,
  Trash2,
  Sliders,
  Clock,
  Award,
  FileText,
  Search,
  Copy,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shuffle,
  Calendar,
} from 'lucide-react';

export const AdminExamsPage: React.FC = () => {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'exams' | 'subtests'>(
    tabParam === 'subtests' || tabParam === 'categories' ? 'subtests' : 'exams'
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'subtests' || t === 'categories') {
      setActiveTab('subtests');
    } else {
      setActiveTab('exams');
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'exams' | 'subtests') => {
    setActiveTab(tab);
    if (tab === 'subtests') {
      setSearchParams({ tab: 'subtests' });
    } else {
      setSearchParams({});
    }
  };

  const [exams, setExams] = useState<Exam[]>([]);
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Exam Modal (Create / Edit)
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [examYear, setExamYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [passingScore, setPassingScore] = useState(70);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [examStatus, setExamStatus] = useState<'active' | 'draft'>('active');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [savingExam, setSavingExam] = useState(false);

  // Rules Modal (Configure Questions per Category)
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [activeExamForRules, setActiveExamForRules] = useState<Exam | null>(null);
  const [rulesCategories, setRulesCategories] = useState<ExamCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [savingRule, setSavingRule] = useState(false);

  // Inline Rule Edit State
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editRuleCount, setEditRuleCount] = useState<number>(10);
  const [savingRuleEdit, setSavingRuleEdit] = useState(false);

  // Copy exam state
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const fetchExamsAndCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const [examsData, catData, yearsData] = await Promise.all([
        examService.getExams(),
        examService.getCategories(),
        questionService.getQuestionYears().catch(() => []),
      ]);
      setExams(examsData);
      setCategories(catData);
      if (yearsData && yearsData.length > 0) {
        setAvailableYears(yearsData);
      } else {
        const current = new Date().getFullYear();
        setAvailableYears([current, current - 1, current + 1]);
      }
      if (catData.length > 0 && !selectedCategory) {
        setSelectedCategory(catData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data ujian dan kategori.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExamsAndCategories();
  }, []);

  const openCreateExam = () => {
    setEditingExam(null);
    const currentYear = new Date().getFullYear();
    setExamYear(currentYear);
    setTitle('');
    setCode(`EXAM-${currentYear}-${Date.now().toString().slice(-4)}`);
    setDescription('');
    setPassingScore(70);
    setDurationMinutes(90);
    setExamStatus('active');
    setShuffleQuestions(true);
    setShuffleOptions(true);
    setExamModalOpen(true);
  };

  const openEditExam = (ex: Exam) => {
    setEditingExam(ex);
    setExamYear(ex.year || new Date().getFullYear());
    setTitle(ex.title);
    setCode(ex.code);
    setDescription(ex.description || '');
    setPassingScore(ex.passing_score);
    setDurationMinutes(ex.duration_minutes);
    setExamStatus(ex.status === 'draft' ? 'draft' : 'active');
    setShuffleQuestions(ex.shuffle_questions ?? true);
    setShuffleOptions(ex.shuffle_options ?? true);
    setExamModalOpen(true);
  };

  const openRulesModal = async (ex: Exam) => {
    try {
      const detailed = await examService.getExamById(ex.id);
      setActiveExamForRules(detailed);
      setEditingRuleId(null);

      // Ambil kategori dengan stok aktif khusus tahun ujian yang bersangkutan
      const examYearTarget = detailed.year || ex.year || new Date().getFullYear();
      const specificCats = await examService.getCategories({ year: examYearTarget });
      setRulesCategories(specificCats);

      // Auto-select first available category that is not yet assigned
      const assignedIds = new Set((detailed.rules || []).map((r) => r.category_id));
      const unassigned = specificCats.filter((c) => !assignedIds.has(c.id));

      if (unassigned.length > 0) {
        // Prioritas pilih subtes yang memiliki stok soal > 0 pada tahun tersebut
        const withStock = unassigned.find((c) => Number(c.question_count || c.active_question_count || 0) > 0);
        const chosen = withStock || unassigned[0];
        setSelectedCategory(chosen.id);
        const stock = Number(chosen.question_count || chosen.active_question_count || 0);
        setQuestionCount(stock > 0 ? Math.min(10, stock) : 0);
      } else if (specificCats.length > 0) {
        setSelectedCategory(specificCats[0].id);
        const stock = Number(specificCats[0].question_count || specificCats[0].active_question_count || 0);
        setQuestionCount(stock > 0 ? Math.min(10, stock) : 0);
      } else {
        setSelectedCategory('');
        setQuestionCount(0);
      }

      setRulesModalOpen(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat aturan soal ujian.', 'error');
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExam(true);
    try {
      if (editingExam) {
        await examService.updateExam(editingExam.id, {
          title: title.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
          year: Number(examYear),
          passing_score: Number(passingScore),
          duration_minutes: Number(durationMinutes),
          status: examStatus,
          shuffle_questions: shuffleQuestions,
          shuffle_options: shuffleOptions,
        });
        alert.toast(`Paket ujian "${title.trim()}" berhasil diperbarui!`, 'success');
      } else {
        await examService.createExam({
          title: title.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
          year: Number(examYear),
          passing_score: Number(passingScore),
          duration_minutes: Number(durationMinutes),
          status: examStatus,
          shuffle_questions: shuffleQuestions,
          shuffle_options: shuffleOptions,
        } as any);
        alert.toast(`Paket ujian baru "${title.trim()}" berhasil dibuat!`, 'success');
      }
      setExamModalOpen(false);
      fetchExamsAndCategories();
    } catch (err: any) {
      alert.error('Gagal Menyimpan Ujian', err?.response?.data?.message || err.message || 'Periksa kelengkapan form.');
    } finally {
      setSavingExam(false);
    }
  };

  const handleCopyExam = async (ex: Exam) => {
    setCopyingId(ex.id);
    try {
      const copied = await examService.copyExam(ex.id);
      alert.toast(`Ujian berhasil disalin menjadi "${copied.title || 'Salinan Ujian'}"!`, 'success');
      fetchExamsAndCategories();
    } catch (err: any) {
      alert.error('Gagal Menyalin Ujian', err?.response?.data?.message || err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setCopyingId(null);
    }
  };

  // Categories not yet assigned to active exam in Rules Modal
  const availableCategoriesForExam = useMemo(() => {
    const sourceCats = rulesCategories.length > 0 ? rulesCategories : categories;
    if (!activeExamForRules?.rules) return sourceCats;
    const assignedIds = new Set(activeExamForRules.rules.map((r) => r.category_id));
    return sourceCats.filter((c) => !assignedIds.has(c.id));
  }, [rulesCategories, categories, activeExamForRules]);

  // Selected category object & its real available stock in Question Bank
  const selectedCatData = useMemo(() => {
    const sourceCats = rulesCategories.length > 0 ? rulesCategories : categories;
    return sourceCats.find((c) => c.id === selectedCategory);
  }, [rulesCategories, categories, selectedCategory]);

  const availableStock = useMemo(() => {
    if (!selectedCatData) return 0;
    return Number(selectedCatData.question_count ?? selectedCatData.active_question_count ?? 0);
  }, [selectedCatData]);

  const handleCategorySelectChange = (catId: string) => {
    setSelectedCategory(catId);
    const sourceCats = rulesCategories.length > 0 ? rulesCategories : categories;
    const cat = sourceCats.find((c) => c.id === catId);
    const stock = Number(cat?.question_count ?? cat?.active_question_count ?? 0);
    if (stock > 0) {
      setQuestionCount(Math.min(questionCount > 0 ? questionCount : 10, stock));
    } else {
      setQuestionCount(0);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExamForRules) return;

    if (!selectedCategory) {
      showToast('Pilih kategori subtes terlebih dahulu.', 'warning');
      return;
    }

    const examYearTarget = activeExamForRules.year || new Date().getFullYear();

    if (availableStock <= 0) {
      showToast(
        `Subtes "${selectedCatData?.name}" belum memiliki butir soal aktif di Bank Soal untuk Tahun ${examYearTarget} (Stok: 0). Silakan isi atau impor naskah soal terlebih dahulu.`,
        'error'
      );
      return;
    }

    if (!questionCount || questionCount <= 0) {
      showToast('Jumlah butir soal yang ditarik harus minimal 1.', 'warning');
      return;
    }

    // STRICT VALIDATION: Question count cannot exceed available bank stock for this year!
    if (questionCount > availableStock) {
      showToast(
        `Jumlah butir soal yang ditarik (${questionCount}) tidak boleh melebihi stok yang tersedia di Bank Soal Tahun ${examYearTarget} (${availableStock} butir).`,
        'error'
      );
      return;
    }

    setSavingRule(true);
    try {
      await examService.addRule(activeExamForRules.id, selectedCategory, Number(questionCount));
      showToast(`Berhasil menambahkan alokasi ${questionCount} soal "${selectedCatData?.name}" ke paket ujian!`, 'success');
      const updated = await examService.getExamById(activeExamForRules.id);
      setActiveExamForRules(updated);

      // Refresh specific categories for this exam year
      const specificCats = await examService.getCategories({ year: examYearTarget });
      setRulesCategories(specificCats);

      // Refresh selection to next unassigned category
      const assignedIds = new Set((updated.rules || []).map((r) => r.category_id));
      const unassigned = specificCats.filter((c) => !assignedIds.has(c.id));
      if (unassigned.length > 0) {
        setSelectedCategory(unassigned[0].id);
        const nextStock = Number(unassigned[0].question_count ?? unassigned[0].active_question_count ?? 0);
        setQuestionCount(nextStock > 0 ? Math.min(10, nextStock) : 0);
      }
      fetchExamsAndCategories();
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan aturan komposisi soal.', 'error');
    } finally {
      setSavingRule(false);
    }
  };

  const handleUpdateRuleCount = async (ruleId: string, ruleCatId: string, ruleCatName?: string) => {
    if (!activeExamForRules || !editRuleCount || editRuleCount <= 0) return;

    const examYearTarget = activeExamForRules.year || new Date().getFullYear();
    const sourceCats = rulesCategories.length > 0 ? rulesCategories : categories;
    const cat = sourceCats.find((c) => c.id === ruleCatId || c.name === ruleCatName);
    const stock = Number(cat?.question_count ?? cat?.active_question_count ?? 0);

    if (stock > 0 && editRuleCount > stock) {
      showToast(
        `Jumlah butir soal (${editRuleCount}) melebihi stok yang tersedia di Bank Soal Tahun ${examYearTarget} (${stock} butir). Nilai disesuaikan ke maksimal ${stock} butir.`,
        'warning'
      );
      setEditRuleCount(stock);
      return;
    }

    setSavingRuleEdit(true);
    try {
      await examService.updateRule(activeExamForRules.id, ruleId, Number(editRuleCount));
      showToast(`Alokasi butir soal berhasil diperbarui menjadi ${editRuleCount} soal!`, 'success');
      setEditingRuleId(null);
      const updated = await examService.getExamById(activeExamForRules.id);
      setActiveExamForRules(updated);

      const specificCats = await examService.getCategories({ year: examYearTarget });
      setRulesCategories(specificCats);
      fetchExamsAndCategories();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui jumlah butir soal.', 'error');
    } finally {
      setSavingRuleEdit(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!activeExamForRules) return;
    const examYearTarget = activeExamForRules.year || new Date().getFullYear();
    try {
      await examService.deleteRule(activeExamForRules.id, ruleId);
      showToast('Aturan subtes berhasil dihapus dari ujian.', 'success');
      const updated = await examService.getExamById(activeExamForRules.id);
      setActiveExamForRules(updated);

      const specificCats = await examService.getCategories({ year: examYearTarget });
      setRulesCategories(specificCats);

      const assignedIds = new Set((updated.rules || []).map((r) => r.category_id));
      const unassigned = specificCats.filter((c) => !assignedIds.has(c.id));
      if (unassigned.length > 0) {
        setSelectedCategory(unassigned[0].id);
        const nextStock = Number(unassigned[0].question_count ?? unassigned[0].active_question_count ?? 0);
        setQuestionCount(nextStock > 0 ? Math.min(10, nextStock) : 0);
      }
      fetchExamsAndCategories();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus aturan.', 'error');
    }
  };

  const handleDeleteExam = async (ex: Exam) => {
    const confirmed = await alert.confirm({
      title: 'Hapus Paket Ujian?',
      text: `Apakah Anda yakin ingin menghapus paket ujian "${ex.title}" (${ex.code})? Seluruh aturan komposisi subtes di dalamnya akan ikut terhapus.`,
      confirmButtonText: 'Ya, Hapus Ujian',
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      await examService.deleteExam(ex.id);
      alert.toast(`Paket ujian "${ex.title}" berhasil dihapus.`, 'success');
      fetchExamsAndCategories();
    } catch (err: any) {
      alert.error('Gagal Menghapus Ujian', err?.response?.data?.message || err.message || 'Gagal menghapus ujian. Pastikan tidak ada sesi yang menggunakannya.');
    }
  };

  // Total questions in active exam rules
  const totalQuestionsInActiveExam = useMemo(() => {
    if (!activeExamForRules?.rules) return 0;
    return activeExamForRules.rules.reduce((acc, r) => acc + (Number(r.question_count) || 0), 0);
  }, [activeExamForRules]);

  const filteredExams = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return exams;
    return exams.filter(
      (ex) =>
        ex.title.toLowerCase().includes(term) ||
        ex.code.toLowerCase().includes(term) ||
        (ex.description && ex.description.toLowerCase().includes(term))
    );
  }, [exams, search]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Tab Navigasi Terpadu: Paket Ujian & Kategori Subtes */}
      <div className="flex border-b border-[#e6e1eb] gap-6">
        <button
          type="button"
          onClick={() => handleTabChange('exams')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'exams'
              ? 'border-[#583682] text-[#583682] font-bold'
              : 'border-transparent text-[#595562] hover:text-[#24212b]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Paket Ujian</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#eae2f5] text-[#583682] font-bold">
            {exams.length} Ujian
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('subtests')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'subtests'
              ? 'border-[#583682] text-[#583682] font-bold'
              : 'border-transparent text-[#595562] hover:text-[#24212b]'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Subtes Soal</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#eae2f5] text-[#583682] font-bold">
            {categories.length} Subtes
          </span>
        </button>
      </div>

      {activeTab === 'subtests' ? (
        <SubtestsManagerView
          hideHeaderTitle={true}
          onCategoryChanged={fetchExamsAndCategories}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
            <div>
              <div className="eyebrow mb-1">PAKET UJIAN</div>
              <h1 className="font-display font-bold text-2xl text-[#24212b]">
                Paket Ujian
              </h1>
              <p className="text-xs text-[#595562] mt-0.5 max-w-2xl leading-relaxed">
                Kelola paket ujian, nilai kelulusan, dan komposisi subtes soal.
              </p>
            </div>

            <Button variant="primary" onClick={openCreateExam} leftIcon={<Plus className="w-4 h-4" />}>
              Buat Paket Ujian
            </Button>
          </div>

          {error && <ErrorAlert message={error} onRetry={fetchExamsAndCategories} />}

          {/* Search & Statistics Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-80">
              <Input
                placeholder="Cari kode atau judul ujian..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-gray-400" />}
              />
            </div>

            <div className="text-xs text-[#595562]">
              Menampilkan <strong>{filteredExams.length}</strong> dari <strong>{exams.length}</strong> paket ujian
            </div>
          </div>

          <Card hasShadow className="overflow-hidden p-0">
            {loading ? (
              <div className="p-6">
                <CardSkeleton />
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="Belum Ada Paket Ujian"
                  description="Buat paket ujian baru untuk menentukan standar kelulusan (passing score), opsi pengacakan, dan komposisi butir soal yang ditarik dari setiap subtes."
                  icon={<FileText className="w-8 h-8 text-[#583682]" />}
                  action={{ label: 'Buat Paket Ujian Pertama', onClick: openCreateExam }}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-6 py-3.5">Kode</th>
                      <th className="px-6 py-3.5">Judul & Kurikulum Ujian</th>
                      <th className="px-6 py-3.5">Komposisi Soal</th>
                      <th className="px-6 py-3.5">Passing Score</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6e1eb]">
                    {filteredExams.map((ex) => {
                      const rulesCount = Number(ex.total_rules_count) || 0;
                      const sessionCount = Number(ex.session_count) || 0;

                      return (
                        <tr key={ex.id} className="hover:bg-[#faf9fc]/80 transition">
                          <td className="px-6 py-4 font-mono font-bold text-[#583682]">
                            <span className="bg-[#eae2f5] px-2 py-0.5 rounded">
                              {ex.code}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[#24212b] text-sm">{ex.title}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#583682] bg-[#f6f2fa] px-2 py-0.5 rounded border border-[#cfc2df]">
                                <Calendar className="w-3 h-3 text-[#583682]" /> Th. {ex.year || new Date().getFullYear()}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#595562] truncate max-w-sm mt-0.5">
                              {ex.description || 'Tanpa deskripsi tambahan'}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {ex.shuffle_questions !== false && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-[#583682] bg-[#f6f2fa] px-1.5 py-0.5 rounded border border-[#eae2f5]">
                                  <Shuffle className="w-3 h-3" /> Acak Soal
                                </span>
                              )}
                              {sessionCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  <Calendar className="w-3 h-3" /> {sessionCount} Sesi Terjadwal
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Komposisi Soal */}
                          <td className="px-6 py-4">
                            {rulesCount > 0 ? (
                              <div>
                                <span className="font-bold text-[#24212b] text-xs">
                                  {rulesCount} Butir Soal
                                </span>
                                <div className="text-[10px] text-[#287a58] font-semibold mt-0.5 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Siap diujikan
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => openRulesModal(ex)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200 transition"
                                title="Klik untuk menentukan jumlah butir soal per subtes"
                              >
                                <Sliders className="w-3 h-3" /> Atur Komposisi
                              </button>
                            )}
                          </td>

                          <td className="px-6 py-4 font-bold text-[#24212b]">
                            <span className="text-sm">{ex.passing_score}</span>
                            <span className="text-[11px] text-[#595562] font-normal"> / 100 Poin</span>
                          </td>

                          <td className="px-6 py-4">
                            <Badge variant={ex.status === 'active' ? 'success' : 'neutral'}>
                              {ex.status === 'active' ? 'Aktif' : 'Draft'}
                            </Badge>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Atur Komposisi Soal */}
                              <button
                                onClick={() => openRulesModal(ex)}
                                className="p-1.5 text-[#583682] hover:bg-[#eae2f5] rounded transition"
                                title="Atur Komposisi Subtes & Jumlah Soal"
                              >
                                <Sliders className="w-4 h-4" />
                              </button>

                              {/* Salin / Duplikasi Ujian */}
                              <button
                                onClick={() => handleCopyExam(ex)}
                                disabled={copyingId === ex.id}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition"
                                title="Salin / Duplikasi Paket Ujian ini (FR-E04)"
                              >
                                <Copy className={`w-4 h-4 ${copyingId === ex.id ? 'animate-spin' : ''}`} />
                              </button>

                              {/* Ubah Ujian */}
                              <button
                                onClick={() => openEditExam(ex)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                                title="Ubah Konfigurasi Ujian"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Hapus Ujian */}
                              <button
                                onClick={() => handleDeleteExam(ex)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                                title="Hapus Paket Ujian"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Exam Create / Edit Modal */}
      <Modal
        isOpen={examModalOpen}
        onClose={() => setExamModalOpen(false)}
        title={editingExam ? `Ubah Paket Ujian: ${editingExam.title}` : 'Buat Paket Ujian'}
        description="Atur kode, judul, tahun soal, dan nilai kelulusan."
        maxWidth="xl"
      >
        <form onSubmit={handleSaveExam} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Kode Ujian"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Contoh: FIA-2026"
              className="uppercase font-mono"
            />

            <div>
              <label className="block text-xs font-bold text-[#24212b] mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#583682]" />
                  Tahun Soal <span className="text-[#b63b48]">*</span>
                </span>
              </label>
              <input
                type="number"
                required
                min={2000}
                max={2100}
                value={examYear}
                onChange={(e) => setExamYear(Number(e.target.value))}
                className="w-full h-[46px] px-3.5 bg-white border border-[#e6e1eb] rounded-[6px] text-xs font-bold text-[#24212b] outline-none focus:border-[#583682]"
                placeholder="2026"
              />
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {Array.from(new Set([new Date().getFullYear(), ...availableYears]))
                  .sort((a, b) => b - a)
                  .map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setExamYear(yr)}
                      className={`px-1.5 py-0.5 text-[10px] rounded font-semibold border transition ${
                        examYear === yr
                          ? 'bg-[#583682] text-white border-[#583682]'
                          : 'bg-[#faf9fc] text-[#595562] border-[#e6e1eb] hover:bg-[#eae2f5] hover:text-[#583682]'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24212b] mb-1">
                Status Ujian <span className="text-[#b63b48]">*</span>
              </label>
              <select
                value={examStatus}
                onChange={(e) => setExamStatus(e.target.value as 'active' | 'draft')}
                className="w-full h-[46px] px-3.5 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none"
              >
                <option value="active">Aktif</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <Input
            label="Judul Paket Ujian"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Ujian Tata Kelola FIA 2026"
          />

          <div>
            <Input
              type="number"
              label="Nilai Kelulusan (Passing Score)"
              required
              min={1}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
              helperText="Nilai minimal (1-100) untuk dinyatakan lulus."
            />
          </div>

          {/* Opsi Pengacakan Soal */}
          <div className="p-3 bg-[#faf9fc] rounded-[8px] border border-[#e6e1eb] space-y-2.5">
            <div className="text-xs font-bold text-[#583682] uppercase tracking-wider flex items-center gap-1.5">
              <Shuffle className="w-3.5 h-3.5" />
              Pengacakan Soal
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="w-4 h-4 text-[#583682] accent-[#583682] rounded cursor-pointer"
                />
                <span className="text-[#24212b]">Acak Urutan Soal</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                  className="w-4 h-4 text-[#583682] accent-[#583682] rounded cursor-pointer"
                />
                <span className="text-[#24212b]">Acak Pilihan Jawaban (A-E)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#24212b] mb-1.5">
              Deskripsi (Opsional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tuliskan petunjuk umum atau deskripsi mengenai tujuan evaluasi ini..."
              className="w-full p-3 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none focus:border-[#583682]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button type="button" variant="ghost" onClick={() => setExamModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={savingExam}>
              {editingExam ? 'Simpan Perubahan' : 'Buat Paket Ujian'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rules Modal (Questions per Category / Blueprint with Strict Stock Boundary) */}
      <Modal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
        title={`Atur Komposisi Soal: ${activeExamForRules?.title || ''}`}
        description={`Tentukan butir soal yang ditarik dari setiap subtes untuk naskah Tahun ${activeExamForRules?.year || new Date().getFullYear()}. Jumlah soal dibatasi ketat oleh stok soal aktif yang tersedia di Bank Soal pada tahun tersebut.`}
        maxWidth="xl"
      >
        <div className="space-y-6">
          {/* Summary Box: Identitas Ujian & Komposisi */}
          <div className="p-4 bg-[#f8f6fc] border border-[#cfc2df] rounded-[8px] grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-[11px] text-[#595562]">Tahun Naskah</div>
              <div className="font-display font-bold text-lg text-[#583682] flex items-center justify-center gap-1 mt-0.5">
                <Calendar className="w-4 h-4 text-[#583682]" />
                {activeExamForRules?.year || new Date().getFullYear()}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#595562]">Total Butir Soal</div>
              <div className="font-display font-bold text-lg text-[#583682] mt-0.5">
                {totalQuestionsInActiveExam} <span className="text-xs font-normal">Soal</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#595562]">Passing Score</div>
              <div className="font-display font-bold text-lg text-[#24212b] mt-0.5">
                {activeExamForRules?.passing_score || 0}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#595562]">Subtes Terpasang</div>
              <div className="font-display font-bold text-lg text-[#287a58] mt-0.5">
                {activeExamForRules?.rules?.length || 0} <span className="text-xs font-normal">Subtes</span>
              </div>
            </div>
          </div>

          {/* Existing Rules List */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#24212b] mb-2 flex items-center justify-between">
              <span>Subtes Terpasang</span>
              <span className="text-[11px] text-[#595562] font-normal">
                {activeExamForRules?.rules?.length || 0} Subtes
              </span>
            </h4>

            {activeExamForRules?.rules && activeExamForRules.rules.length > 0 ? (
              <div className="divide-y divide-[#e6e1eb] border border-[#e6e1eb] rounded-[8px] bg-white overflow-hidden">
                {activeExamForRules.rules.map((rule) => {
                  const isEditingThis = editingRuleId === rule.id;
                  const sourceCats = rulesCategories.length > 0 ? rulesCategories : categories;
                  const catData = sourceCats.find((c) => c.id === rule.category_id || c.name === rule.category_name);
                  const ruleStock = Number(catData?.question_count ?? catData?.active_question_count ?? 0);

                  return (
                    <div key={rule.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1">
                        <strong className="text-[#24212b] text-sm">
                          {rule.category_name || rule.category_id}
                        </strong>
                        <div className="text-[11px] text-[#595562] mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>
                            Jumlah:{' '}
                            <strong className="text-[#583682]">{rule.question_count} Soal</strong>
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="text-[#287a58] font-medium">
                            Stok Th. {activeExamForRules?.year || new Date().getFullYear()}: {ruleStock} Soal
                          </span>
                          {totalQuestionsInActiveExam > 0 && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-gray-500">
                                {Math.round((rule.question_count / totalQuestionsInActiveExam) * 100)}% naskah
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={ruleStock > 0 ? ruleStock : 500}
                              value={editRuleCount}
                              onChange={(e) => setEditRuleCount(Number(e.target.value))}
                              className="w-16 h-8 px-2 bg-white border border-[#583682] rounded text-xs text-center font-bold"
                            />
                            <button
                              onClick={() => handleUpdateRuleCount(rule.id, rule.category_id, rule.category_name)}
                              disabled={savingRuleEdit}
                              className="px-2 py-1 bg-[#287a58] hover:bg-[#206346] text-white rounded text-[11px] font-bold transition"
                            >
                              Simpan
                            </button>
                            <button
                              onClick={() => setEditingRuleId(null)}
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] transition"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingRuleId(rule.id);
                                setEditRuleCount(rule.question_count);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Ubah Jumlah Soal"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                              title="Hapus Subtes dari Ujian"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[#595562] bg-[#faf9fc] p-4 rounded-[8px] border border-[#e6e1eb] text-center">
                Belum ada subtes. Tambahkan subtes di bawah untuk menyusun paket ujian.
              </div>
            )}
          </div>

          {/* Add New Rule Form */}
          {categories.length === 0 ? (
            <div className="p-4 bg-[#f8f6fc] border border-[#cfc2df] rounded-[8px] text-xs text-[#583682] space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <Info className="w-4 h-4" /> Belum Ada Kategori Subtes
              </div>
              <p className="text-[#595562]">
                Tambahkan kategori subtes (seperti TWK, TIU, TKP) terlebih dahulu.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRulesModalOpen(false);
                  handleTabChange('subtests');
                }}
                className="px-3 py-1.5 bg-[#583682] text-white rounded text-xs font-bold hover:bg-[#352148] transition inline-flex items-center gap-1.5"
              >
                Buka Master Subtes <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : availableCategoriesForExam.length === 0 ? (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-[8px] text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Seluruh subtes ({categories.length} subtes) telah terpasang di paket ujian ini.</span>
            </div>
          ) : (
            <form onSubmit={handleAddRule} className="p-4 bg-white border border-[#e6e1eb] rounded-[8px] space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#583682]">
                Tambah Subtes (Tahun {activeExamForRules?.year || new Date().getFullYear()})
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dropdown Subtes */}
                <div>
                  <label className="block text-xs font-bold text-[#24212b] mb-1">
                    Pilih Subtes <span className="text-[#b63b48]">*</span>
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleCategorySelectChange(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b] outline-none focus:border-[#583682]"
                  >
                    {availableCategoriesForExam.map((c) => {
                      const stock = Number(c.question_count ?? c.active_question_count ?? 0);
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code}) — {stock > 0 ? `[Stok Th. ${activeExamForRules?.year || new Date().getFullYear()}: ${stock} Soal Aktif]` : `[Stok Th. ${activeExamForRules?.year || new Date().getFullYear()} Kosong: 0 Soal]`}
                        </option>
                      );
                    })}
                  </select>

                  {/* Stock status indicator badge */}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {availableStock > 0 ? (
                      <span className="text-[11px] font-semibold text-[#287a58] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Tersedia di Bank Soal Th. {activeExamForRules?.year || new Date().getFullYear()}: <strong>{availableStock} Butir Soal</strong>
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-[#b63b48] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Stok Bank Soal Th. {activeExamForRules?.year || new Date().getFullYear()} Kosong (0 Butir).
                      </span>
                    )}
                  </div>
                </div>

                {/* Input Jumlah Butir Soal dengan Batas Maksimal Real-Time */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#24212b]">
                      Jumlah Butir Soal yang Ditarik <span className="text-[#b63b48]">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-[#583682]">
                      Maksimal: {availableStock} Butir (Th. {activeExamForRules?.year || new Date().getFullYear()})
                    </span>
                  </div>
                  <input
                    type="number"
                    min={availableStock > 0 ? 1 : 0}
                    max={availableStock}
                    disabled={availableStock === 0}
                    value={questionCount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val > availableStock) {
                        setQuestionCount(availableStock);
                        showToast(`Maksimal hanya dapat ditarik ${availableStock} butir sesuai stok di Bank Soal.`, 'warning');
                      } else {
                        setQuestionCount(val);
                      }
                    }}
                    className={`w-full h-10 px-3 border rounded text-xs text-[#24212b] outline-none font-bold ${
                      availableStock === 0
                        ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                        : 'bg-white border-[#e6e1eb] focus:border-[#583682]'
                    }`}
                    placeholder={availableStock > 0 ? `1 - ${availableStock}` : 'Stok bank soal 0'}
                  />
                  <div className="text-[10px] text-[#595562] mt-1 leading-relaxed">
                    {availableStock > 0 ? (
                      <span>
                        Dibatasi maksimal <strong>{availableStock} butir</strong> agar tidak melebihi stok yang tersedia di Bank Soal.
                      </span>
                    ) : (
                      <span className="text-[#b63b48]">
                        Subtes ini belum memiliki soal di Bank Soal. Silakan impor soal terlebih dahulu.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={savingRule}
                  disabled={availableStock === 0 || questionCount <= 0}
                  className="text-xs"
                >
                  {availableStock === 0 ? 'Stok Soal Kosong' : 'Tambahkan Subtes ke Ujian'}
                </Button>
              </div>
            </form>
          )}

          <div className="flex justify-end pt-2 border-t border-[#e6e1eb]">
            <Button variant="ghost" onClick={() => setRulesModalOpen(false)}>
              Selesai & Tutup
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
