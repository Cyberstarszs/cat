import React, { useEffect, useState } from 'react';
import { examService } from '../../services';
import { ExamCategory } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import { Plus, Edit2, Trash2, FolderTree, Search } from 'lucide-react';

export const AdminSubtestsPage: React.FC = () => {
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

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ExamCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setSaving(true);
    try {
      if (editingCategory) {
        await examService.updateCategory(editingCategory.id, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
        });
        showToast('Kategori subtes berhasil diperbarui!', 'success');
      } else {
        await examService.createCategory({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
        });
        showToast('Kategori subtes baru berhasil ditambahkan!', 'success');
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan kategori.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    setDeleting(true);
    try {
      await examService.deleteCategory(categoryToDelete.id);
      showToast('Kategori subtes berhasil dihapus!', 'success');
      setDeleteModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus kategori. Pastikan tidak ada soal terkait.', 'error');
    } finally {
      setDeleting(false);
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">KOMPONEN UJIAN</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Manajemen Subtes & Kategori Soal
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Kelola subtes kompetensi (misal: Tes Wawasan Kebangsaan, Tata Kelola Publik, Kemampuan Analitis).
          </p>
        </div>

        <Button variant="primary" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
          Tambah Subtes Baru
        </Button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchCategories} />}

      {/* Filter / Search Bar */}
      <div className="max-w-md">
        <Input
          placeholder="Cari kode atau nama subtes..."
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
                          onClick={() => {
                            setCategoryToDelete(cat);
                            setDeleteModalOpen(true);
                          }}
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
        title={editingCategory ? 'Ubah Kategori Subtes' : 'Tambah Kategori Subtes Baru'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Kode Subtes"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Contoh: TWK, TKP, TIU"
            className="uppercase font-mono"
          />

          <Input
            label="Nama Subtes"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Tes Wawasan Kebangsaan"
          />

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#24212b] mb-1.5">
              Deskripsi Subtes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi singkat materi kompetensi yang diuji..."
              className="w-full p-3 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none focus:border-[#583682]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={saving}>
              {editingCategory ? 'Simpan Perubahan' : 'Tambahkan Subtes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Hapus Kategori Subtes"
        description={`Apakah Anda yakin ingin menghapus subtes "${categoryToDelete?.name}"?`}
      >
        <div className="space-y-4">
          <p className="text-xs text-[#b63b48] bg-[#fbeeed] p-3 rounded border border-[#f4c6cb]">
            Tindakan ini tidak dapat dibatalkan. Kategori tidak dapat dihapus jika masih ada butir soal yang menggunakannya.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteModalOpen(false)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              isLoading={deleting}
            >
              Hapus Permanen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
