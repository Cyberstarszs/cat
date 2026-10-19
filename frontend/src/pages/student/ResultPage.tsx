import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { resultService } from '../../services';
import { ResultDetail } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorAlert } from '../../components/ui/EmptyState';
import {
  Award,
  CheckCircle2,
  XCircle,
  Download,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  Calendar,
  FileCheck,
} from 'lucide-react';

export const ResultPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const resultId = searchParams.get('resultId');
  const { showToast } = useToast();

  const [result, setResult] = useState<ResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sanggah / Appeal modal state
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealSuccess, setAppealSuccess] = useState(false);

  // Download PDF state
  const [downloading, setDownloading] = useState(false);

  const fetchResult = async () => {
    setLoading(true);
    setError(null);
    try {
      if (resultId) {
        const data = await resultService.getResultById(resultId);
        setResult(data);
      } else {
        // Fallback: fetch latest from my results
        const myResults = await resultService.getMyResults();
        if (myResults.length > 0) {
          const detail = await resultService.getResultById(myResults[0].id);
          setResult(detail);
        } else {
          setError('Belum ada hasil ujian yang tersedia untuk akun ini.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat hasil penilaian ujian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResult();
  }, [resultId]);

  const handleDownloadPDF = async () => {
    if (!result?.certificate_id) return;
    setDownloading(true);
    try {
      const blob = await resultService.downloadCertificatePDF(result.certificate_id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sertifikat_${result.identifier || 'FIA'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Sertifikat berhasil diunduh!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunduh sertifikat.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result || !appealReason.trim()) return;

    setSubmittingAppeal(true);
    try {
      await resultService.submitAppeal(result.id, appealReason.trim());
      setAppealSuccess(true);
      showToast('Permohonan sanggah nilai berhasil dikirimkan ke panitia!', 'success');
      setTimeout(() => {
        setAppealModalOpen(false);
        fetchResult();
      }, 1500);
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirimkan sanggahan.', 'error');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-12 w-full space-y-6">
        <Skeleton className="h-10 w-1/3 mx-auto" />
        <Skeleton className="h-64 w-full rounded-[8px]" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-12 w-full">
        <ErrorAlert message={error || 'Hasil ujian tidak ditemukan.'} />
        <div className="mt-4">
          <Link to="/dashboard">
            <Button variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Kembali ke Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const passed = result.passed;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12 w-full space-y-8">
      <div>
        <Link to="/dashboard" className="text-xs font-semibold text-[#583682] hover:underline inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Dashboard
        </Link>
      </div>

      {/* Main Score Card */}
      <Card
        hasShadow
        className={`text-center py-10 px-8 border-2 ${
          passed ? 'border-[#287a58]' : 'border-[#b63b48]'
        } animate-in fade-in duration-200`}
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-[#faf9fc]">
          {passed ? (
            <CheckCircle2 className="w-10 h-10 text-[#287a58]" />
          ) : (
            <XCircle className="w-10 h-10 text-[#b63b48]" />
          )}
        </div>

        <div className="eyebrow mb-1">HASIL EVALUASI AKHIR</div>
        <h1 className="font-display font-bold text-3xl md:text-4xl text-[#24212b] mb-2">
          {passed ? 'Dinyatakan LULUS Kompetensi' : 'Belum Memenuhi Ambang Batas'}
        </h1>
        <p className="text-xs text-[#595562] max-w-md mx-auto mb-8">
          Ujian: <strong>{result.exam_title || result.session_name}</strong>
        </p>

        {/* Score Dial */}
        <div className="inline-block p-6 bg-[#faf9fc] rounded-[8px] border border-[#e6e1eb] min-w-[240px] mb-8">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#595562] mb-1">
            Skor Diperoleh
          </div>
          <div
            className={`font-display font-extrabold text-5xl md:text-6xl ${
              passed ? 'text-[#287a58]' : 'text-[#b63b48]'
            }`}
          >
            {result.score}
          </div>
          <div className="text-xs text-[#595562] mt-2 font-medium">
            Ambang Batas Kelulusan: <strong className="text-[#24212b]">{result.passing_score}</strong> / 100
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-[#e6e1eb]">
          {passed && result.certificate_id && (
            <Button
              variant="primary"
              onClick={handleDownloadPDF}
              isLoading={downloading}
              leftIcon={<Download className="w-4 h-4" />}
              className="bg-[#287a58] border-[#287a58] hover:bg-[#206346]"
            >
              Unduh Sertifikat PDF Resmi
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => setAppealModalOpen(true)}
            leftIcon={<HelpCircle className="w-4 h-4" />}
          >
            {result.has_appeal ? 'Lihat Status Sanggahan' : 'Ajukan Sanggah Nilai'}
          </Button>

          <Link to="/history">
            <Button variant="ghost">Riwayat Ujian Saya</Button>
          </Link>
        </div>
      </Card>

      {/* Sanggah (Dispute / Appeal) Modal */}
      <Modal
        isOpen={appealModalOpen}
        onClose={() => setAppealModalOpen(false)}
        title="Pengajuan Sanggahan Hasil Ujian"
        description="Gunakan hak sanggah jika Anda menemukan indikasi kesalahan kunci jawaban atau ambiguitas soal."
        maxWidth="md"
      >
        {appealSuccess ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#287a58] mx-auto" />
            <h4 className="font-bold text-base text-[#24212b]">Sanggahan Diterima</h4>
            <p className="text-xs text-[#595562]">
              Tim verifikator dan panitia ujian FIA akan mereview butir soal dan memberitahukan hasilnya kepada Anda.
            </p>
          </div>
        ) : result.has_appeal ? (
          <div className="space-y-4">
            <div className="p-4 bg-[#faf9fc] rounded border border-[#e6e1eb] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#24212b]">Status Sanggahan</span>
                <Badge
                  variant={
                    result.appeal_status === 'accepted' || result.appeal_status === 'approved'
                      ? 'success'
                      : result.appeal_status === 'rejected'
                      ? 'danger'
                      : 'purple'
                  }
                >
                  {result.appeal_status === 'accepted' || result.appeal_status === 'approved'
                    ? 'DISETUJUI'
                    : result.appeal_status === 'rejected'
                    ? 'DITOLAK'
                    : 'SEDANG DITINJAU'}
                </Badge>
              </div>

              {result.appeal_message && (
                <div>
                  <div className="text-[11px] font-bold text-[#595562] uppercase tracking-wider">Catatan Anda:</div>
                  <div className="text-xs text-[#24212b] mt-1 p-2.5 bg-white rounded border border-[#e6e1eb] whitespace-pre-wrap">
                    {result.appeal_message}
                  </div>
                </div>
              )}

              {result.appeal_response ? (
                <div className="pt-2 border-t border-[#e6e1eb]">
                  <div className="text-[11px] font-bold text-[#583682] uppercase tracking-wider">Tanggapan Panitia:</div>
                  <div className="text-xs text-[#24212b] mt-1 p-2.5 bg-[#eae2f5]/40 rounded border border-[#e6e1eb] whitespace-pre-wrap">
                    {result.appeal_response}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-[#595562] italic">
                  Sanggahan Anda sedang dalam antrean verifikasi oleh panitia dan tim penguji.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-[#e6e1eb]">
              <Button type="button" variant="secondary" onClick={() => setAppealModalOpen(false)}>
                Tutup
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitAppeal} className="space-y-4">
            <div className="text-xs text-[#595562] leading-relaxed p-3 bg-[#faf9fc] rounded border border-[#e6e1eb]">
              Sesuai ketentuan, sanggahan yang diterima akan diuji terhadap riwayat kunci jawaban. Jika sanggahan disetujui, nilai seluruh peserta yang terdampak akan dihitung ulang secara otomatis (*auto-regrade*).
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#24212b] mb-1.5">
                Alasan / Catatan Sanggahan <span className="text-[#b63b48]">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Tuliskan nomor soal dan argumen sanggahan Anda secara jelas dan objektif..."
                className="w-full p-3 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none focus:border-[#583682]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
              <Button type="button" variant="ghost" onClick={() => setAppealModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" variant="primary" isLoading={submittingAppeal}>
                Kirimkan Sanggahan
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
