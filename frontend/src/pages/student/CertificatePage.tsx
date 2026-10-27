import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { resultService } from '../../services';
import { Certificate, ExamResult } from '../../types';
import { formatWIBDate } from '../../utils/date';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorAlert } from '../../components/ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { Download, ShieldCheck, Printer, Award } from 'lucide-react';

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
      showToast('Sertifikat PDF berhasil diunduh!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunduh sertifikat.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-12 w-full space-y-6">
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
              Sertifikat digital resmi berstempel Dekan FIA UNIRA diterbitkan secara otomatis setelah Anda menyelesaikan sesi ujian dan memenuhi batas kelulusan.
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
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-10 w-full space-y-8">
      {/* 1. Section Head (no-print) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb] no-print">
        <div>
          <div className="eyebrow text-xs mb-1">SERTIFIKAT RESMI</div>
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
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handlePrintPDF}
            leftIcon={<Printer className="w-4 h-4" />}
            className="text-xs"
          >
            Cetak PDF
          </Button>
          <Button
            variant="primary"
            onClick={handleDownloadPDF}
            isLoading={downloading}
            leftIcon={<Download className="w-4 h-4" />}
            className="text-xs"
          >
            Unduh Dokumen PDF
          </Button>
        </div>
      </div>

      {/* 2. Authentic Certificate Frame matching Figma */}
      <div className="relative bg-[#fdfbf4] border border-[#d7cfbc] rounded-[4px] p-8 sm:p-14 text-center shadow-lg overflow-hidden">
        {/* Double Ornamental Inner Border */}
        <div className="absolute inset-4 border border-[#bca9ca] pointer-events-none" />
        <div className="absolute inset-6 border border-[#ddd3c2] pointer-events-none" />

        {/* Watermark */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-9xl font-display font-extrabold text-[#49316f]/5 select-none pointer-events-none tracking-tighter">
          CG
        </div>

        <div className="relative z-10 space-y-8">
          {/* Top Institutions */}
          <div className="flex justify-between items-center text-xs font-bold tracking-widest text-[#595562] uppercase">
            <span>UNIVERSITAS MADURA</span>
            <span>FAKULTAS ILMU ADMINISTRASI</span>
          </div>

          <div className="space-y-1 pt-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#583682]">
              CAT GOVERNANCE / ASSESSMENT STANDARD
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#24212b] tracking-tight">
              CERTIFICATE
              <br />
              <em className="text-[#583682] italic font-serif text-2xl sm:text-3xl font-normal">
                OF COMPETENCY
              </em>
            </h2>
            <p className="text-xs text-[#595562] pt-2">Diberikan secara terstandar kepada:</p>
          </div>

          {/* Student Name */}
          <div className="py-2">
            <h3 className="font-display font-bold text-2xl sm:text-3xl text-[#583682] border-b-2 border-[#583682] inline-block pb-1 px-4">
              {cert.student_name || cert.full_name || '-'}
            </h3>
            <p className="text-xs text-[#595562] mt-2">
              {cert.identifier?.startsWith('UMUM') ? 'No. Peserta' : 'NIM'}: <strong className="text-[#24212b]">{cert.identifier}</strong> · Instansi: {cert.institution || (cert.identifier?.startsWith('UMUM') ? 'Umum' : 'Fakultas Ilmu Administrasi')}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-[#595562]">atas keberhasilannya menyelesaikan evaluasi:</p>
            <h4 className="font-display font-bold text-base sm:text-lg text-[#24212b]">
              {cert.exam_title || 'Uji Kompetensi CAT'}
            </h4>
          </div>

          {/* Details Row */}
          <div className="grid grid-cols-3 gap-4 py-4 border-y border-[#d8cfdf] text-xs">
            <div>
              <div className="text-[10px] text-[#595562] font-semibold uppercase">NILAI / STATUS</div>
              <div className="font-bold text-[#287a58] mt-0.5">
                {cert.score} / 100 · LULUS
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#595562] font-semibold uppercase">NOMOR SERTIFIKAT</div>
              <div className="font-mono font-bold text-[#24212b] mt-0.5">
                {cert.certificate_no}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#595562] font-semibold uppercase">TANGGAL TERBIT</div>
              <div className="font-bold text-[#24212b] mt-0.5 uppercase">
                {formatWIBDate(issuedDate, { weekday: undefined })}
              </div>
            </div>
          </div>

          {/* Approval Sign & QR Code */}
          <div className="flex items-end justify-between pt-6 px-4">
            <div className="text-center">
              <div className="w-36 h-10 border-b border-[#24212b] mx-auto mb-2" />
              <div className="text-xs font-bold text-[#24212b]">Pejabat Berwenang</div>
              <div className="text-[10px] text-[#595562]">Fakultas Ilmu Administrasi</div>
            </div>

            <div className="flex items-center gap-3 text-left">
              <div className="w-16 h-16 bg-white border border-[#24212b] p-1 flex items-center justify-center font-bold text-xs shadow-xs">
                <span className="text-center font-mono">
                  CG
                  <br />
                  26
                </span>
              </div>
              <div className="text-[10px] text-[#595562] leading-tight font-semibold uppercase tracking-wider">
                PINDAI UNTUK
                <br />
                VERIFIKASI
              </div>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 pt-4">
            Dokumen resmi terverifikasi secara elektronik oleh CAT GOVERNANCE FIA Universitas Madura.
          </div>
        </div>
      </div>
    </div>
  );
};
