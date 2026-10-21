import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { questionService } from '../../services';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Layers,
  Search,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Check,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface PreviewOption {
  position: number;
  letter: string;
  text: string;
  is_correct: boolean;
}

interface PreviewRow {
  rowNumber: number;
  category: string;
  difficulty: number;
  weight: number;
  stem: string;
  options: PreviewOption[];
  options_count: number;
  key: string;
  explanation?: string | null;
  errors: string[];
}

interface PreviewResponse {
  success: boolean;
  filename: string;
  file_type: 'docx' | 'doc' | 'csv';
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  rows: PreviewRow[];
  valid_payload: any[];
}

export interface QuestionImportViewProps {
  onImportSuccess?: () => void;
  hideHeaderTitle?: boolean;
}

export const QuestionImportView: React.FC<QuestionImportViewProps> = ({
  onImportSuccess,
  hideHeaderTitle = false,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [importYear, setImportYear] = useState<number>(new Date().getFullYear());
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [committedCount, setCommittedCount] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showGuide, setShowGuide] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewData(null);
      setCommittedCount(null);
      setSearchQuery('');
      setSelectedCategory('all');
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoadingPreview(true);
    try {
      const data = await questionService.previewImportQuestions(file);
      setPreviewData(data);
      showToast(
        `Berhasil membaca ${data.total_rows || 0} butir soal dari berkas ${file.name}.`,
        'info'
      );
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses berkas soal.', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData?.valid_payload || previewData.valid_payload.length === 0) {
      showToast('Tidak ada butir soal valid yang dapat disimpan.', 'warning');
      return;
    }

    setCommitting(true);
    try {
      const res = await questionService.commitImportQuestions(previewData.valid_payload, importYear);
      const totalImported = res.total_imported || res.imported_count || previewData.valid_payload.length;
      setCommittedCount(totalImported);
      showToast(`Sukses menyimpan ${totalImported} butir soal ke bank soal aktif tahun ${importYear}!`, 'success');
      setPreviewData(null);
      setFile(null);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan butir soal ke database.', 'error');
    } finally {
      setCommitting(false);
    }
  };

  // Distinct categories in preview
  const categoriesInPreview = useMemo(() => {
    if (!previewData?.rows) return [];
    const counts: Record<string, number> = {};
    for (const r of previewData.rows) {
      counts[r.category] = (counts[r.category] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [previewData]);

  // Filtered rows for preview table
  const filteredRows = useMemo(() => {
    if (!previewData?.rows) return [];
    return previewData.rows.filter((r) => {
      const matchCat = selectedCategory === 'all' || r.category === selectedCategory;
      const matchSearch =
        !searchQuery ||
        r.stem.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.options.some((opt) => opt.text.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [previewData, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      {!hideHeaderTitle ? (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
          <div>
            <div className="text-[11px] font-bold text-[#583682] tracking-wider uppercase mb-1 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              BANK SOAL & ASESMEN AKADEMIK
            </div>
            <h1 className="font-display font-bold text-2xl text-[#24212b]">
              Impor Massal Butir Soal (DOC / DOCX / CSV)
            </h1>
            <p className="text-xs text-[#595562] mt-1 max-w-2xl leading-relaxed">
              Unggah berkas naskah soal berformat Microsoft Word (<code>.docx</code> / <code>.doc</code>) seperti template 
              <em> Tabulasi Soal Assessment LG</em> dengan kunci jawaban bertanda merah atau penanda kunci (<code>*</code> / <code>Kunci:</code>), atau berkas tabel CSV terstruktur.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/templates/Template_Soal_Assessment_FIA.docx"
              download="Template_Soal_Assessment_FIA.docx"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#cfc2df] hover:border-[#583682] rounded-[6px] text-xs font-semibold text-[#583682] hover:bg-[#faf9fc] transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Template Word (.docx)
            </a>
            <a
              href="/templates/Template_Soal_Assessment_FIA.csv"
              download="Template_Soal_Assessment_FIA.csv"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#cfc2df] hover:border-[#583682] rounded-[6px] text-xs font-semibold text-[#583682] hover:bg-[#faf9fc] transition shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Template CSV (.csv)
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f8f6fc] border border-[#e6e1eb] rounded-[8px]">
          <div className="text-xs text-[#595562]">
            Unduh template format baku sebelum mengunggah naskah soal:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/templates/Template_Soal_Assessment_FIA.docx"
              download="Template_Soal_Assessment_FIA.docx"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#cfc2df] hover:border-[#583682] rounded-[6px] text-xs font-semibold text-[#583682] hover:bg-[#faf9fc] transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh Template Word (.docx)
            </a>
            <a
              href="/templates/Template_Soal_Assessment_FIA.csv"
              download="Template_Soal_Assessment_FIA.csv"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#cfc2df] hover:border-[#583682] rounded-[6px] text-xs font-semibold text-[#583682] hover:bg-[#faf9fc] transition shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Unduh Template CSV (.csv)
            </a>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {committedCount !== null && (
        <div className="p-4 bg-[#eaf4ef] border border-[#bce2cf] rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#287a58]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-bold text-sm">Alhamdulillah, Impor Soal Berhasil!</span>
              <p className="text-xs text-[#287a58]/90 mt-0.5">
                Sebanyak <strong>{committedCount}</strong> butir soal telah berhasil disimpan ke bank soal aktif dan siap digunakan dalam paket ujian.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setCommittedCount(null)}
              className="text-xs bg-white text-[#287a58] border-[#bce2cf] hover:bg-[#eaf4ef]"
            >
              Impor Berkas Lain
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (onImportSuccess) {
                  onImportSuccess();
                } else {
                  navigate('/admin/questions');
                }
              }}
              className="text-xs bg-[#287a58] border-[#287a58] hover:bg-[#206346] text-white flex items-center gap-1.5"
            >
              Lihat Bank Soal
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Guide Toggle Card */}
      <div className="bg-[#faf9fc] border border-[#e6e1eb] rounded-[8px] p-4">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between text-left text-xs font-bold text-[#583682] hover:text-[#352148] transition"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#754ead]" />
            <span>Petunjuk Struktur Format Dokumen Word (.docx / .doc) & CSV</span>
          </div>
          {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showGuide && (
          <div className="mt-3 pt-3 border-t border-[#e6e1eb] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#595562]">
            <div className="space-y-2 bg-white p-3.5 rounded border border-[#e6e1eb]">
              <div className="font-bold text-[#24212b] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#583682]" />
                Format Dokumen Word (.docx / .doc)
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                <li>
                  <strong>Judul Subtes / Kategori:</strong> Ditulis di atas kelompok soal (contoh: <code>A. TES WAWASAN KEBANGSAAN (TWK)</code>, <code>B. TES INTELIGENSI UMUM (TIU)</code>, <code>C. TES KARAKTERISTIK PRIBADI (TKP)</code>).
                </li>
                <li>
                  <strong>Teks Soal:</strong> Berisi pertanyaan atau studi kasus (boleh multi-paragraf untuk soal bacaan/analisis).
                </li>
                <li>
                  <strong>Pilihan Opsi (A - E):</strong> Terdiri dari 5 pilihan opsi jawaban di bawah teks soal (bisa bertanda <code>A.</code>, <code>B.</code> atau berurutan).
                </li>
                <li>
                  <strong className="text-[#b63b48]">Kunci Jawaban:</strong> Sistem otomatis mendeteksi kunci dari teks font berwarna <span className="font-bold text-red-600">MERAH</span> (Word #FF0000), tanda bintang (<code>*</code>), label <code>(Kunci)</code> pada opsi, atau baris <code>Kunci: [A-E]</code>.
                </li>
              </ul>
            </div>

            <div className="space-y-2 bg-white p-3.5 rounded border border-[#e6e1eb]">
              <div className="font-bold text-[#24212b] flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#287a58]" />
                Format Tabel Berkas CSV (.csv)
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                <li>
                  <strong>Header Kolom:</strong> <code>kategori, tingkat, bobot, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, pembahasan</code>
                </li>
                <li>
                  <strong>Tingkat:</strong> Angka 1 (Mudah), 2 (Sedang), atau 3 (Sulit).
                </li>
                <li>
                  <strong>Kunci:</strong> Huruf pilihan yang benar (<code>A</code>, <code>B</code>, <code>C</code>, <code>D</code>, atau <code>E</code>).
                </li>
                <li>
                  <strong>Encoding:</strong> Simpan file dengan format UTF-8 agar karakter tanda baca dan aksen terbaca sempurna.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Upload Zone */}
      <Card hasShadow className="space-y-5 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#faf9fc] rounded-[8px] border border-[#e6e1eb]">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#24212b] mb-0.5">
              Tahun Soal untuk Berkas Impor
            </label>
            <p className="text-[11px] text-[#595562]">
              Seluruh butir soal yang berhasil diimpor dari berkas ini akan dicatat pada tahun yang dipilih.
            </p>
          </div>
          <div className="w-full sm:w-44">
            <input
              type="number"
              min={2000}
              max={2100}
              value={importYear}
              onChange={(e) => setImportYear(Number(e.target.value))}
              className="w-full h-10 px-3 bg-white border border-[#e6e1eb] rounded-[6px] text-xs font-bold text-[#24212b] outline-none focus:border-[#583682]"
            />
          </div>
        </div>

        <div className="border-2 border-dashed border-[#cfc2df] hover:border-[#583682] rounded-[10px] p-8 text-center bg-[#faf9fc]/50 hover:bg-[#faf9fc] transition">
          <div className="w-12 h-12 rounded-full bg-[#eae2f5] text-[#583682] flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="font-display font-bold text-base text-[#24212b] mb-1">
            Pilih atau Tarik Berkas Soal ke Sini
          </h3>
          <p className="text-xs text-[#595562] max-w-md mx-auto mb-4">
            Mendukung berkas <strong>Microsoft Word (.docx / .doc)</strong> dan <strong>Comma-Separated Values (.csv)</strong>.
          </p>

          <input
            type="file"
            accept=".docx,.doc,.csv"
            onChange={handleFileChange}
            id="question-file-upload"
            className="hidden"
          />
          <label htmlFor="question-file-upload">
            <span className="inline-flex min-h-[40px] px-6 rounded-[6px] font-sans font-bold text-xs tracking-wider uppercase items-center justify-center gap-2 bg-[#583682] text-white cursor-pointer hover:bg-[#352148] transition shadow-xs">
              {file ? `Ganti Berkas: ${file.name}` : 'Pilih Berkas (.DOC / .DOCX / .CSV)'}
            </span>
          </label>
        </div>

        {/* Selected File Details & Preview Action */}
        {file && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#faf9fc] rounded-[8px] border border-[#e6e1eb]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[6px] bg-white border border-[#e6e1eb] flex items-center justify-center shrink-0">
                {file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc') ? (
                  <FileText className="w-5 h-5 text-[#583682]" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5 text-[#287a58]" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-[#24212b]">{file.name}</div>
                <div className="text-[11px] text-[#595562] mt-0.5 flex items-center gap-2">
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                  <span>•</span>
                  <Badge variant={file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc') ? 'purple' : 'success'}>
                    {file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')
                      ? `Microsoft Word (${file.name.toLowerCase().endsWith('.doc') ? '.doc' : '.docx'})`
                      : 'CSV Spreadsheet'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                onClick={() => {
                  setFile(null);
                  setPreviewData(null);
                }}
                className="text-xs flex-1 sm:flex-none"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handlePreview}
                isLoading={loadingPreview}
                className="text-xs flex-1 sm:flex-none"
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Validasi & Pratinjau Soal
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Preview Section */}
      {previewData && (
        <Card hasShadow className="space-y-5 p-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-[#faf9fc] rounded-[8px] border border-[#e6e1eb]">
              <div className="text-[11px] text-[#595562] font-semibold">Total Butir Soal</div>
              <div className="font-display font-bold text-xl text-[#24212b] mt-1">
                {previewData.total_rows}
              </div>
            </div>

            <div className="p-3.5 bg-[#eaf4ef] rounded-[8px] border border-[#bce2cf]">
              <div className="text-[11px] text-[#287a58] font-semibold">Siap Diimpor (Valid)</div>
              <div className="font-display font-bold text-xl text-[#287a58] mt-1">
                {previewData.valid_rows}
              </div>
            </div>

            <div className="p-3.5 bg-[#fdf6ec] rounded-[8px] border border-[#f6ddba]">
              <div className="text-[11px] text-[#a96817] font-semibold">Memerlukan Perhatian</div>
              <div className="font-display font-bold text-xl text-[#a96817] mt-1">
                {previewData.invalid_rows}
              </div>
            </div>

            <div className="p-3.5 bg-[#eae2f5] rounded-[8px] border border-[#cfc2df]">
              <div className="text-[11px] text-[#583682] font-semibold">Kategori Terdeteksi</div>
              <div className="font-display font-bold text-xl text-[#583682] mt-1">
                {categoriesInPreview.length}
              </div>
            </div>
          </div>

          {/* Action Header & Commit CTA */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
            <div>
              <h3 className="font-display font-bold text-base text-[#24212b]">
                Pratinjau Butir Soal ({filteredRows.length} dari {previewData.total_rows})
              </h3>
              <p className="text-xs text-[#595562] mt-0.5">
                Periksa kesesuaian kategori, teks pertanyaan, opsi jawaban A–E, dan kunci yang terdeteksi sebelum menyimpan.
              </p>
            </div>

            <Button
              variant="primary"
              onClick={handleCommit}
              isLoading={committing}
              disabled={previewData.valid_rows === 0}
              className="bg-[#287a58] border-[#287a58] hover:bg-[#206346] text-xs font-bold py-2.5 px-5 shadow-xs shrink-0 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Simpan Semua Soal Tahun {importYear} ke Bank Soal ({previewData.valid_rows} Butir)
            </Button>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition ${
                  selectedCategory === 'all'
                    ? 'bg-[#583682] text-white shadow-xs'
                    : 'bg-[#faf9fc] text-[#595562] hover:bg-[#eae2f5] hover:text-[#583682]'
                }`}
              >
                Semua Subtes ({previewData.total_rows})
              </button>
              {categoriesInPreview.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition ${
                    selectedCategory === cat.name
                      ? 'bg-[#583682] text-white shadow-xs'
                      : 'bg-[#faf9fc] text-[#595562] hover:bg-[#eae2f5] hover:text-[#583682]'
                  }`}
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-[#754ead] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari kata kunci pertanyaan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full !pl-10 pr-3 py-1.5 text-xs bg-white border border-[#cfc2df] rounded-[6px] focus:outline-none focus:border-[#583682] text-[#24212b]"
              />
            </div>
          </div>

          {/* Table / List View */}
          <div className="border border-[#e6e1eb] rounded-[8px] overflow-hidden bg-white">
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold sticky top-0 z-10">
                  <tr>
                    <th className="px-3.5 py-3 w-12 text-center">No</th>
                    <th className="px-4 py-3 w-48">Kategori / Subtes</th>
                    <th className="px-4 py-3">Pertanyaan (Stem)</th>
                    <th className="px-4 py-3 w-28 text-center">Kunci</th>
                    <th className="px-4 py-3 w-24 text-center">Bobot</th>
                    <th className="px-4 py-3 w-28 text-center">Aksi / Opsi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e1eb]">
                  {filteredRows.map((row) => {
                    const isExpanded = expandedRow === row.rowNumber;
                    const hasErrors = row.errors && row.errors.length > 0;

                    let catVariant: 'purple' | 'info' | 'royal' | 'neutral' = 'neutral';
                    if (row.category.includes('Wawasan') || row.category.includes('TWK')) catVariant = 'purple';
                    else if (row.category.includes('Inteligens') || row.category.includes('TIU')) catVariant = 'info';
                    else if (row.category.includes('Karakteristik') || row.category.includes('TKP')) catVariant = 'royal';

                    return (
                      <React.Fragment key={row.rowNumber}>
                        <tr
                          className={`hover:bg-[#faf9fc] transition cursor-pointer ${
                            hasErrors ? 'bg-[#fbeeed]/40' : ''
                          }`}
                          onClick={() => setExpandedRow(isExpanded ? null : row.rowNumber)}
                        >
                          <td className="px-3.5 py-3 text-center font-mono font-bold text-[#595562]">
                            {row.rowNumber}
                          </td>

                          <td className="px-4 py-3">
                            <Badge variant={catVariant} className="text-[11px]">
                              {row.category}
                            </Badge>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#24212b] line-clamp-2">
                              {row.stem}
                            </div>
                            {hasErrors && (
                              <div className="text-[11px] text-[#b63b48] flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {row.errors.join(', ')}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#eaf4ef] text-[#287a58] font-bold text-xs border border-[#bce2cf]">
                              <Check className="w-3 h-3" />
                              Opsi {row.key}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-center font-mono text-[#595562]">
                            {row.weight?.toFixed(1) || '5.0'}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              className="text-xs text-[#583682] hover:text-[#352148] font-semibold inline-flex items-center gap-1"
                            >
                              <span>{isExpanded ? 'Tutup' : 'Lihat Opsi'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Option Breakdown */}
                        {isExpanded && (
                          <tr className="bg-[#faf9fc]/70">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="space-y-3 bg-white p-4 rounded-[6px] border border-[#e6e1eb]">
                                <div>
                                  <div className="text-[11px] font-bold text-[#595562] uppercase tracking-wider mb-1">
                                    Teks Lengkap Pertanyaan:
                                  </div>
                                  <div className="text-xs text-[#24212b] whitespace-pre-line leading-relaxed font-medium">
                                    {row.stem}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[11px] font-bold text-[#595562] uppercase tracking-wider mb-2">
                                    Pilihan Jawaban (A - E):
                                  </div>
                                  <div className="space-y-1.5">
                                    {row.options?.map((opt) => (
                                      <div
                                        key={opt.position}
                                        className={`flex items-start gap-2.5 p-2 rounded text-xs transition ${
                                          opt.is_correct
                                            ? 'bg-[#eaf4ef] border border-[#bce2cf] text-[#287a58] font-bold'
                                            : 'bg-[#faf9fc] text-[#24212b] border border-[#e6e1eb]'
                                        }`}
                                      >
                                        <span
                                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                                            opt.is_correct
                                              ? 'bg-[#287a58] text-white'
                                              : 'bg-[#e6e1eb] text-[#595562]'
                                          }`}
                                        >
                                          {opt.letter}
                                        </span>
                                        <div className="flex-1 mt-0.5">{opt.text}</div>
                                        {opt.is_correct && (
                                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#287a58] text-white shrink-0 font-bold">
                                            Kunci Jawaban
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {row.explanation && (
                                  <div className="pt-2 border-t border-[#e6e1eb]">
                                    <div className="text-[11px] font-bold text-[#583682] uppercase tracking-wider mb-0.5">
                                      Pembahasan:
                                    </div>
                                    <div className="text-xs text-[#595562] italic leading-relaxed">
                                      {row.explanation}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredRows.length === 0 && (
              <div className="p-8 text-center text-xs text-[#595562]">
                Tidak ada butir soal yang sesuai dengan kata kunci atau filter subtes yang dipilih.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};


export const AdminImportQuestionsPage: React.FC = () => {
  return <QuestionImportView />;
};
