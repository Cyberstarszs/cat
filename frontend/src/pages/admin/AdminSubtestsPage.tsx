import React, { useEffect, useState } from 'react';
import { examService } from '../../services';
import { ExamCategory } from '../../types';
import { useToast } from '../../context/ToastContext';
import { alert } from '../../utils/alert';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import { Plus, Edit2, Trash2, FolderTree, Search } from 'lucide-react';

export interface SubtestsManagerViewProps {
  onCategoryChanged?: () => void;
  hideHeaderTitle?: boolean;
}

export const SubtestsManagerView: React.FC<SubtestsManagerViewProps> = ({
  onCategoryChanged,
  hideHeaderTitle = false,
}) => {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExamCategory | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await examService.getCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar subtes/kategori.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setCode('');
    setDescription('');
    setModalOpen(true);
  };

  const openEditModal = (cat: ExamCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setCode(cat.code);
    setDescription(cat.description || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      showToast('Nama dan kode subtes wajib diisi.', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (editingCategory) {
        await examService.updateCategory(editingCategory.id, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
        });
        alert.toast('Kategori subtes berhasil diperbarui!', 'success');
      } else {
        await examService.createCategory({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
        });
        alert.toast('Kategori subtes baru berhasil ditambahkan!', 'success');
      }
      setModalOpen(false);
      fetchCategories();
      if (onCategoryChanged) onCategoryChanged();
    } catch (err: any) {
      alert.error('Gagal Menyimpan Subtes', err?.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: ExamCategory) => {
    const confirmed = await alert.confirm({
      title: 'Hapus Kategori Subtes?',
      text: `Apakah Anda yakin ingin menghapus subtes "${cat.name}" (${cat.code})? Kategori tidak dapat dihapus jika masih ada butir soal yang tertaut.`,
      confirmButtonText: 'Ya, Hapus Subtes',
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      await examService.deleteCategory(cat.id);
      alert.toast(`Subtes ${cat.name} berhasil dihapus!`, 'success');
      fetchCategories();
      if (onCategoryChanged) onCategoryChanged();
    } catch (err: any) {
      alert.error('Gagal Menghapus Subtes', err?.response?.data?.message || err.message || 'Pastikan tidak ada butir soal yang menggunakan subtes ini.');
    }
  };

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeaderTitle ? (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
          <div>
            <div className="eyebrow mb-1">SUBTES SOAL</div>
            <h1 className="font-display font-bold text-2xl text-[#24212b]">
              Subtes Soal
            </h1>
            <p className="text-xs text-[#595562] mt-0.5">
              Kelola kategori subtes untuk komposisi paket ujian.
            </p>
          </div>

          <Button variant="primary" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
            Tambah Subtes
          </Button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
          <div>
            <h2 className="font-display font-bold text-lg text-[#24212b]">
              Daftar Subtes Soal
            </h2>
            <p className="text-xs text-[#595562] mt-0.5">
              Kategori subtes yang digunakan dalam komposisi paket ujian.
            </p>
          </div>

          <Button variant="primary" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
            Tambah Subtes
          </Button>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={fetchCategories} />}

      {/* Filter / Search Bar */}
      <div className="max-w-md">
        <Input
          placeholder="Cari subtes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-gray-400" />}
        />
      </div>

      {/* Table Card */}
      <Card hasShadow className="overflow-hidden p-0">
        {loading ? (
          <div className="p-6">
            <CardSkeleton />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Belum Ada Subtes"
              description="Tambahkan kategori subtes baru untuk mulai menyusun bank soal dan aturan ujian."
              icon={<FolderTree className="w-8 h-8 text-[#583682]" />}
              action={{ label: 'Tambah Subtes', onClick: openCreateModal }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-3.5">Kode</th>
                  <th className="px-6 py-3.5">Nama Subtes</th>
                  <th className="px-6 py-3.5">Deskripsi</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e1eb]">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-[#faf9fc]/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-[#583682]">
                      <span className="bg-[#eae2f5] px-2 py-0.5 rounded">{cat.code}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#24212b] text-sm">{cat.name}</td>
                    <td className="px-6 py-4 text-[#595562] max-w-md truncate">
                      {cat.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(cat)}
                          className="p-1.5 text-gray-500 hover:text-[#583682] hover:bg-[#eae2f5] rounded transition"
                          title="Ubah Subtes"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 text-gray-500 hover:text-[#b63b48] hover:bg-[#fbeeed] rounded transition"
                          title="Hapus Subtes"
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCategory ? 'Ubah Subtes' : 'Tambah Subtes Baru'}
        description={editingCategory ? 'Perbarui informasi dan kode kategori subtes.' : 'Tambahkan kategori soal baru untuk pembagian bank soal.'}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="text-xs">
              Batal
            </Button>
            <Button type="submit" form="subtest-form" variant="primary" isLoading={saving} className="text-xs">
              {editingCategory ? 'Simpan Perubahan' : 'Simpan Subtes'}
            </Button>
          </div>
        }
      >
        <form id="subtest-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="Kode Subtes"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Kode subtes (cth: TIU, TWK, TKP)"
            className="uppercase font-mono"
            helperText="Gunakan singkatan ringkas huruf kapital."
          />

          <Input
            label="Nama Subtes"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cth: Tes Inteligensi Umum"
          />

          <div>
            <label className="block text-xs font-bold text-[#24212b] mb-1.5">
              Deskripsi Subtes (Opsional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi materi atau cakupan subtes"
              className="w-full p-3 bg-white border border-[#e6e1eb] rounded text-xs text-[#24212b] outline-none focus:border-[#583682]"
            />
          </div>
        </form>
      </Modal>


    </div>
  );
};


export const AdminSubtestsPage: React.FC = () => {
  return <SubtestsManagerView />;
};
