import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { resultService } from '../../services';
import { Certificate, ExamResult } from '../../types';
import { formatWIBDate } from '../../utils/date';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorAlert } from '../../components/ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { Download, ShieldCheck, Printer, Award, ExternalLink } from 'lucide-react';
import certTemplateImg from '../../assets/templete_sertifikat.jpg';

export const CertificatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { id: paramId } = useParams<{ id?: string }>();
  const certId = paramId || searchParams.get('id');
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [cert, setCert] = useState<Certificate | null>(null);
  const [availableCerts, setAvailableCerts] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [hasNoCertificate, setHasNoCertificate] = useState(false);

  const fetchCert = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    setHasNoCertificate(false);

    if (!certId) {
      try {
        const results = await resultService.getMyResults();
        const passedList = (results || []).filter((r) => r.passed && r.certificate_id);
        setAvailableCerts(passedList);

        if (passedList.length > 0 && passedList[0].certificate_id) {
          const data = await resultService.getCertificate(passedList[0].certificate_id);
          setCert(data);
        } else {
          setHasNoCertificate(true);
        }
      } catch (err: any) {
        setApiError(err.message || 'Gagal memuat sertifikat.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const data = await resultService.getCertificate(certId);
      setCert(data);
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.status === 404) {
        setHasNoCertificate(true);
      } else {
        setApiError(err.message || 'Gagal memuat data sertifikat.');
      }
    } finally {
      setLoading(false);
    }
  }, [certId]);

  useEffect(() => {
    fetchCert();
  }, [fetchCert]);

  const handlePrintPDF = () => {
    showToast('Membuka dialog cetak PDF...', 'info');
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleDownloadPDF = async () => {
    if (!cert?.id) return;
    setDownloading(true);
    try {
      const blob = await resultService.downloadCertificatePDF(cert.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sertifikat_${cert.certificate_no}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      showToast('Sertifikat PDF resmi berhasil diunduh!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunduh sertifikat.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[840px] mx-auto px-6 py-12 w-full space-y-6">
        <Skeleton className="h-8 w-1/3 mx-auto" />
        <Skeleton className="h-96 w-full rounded-[8px]" />
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-12 w-full space-y-4">
        <ErrorAlert
          title="Kendala Koneksi Server"
          message={apiError}
          onRetry={fetchCert}
        />
        <div>
          <Button variant="secondary" onClick={() => navigate('/history')}>
            Lihat Riwayat Hasil
          </Button>
        </div>
      </div>
    );
  }

  if (hasNoCertificate || !cert) {
    return (
      <div className="max-w-[720px] mx-auto px-6 py-14 w-full">
        <div className="bg-white border border-[#e6e1eb] rounded-[10px] p-8 md:p-12 text-center shadow-sm space-y-5">
          <div className="w-16 h-16 bg-[#eae2f5] text-[#583682] rounded-full flex items-center justify-center mx-auto shadow-xs">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="eyebrow text-xs">DOKUMEN KELULUSAN</div>
            <h2 className="font-display font-bold text-2xl text-[#24212b]">
              Sertifikat Belum Tersedia
            </h2>
            <p className="text-xs text-[#595562] max-w-md mx-auto leading-relaxed">
              Sertifikat digital resmi berstempel Dekan FIA UNIRA diterbitkan secara otomatis setelah Anda menyelesaikan sesi ujian dan dinyatakan lulus.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => navigate('/explore')}
              className="text-xs h-9 px-5"
            >
              Periksa Jadwal Ujian
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/history')}
              className="text-xs h-9 px-5"
            >
              Lihat Riwayat Asesmen
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const issuedDate = new Date(cert.issued_at || new Date());

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      {/* 1. Header Control Bar (no-print) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb] no-print">
        <div>
          <div className="eyebrow text-xs mb-1">DOKUMEN KELULUSAN RESMI</div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-[#24212b]">
            Sertifikat Kelulusan
          </h1>
          {availableCerts.length > 1 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-[#595562]">Pilih Sertifikat:</span>
              <select
                value={cert.id}
                onChange={(e) => navigate(`/certificates?id=${e.target.value}`)}
                className="text-xs border border-[#e6e1eb] rounded px-2.5 py-1 bg-white text-[#24212b] font-medium"
              >
                {availableCerts.map((ac) => (
                  <option key={ac.certificate_id} value={ac.certificate_id}>
                    {ac.exam_title || 'Uji Kompetensi'} ({ac.certificate_no || 'Resmi'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => navigate(`/verify/${cert.verification_code}`)}
            leftIcon={<ShieldCheck className="w-4 h-4 text-[#583682]" />}
            className="text-xs"
          >
            Verifikasi Keabsahan
          </Button>
          <Button
            variant="secondary"
            onClick={handlePrintPDF}
            leftIcon={<Printer className="w-4 h-4" />}
            className="text-xs"
          >
            Cetak
          </Button>
          <Button
            variant="primary"
            onClick={handleDownloadPDF}
            isLoading={downloading}
            leftIcon={<Download className="w-4 h-4" />}
            className="text-xs font-semibold"
          >
            Unduh Dokumen PDF
          </Button>
        </div>
      </div>

      {/* 2. Authentic Certificate Container (Rendered exactly on top of templete_sertifikat.jpg) */}
      <div className="relative w-full aspect-[1439/1057] rounded-lg shadow-xl overflow-hidden border border-[#d7cfbc] bg-white select-none print:shadow-none print:border-none print:rounded-none">
        {/* Template Image Background */}
        <img
          src={certTemplateImg}
          alt="Sertifikat CAT Governance"
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* Dynamic Field 1: Nama Lengkap Peserta (Tepat di bawah 'Dengan ini menyatakan bahwa') */}
        <div className="absolute top-[38.2%] left-0 w-full text-center px-8 flex items-center justify-center">
          <span className="font-bold text-[#340E63] text-[clamp(14px,2.4vw,34px)] tracking-wide leading-tight font-sans">
            {(cert.student_name || cert.full_name || '-').toUpperCase()}
          </span>
        </div>

        {/* Dynamic Field 2: Nama Ujian / Asesmen (Tepat di bawah 'telah mengikuti dan menyelesaikan :') */}
        <div className="absolute top-[49.6%] left-0 w-full text-center px-12 flex items-center justify-center">
          <span className="font-bold text-[#340E63] text-[clamp(12px,1.8vw,26px)] tracking-wide leading-tight font-sans">
            {(cert.exam_title || 'ASESMEN KOMPETENSI').toUpperCase()}
          </span>
        </div>

        {/* Dynamic Field 3: Nilai Asesmen (Tepat di dalam badge pita ungu) */}
        <div className="absolute top-[64.5%] left-0 w-full h-[6.5%] flex items-center justify-center">
          <span className="font-bold text-white text-[clamp(10px,1.6vw,22px)] tracking-wider font-sans">
            NILAI ASESMEN: {Number.isInteger(Number(cert.score)) ? Number(cert.score) : Number(cert.score).toFixed(1)}/100
          </span>
        </div>

        {/* Dynamic Field 4: Kota & Tanggal Penerbitan (Kanan atas garis, miring) */}
        <div className="absolute top-[80.4%] right-[5.6%] text-right flex items-center justify-end">
          <span className="italic text-[#1E1B26] text-[clamp(9px,1.25vw,17px)] font-sans">
            Pamekasan, {formatWIBDate(issuedDate, { weekday: undefined })}
          </span>
        </div>

        {/* Dynamic Field 5 & 6: Barcode / QR Code & Nomor Sertifikat (Di kiri bawah) */}
        <div className="absolute top-[74.55%] left-[8.62%] w-[10.84%] flex flex-col items-center">
          {cert.qr_code_url ? (
            <img
              src={cert.qr_code_url}
              alt="QR Code Verifikasi"
              className="w-full aspect-square bg-white p-0.5 rounded-xs"
            />
          ) : (
            <div className="w-full aspect-square bg-white border border-[#e6e1eb] flex items-center justify-center text-[10px] text-gray-400 font-mono">
              QR
            </div>
          )}
          <span className="font-bold text-[#1E1B26] text-[clamp(8px,0.95vw,14px)] text-center mt-2 font-mono tracking-tight">
            {cert.certificate_no}
          </span>
        </div>

        {/* Revoked Overlay Watermark */}
        {cert.status === 'revoked' && (
          <div className="absolute inset-0 bg-red-900/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="transform -rotate-25 border-4 border-red-600 bg-red-600/90 text-white font-extrabold text-2xl sm:text-4xl px-8 py-3 rounded-lg shadow-2xl tracking-widest uppercase">
              DICABUT / TIDAK BERLAKU
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Information Bar (no-print) */}
      <div className="p-4 bg-white border border-[#e6e1eb] rounded-lg shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#595562] no-print">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#287a58]" />
          <span>Sertifikat dilengkapi tanda tangan digital dan QR code verifikasi keabsahan dokumen.</span>
        </div>
        <button
          onClick={() => navigate(`/verify/${cert.verification_code}`)}
          className="text-[#583682] hover:underline font-bold flex items-center gap-1 cursor-pointer shrink-0"
        >
          Cek status keabsahan <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
