import React, { useEffect, useState } from 'react';
import { examService } from '../../services';
import { Exam, ExamCategory } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import { Plus, Edit2, Trash2, Sliders, Clock, Award, FileText, Search } from 'lucide-react';

export const AdminExamsPage: React.FC = () => {
  const { showToast } = useToast();
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
  const [passingScore, setPassingScore] = useState(70);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [savingExam, setSavingExam] = useState(false);

  // Rules Modal (Configure Questions per Category)
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [activeExamForRules, setActiveExamForRules] = useState<Exam | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [savingRule, setSavingRule] = useState(false);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchExamsAndCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const [examsData, catData] = await Promise.all([
        examService.getExams(),
        examService.getCategories(),
      ]);
      setExams(examsData);
      setCategories(catData);
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
    setTitle('');
    setCode('');
    setDescription('');
    setPassingScore(70);
    setDurationMinutes(90);
    setExamModalOpen(true);
  };

  const openEditExam = (ex: Exam) => {
    setEditingExam(ex);
    setTitle(ex.title);
    setCode(ex.code);
    setDescription(ex.description || '');
    setPassingScore(ex.passing_score);
    setDurationMinutes(ex.duration_minutes);
    setExamModalOpen(true);
  };

  const openRulesModal = async (ex: Exam) => {
    try {
      const detailed = await examService.getExamById(ex.id);
      setActiveExamForRules(detailed);
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
          passing_score: Number(passingScore),
          duration_minutes: Number(durationMinutes),
        });
        showToast('Ujian berhasil diperbarui!', 'success');
      } else {
        await examService.createExam({
          title: title.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
          passing_score: Number(passingScore),
          duration_minutes: Number(durationMinutes),
        });
        showToast('Ujian baru berhasil dibuat!', 'success');
      }
      setExamModalOpen(false);
      fetchExamsAndCategories();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan data ujian.', 'error');
    } finally {
      setSavingExam(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExamForRules || !selectedCategory) return;
    setSavingRule(true);
    try {
      await examService.addRule(activeExamForRules.id, selectedCategory, Number(questionCount));
      showToast('Komposisi soal berhasil ditambahkan ke ujian!', 'success');
      const updated = await examService.getExamById(activeExamForRules.id);
      setActiveExamForRules(updated);
      fetchExamsAndCategories();
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan aturan komposisi soal.', 'error');
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!activeExamForRules) return;
    try {
      await examService.deleteRule(activeExamForRules.id, ruleId);
      showToast('Aturan kategori soal dihapus.', 'success');
      const updated = await examService.getExamById(activeExamForRules.id);
      setActiveExamForRules(updated);
      fetchExamsAndCategories();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus aturan.', 'error');
    }
  };

  const handleDeleteExam = async () => {
    if (!examToDelete) return;
    setDeleting(true);
    try {
      await examService.deleteExam(examToDelete.id);
      showToast('Ujian berhasil dihapus!', 'success');
      setDeleteModalOpen(false);
      fetchExamsAndCategories();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus ujian.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const filteredExams = exams.filter(
    (ex) =>
      ex.title.toLowerCase().includes(search.toLowerCase()) ||
      ex.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">PROGRAM EVALUASI</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Manajemen Ujian Kompetensi
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Konfigurasi standar nilai kelulusan (*passing score*), batas durasi pengerjaan, dan komposisi subtes.
          </p>
        </div>

        <Button variant="primary" onClick={openCreateExam} leftIcon={<Plus className="w-4 h-4" />}>
          Buat Ujian Baru
        </Button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchExamsAndCategories} />}

      <div className="max-w-md">
        <Input
          placeholder="Cari kode atau judul ujian..."
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
        ) : filteredExams.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Belum Ada Ujian"
              description="Buat ujian baru untuk mulai menjadwalkan sesi uji kompetensi bagi mahasiswa."
              icon={<FileText className="w-8 h-8 text-[#583682]" />}
              action={{ label: 'Buat Ujian', onClick: openCreateExam }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-3.5">Kode</th>
                  <th className="px-6 py-3.5">Judul Ujian</th>
                  <th className="px-6 py-3.5">Passing Score</th>
                  <th className="px-6 py-3.5">Durasi</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e1eb]">
                {filteredExams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-[#faf9fc]/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-[#583682]">
                      <span className="bg-[#eae2f5] px-2 py-0.5 rounded">{ex.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#24212b] text-sm">{ex.title}</div>
                      <div className="text-[11px] text-[#595562] truncate max-w-sm mt-0.5">
                        {ex.description || 'Tanpa deskripsi'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#24212b]">
                      {ex.passing_score} / 100
                    </td>
                    <td className="px-6 py-4 text-[#595562]">
                      {ex.duration_minutes} Menit
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={ex.status === 'active' ? 'success' : 'neutral'}>
                        {ex.status === 'active' ? 'Aktif' : 'Draft'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openRulesModal(ex)}
                          className="p-1.5 text-[#583682] hover:bg-[#eae2f5] rounded transition"
                          title="Atur Komposisi Soal"
                        >
                          <Sliders className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditExam(ex)}
                          className="p-1.5 text-gray-500 hover:text-[#583682] hover:bg-[#eae2f5] rounded transition"
                          title="Ubah Ujian"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setExamToDelete(ex);
                            setDeleteModalOpen(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-[#b63b48] hover:bg-[#fbeeed] rounded transition"
                          title="Hapus Ujian"
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
      </Card>

      {/* Exam Create / Edit Modal */}
      <Modal
        isOpen={examModalOpen}
        onClose={() => setExamModalOpen(false)}
        title={editingExam ? 'Ubah Data Ujian' : 'Buat Ujian Baru'}
      >
        <form onSubmit={handleSaveExam} className="space-y-4">
          <Input
            label="Kode Ujian"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Contoh: LG-2026, UJI-FIA-01"
            className="uppercase font-mono"
          />

          <Input
            label="Judul Ujian"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Uji Kompetensi Kepemimpinan Administrasi Publik"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Passing Score (0-100)"
              required
              min={1}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
            />
            <Input
              type="number"
              label="Durasi (Menit)"
              required
              min={1}
              max={300}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#24212b] mb-1.5">
              Deskripsi Singkat
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi mengenai tujuan dan materi uji kompetensi..."
              className="w-full p-3 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none focus:border-[#583682]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button type="button" variant="ghost" onClick={() => setExamModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={savingExam}>
              {editingExam ? 'Simpan Perubahan' : 'Buat Ujian'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rules Modal (Questions per Category) */}
      <Modal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
        title={`Komposisi Soal: ${activeExamForRules?.title}`}
        description="Tentukan jumlah butir soal yang ditarik dari setiap subtes untuk paket ujian peserta."
        maxWidth="lg"
      >
        <div className="space-y-6">
          {/* Existing Rules List */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#24212b] mb-2">
              Aturan Subtes Saat Ini
            </h4>

            {activeExamForRules?.rules && activeExamForRules.rules.length > 0 ? (
              <div className="divide-y divide-[#e6e1eb] border border-[#e6e1eb] rounded bg-[#faf9fc]">
                {activeExamForRules.rules.map((rule) => (
                  <div key={rule.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-[#24212b]">{rule.category_name || rule.category_id}</strong>
                      <span className="text-[#595562] ml-2">({rule.question_count} Soal)</span>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 text-[#b63b48] hover:bg-[#fbeeed] rounded transition"
                      title="Hapus Aturan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#595562] italic bg-[#faf9fc] p-3 rounded border border-[#e6e1eb]">
                Belum ada subtes yang ditugaskan ke ujian ini.
              </p>
            )}
          </div>

          {/* Add New Rule Form */}
          <form onSubmit={handleAddRule} className="p-4 bg-white border border-[#e6e1eb] rounded space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#583682]">
              Tambah Subtes ke Ujian
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#24212b] mb-1">Pilih Subtes</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#24212b] mb-1">Jumlah Butir Soal</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" isLoading={savingRule} className="text-xs">
                Tambahkan Subtes
              </Button>
            </div>
          </form>

          <div className="flex justify-end pt-2 border-t border-[#e6e1eb]">
            <Button variant="ghost" onClick={() => setRulesModalOpen(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Exam Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Hapus Ujian"
        description={`Apakah Anda yakin ingin menghapus ujian "${examToDelete?.title}"?`}
      >
        <div className="space-y-4">
          <p className="text-xs text-[#b63b48] bg-[#fbeeed] p-3 rounded border border-[#f4c6cb]">
            Ujian tidak dapat dihapus jika telah memiliki sesi aktif atau riwayat pengerjaan peserta.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteModalOpen(false)}>
              Batal
            </Button>
            <Button type="button" variant="danger" onClick={handleDeleteExam} isLoading={deleting}>
              Hapus Permanen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
