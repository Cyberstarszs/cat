import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { resultService } from '../../services';
import { Certificate } from '../../types';
import { formatWIBDate } from '../../utils/date';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorAlert } from '../../components/ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { Download, ShieldCheck, Printer } from 'lucide-react';

export const CertificatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { id: paramId } = useParams<{ id?: string }>();
  const certId = paramId || searchParams.get('id');
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [cert, setCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCert = async () => {
      if (!certId) {
        try {
          const results = await resultService.getMyResults();
          const passed = results.find((r) => r.passed && r.certificate_id);
          if (passed?.certificate_id) {
            const data = await resultService.getCertificate(passed.certificate_id);
            setCert(data);
          } else {
            setError('Sertifikat belum tersedia. Sertifikat diterbitkan otomatis bagi peserta yang memenuhi batas kelulusan.');
          }
        } catch (err: any) {
          setError(err.message || 'Gagal memuat sertifikat.');
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await resultService.getCertificate(certId);
        setCert(data);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data sertifikat.');
      } finally {
        setLoading(false);
      }
    };

    fetchCert();
  }, [certId]);

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
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
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

  if (error || !cert) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-12 w-full">
        <ErrorAlert message={error || 'Sertifikat tidak ditemukan.'} />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/history')}>
            Lihat Riwayat Hasil
          </Button>
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
            onClick={() => navigate(`/verify?number=${cert.certificate_no}`)}
            className="text-xs"
          >
            Verifikasi Keaslian
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
