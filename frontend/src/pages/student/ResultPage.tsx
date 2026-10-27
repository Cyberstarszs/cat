import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { resultService } from '../../services';
import { ResultDetail } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorAlert, EmptyState } from '../../components/ui/EmptyState';
import {
  Award,
  CheckCircle2,
  XCircle,
  Download,
  HelpCircle,
  ArrowLeft,
  Calendar,
  FileCheck,
  Mail,
} from 'lucide-react';

export const ResultPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const resultId = searchParams.get('resultId') || searchParams.get('attemptId');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [result, setResult] = useState<ResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);

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
    setIsEmpty(false);
    try {
      if (resultId && resultId !== 'latest') {
        try {
          const data = await resultService.getResultById(resultId);
          setResult(data);
          return;
        } catch (specificErr) {
          console.warn('Could not load specific result, falling back to latest:', specificErr);
        }
      }

      // Fallback: fetch latest from my results
      const myResults = await resultService.getMyResults();
      if (myResults && myResults.length > 0) {
        const detail = await resultService.getResultById(myResults[0].id);
        setResult(detail);
      } else {
        setIsEmpty(true);
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
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
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

  if (isEmpty) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-12 w-full space-y-4">
        <div>
          <Link
            to="/dashboard"
            className="text-xs font-semibold text-[#583682] hover:underline inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Dashboard
          </Link>
        </div>
        <EmptyState
          title="Belum Ada Hasil Ujian"
          description="Akun Anda belum memiliki riwayat pengerjaan ujian atau hasil ujian Anda masih dalam proses penilaian oleh panitia."
          icon={<Award className="w-8 h-8 text-[#583682]" />}
          action={{
            label: 'Lihat Jadwal Ujian',
            onClick: () => navigate('/explore'),
          }}
        />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-12 w-full space-y-4">
        <ErrorAlert message={error || 'Hasil ujian tidak ditemukan.'} onRetry={fetchResult} />
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
    <div className="max-w-[800px] mx-auto px-6 py-12 w-full space-y-6">
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

        <div className="eyebrow mb-1">
          HASIL EVALUASI AKHIR
        </div>
        <h1 className="font-display font-bold text-3xl md:text-4xl text-[#24212b] mb-2">
          {passed ? 'Dinyatakan Lulus' : 'Belum Memenuhi Ambang Batas'}
        </h1>
        <p className="text-xs text-[#595562] max-w-md mx-auto mb-8">
          Ujian: <strong>{result.exam_title || result.session_name}</strong>
        </p>

        {/* Score Dial */}
        <div className="inline-block p-6 bg-[#faf9fc] rounded-[8px] border border-[#e6e1eb] min-w-[240px] mb-8">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#595562] mb-1">
            Nilai Akhir
          </div>
          <div
            className={`font-display font-extrabold text-5xl md:text-6xl ${
              passed ? 'text-[#287a58]' : 'text-[#b63b48]'
            }`}
          >
            {result.score}
          </div>
          <div className="text-xs text-[#595562] mt-2 font-medium">
            Ambang Batas: <strong className="text-[#24212b]">{result.passing_score}</strong> / 100
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-4 pt-4 border-t border-[#e6e1eb]">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {passed && result.certificate_id && (
              <Button
                variant="primary"
                onClick={handleDownloadPDF}
                isLoading={downloading}
                leftIcon={<Download className="w-4 h-4" />}
                className="bg-[#287a58] border-[#287a58] hover:bg-[#206346]"
              >
                Unduh Sertifikat PDF
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => setAppealModalOpen(true)}
              leftIcon={<HelpCircle className="w-4 h-4" />}
            >
              {result.has_appeal ? 'Lihat Sanggahan' : 'Ajukan Sanggahan'}
            </Button>

            <Link to="/history">
              <Button variant="ghost">Riwayat Ujian</Button>
            </Link>
          </div>

          {passed && result.certificate_id && (
            <div className="flex items-center justify-center gap-2 text-xs text-[#287a58] bg-[#eaf4ef] border border-[#bce2cf] py-2 px-4 rounded-[6px] max-w-lg mx-auto">
              <Mail className="w-4 h-4 shrink-0 text-[#287a58]" />
              <span>Sertifikat kelulusan resmi dengan lampiran PDF juga dikirimkan secara otomatis ke email Anda.</span>
            </div>
          )}
        </div>
      </Card>

      {/* Sanggah (Dispute / Appeal) Modal */}
      <Modal
        isOpen={appealModalOpen}
        onClose={() => setAppealModalOpen(false)}
        title="Sanggah Nilai Ujian"
        description="Ajukan sanggahan jika terdapat kekeliruan soal atau kunci jawaban."
        maxWidth="md"
      >
        {appealSuccess ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#287a58] mx-auto" />
            <h4 className="font-bold text-base text-[#24212b]">Sanggahan Terkirim</h4>
            <p className="text-xs text-[#595562]">
              Panitia ujian akan meninjau pengajuan Anda.
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
                  Sanggahan Anda sedang diperiksa oleh panitia.
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
              Sanggahan yang disetujui akan diverifikasi oleh panitia dan nilai yang terdampak akan disesuaikan otomatis.
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#24212b] mb-1.5">
                Alasan Sanggahan <span className="text-[#b63b48]">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Alasan sanggahan"
                className="w-full p-3 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none focus:border-[#583682]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
              <Button type="button" variant="ghost" onClick={() => setAppealModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" variant="primary" isLoading={submittingAppeal}>
                Kirim Sanggahan
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
