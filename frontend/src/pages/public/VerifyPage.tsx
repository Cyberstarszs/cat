import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { resultService } from '../../services';
import { VerifyCertificateResponse } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorAlert } from '../../components/ui/EmptyState';
import { ShieldCheck, ShieldAlert, Search, Award, Calendar, User, Building, QrCode } from 'lucide-react';
import { formatWIBDate, formatWIBDateTime } from '../../utils/date';

export const VerifyPage: React.FC = () => {
  const { code: pathCode } = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  const queryCode = searchParams.get('code') || searchParams.get('number');

  const [inputCode, setInputCode] = useState(pathCode || queryCode || '');
  const [certificate, setCertificate] = useState<VerifyCertificateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const performVerification = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const data = await resultService.verifyCertificate(codeToVerify.trim());
      setCertificate(data);
    } catch (err: any) {
      setCertificate(null);
      setError(err.message || 'Sertifikat dengan kode tersebut tidak ditemukan dalam pangkalan data FIA.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = pathCode || queryCode;
    if (initial) {
      setInputCode(initial);
      performVerification(initial);
    }
  }, [pathCode, queryCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(inputCode);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-14 w-full">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
        <div className="eyebrow flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#583682]" />
          VERIFIKASI DIGITAL
        </div>
        <h1 className="font-display font-bold text-3xl md:text-4xl text-[#24212b]">
          Cek Keaslian Sertifikat
        </h1>
        <p className="text-xs md:text-sm text-[#595562] leading-relaxed">
          Masukkan kode verifikasi sertifikat untuk memeriksa keabsahannya.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="max-w-xl mx-auto mb-10">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Kode verifikasi (contoh: A1B2C3D4E5F6)"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            leftIcon={<QrCode className="w-4 h-4 text-gray-400" />}
            className="font-mono tracking-widest text-center uppercase"
            required
          />
          <Button type="submit" variant="primary" isLoading={loading} rightIcon={<Search className="w-4 h-4" />}>
            Cek Sertifikat
          </Button>
        </form>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-48 w-full rounded-[8px]" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="max-w-2xl mx-auto">
          <ErrorAlert title="Sertifikat Tidak Ditemukan" message={error} />
        </div>
      )}

      {/* Certificate Verification Result Card */}
      {certificate && !loading && (
        <div className="max-w-2xl mx-auto">
          <Card
            hasShadow
            className={`border-2 ${
              certificate.is_valid ? 'border-[#287a58]' : 'border-[#b63b48]'
            } animate-in fade-in zoom-in-95 duration-200`}
          >
            {/* Status Header Badge */}
            <div className="flex items-center justify-between pb-6 border-b border-[#e6e1eb] mb-6">
              <div className="flex items-center gap-3">
                {certificate.is_valid ? (
                  <div className="w-12 h-12 rounded-full bg-[#eaf4ef] text-[#287a58] flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#fbeeed] text-[#b63b48] flex items-center justify-center">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                )}
                <div>
                  <h3 className="font-display font-bold text-lg text-[#24212b]">
                    {certificate.is_valid
                      ? 'SERTIFIKAT SAH'
                      : 'SERTIFIKAT TIDAK BERLAKU'}
                  </h3>
                  <p className="text-xs text-[#595562]">
                    Nomor: <span className="font-mono font-bold text-[#24212b]">{certificate.certificate_no}</span>
                  </p>
                </div>
              </div>

              <Badge variant={certificate.is_valid ? 'success' : 'danger'}>
                {certificate.is_valid ? 'VALID' : 'DICABUT'}
              </Badge>
            </div>

            {/* Recipient Details */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#faf9fc] rounded border border-[#e6e1eb]">
                <div className="flex items-start gap-2.5">
                  <User className="w-4 h-4 text-[#583682] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] text-[#595562] uppercase font-bold">Penerima Sertifikat</div>
                    <div className="font-bold text-sm text-[#24212b]">{certificate.recipient.name}</div>
                    <div className="text-[#595562]">Identitas: {certificate.recipient.identifier}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Building className="w-4 h-4 text-[#583682] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] text-[#595562] uppercase font-bold">Instansi / Asal</div>
                    <div className="font-bold text-[#24212b]">{certificate.recipient.institution || 'Umum'}</div>
                  </div>
                </div>
              </div>

              {/* Exam & Score Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#faf9fc] rounded border border-[#e6e1eb]">
                <div className="flex items-start gap-2.5">
                  <Award className="w-4 h-4 text-[#583682] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] text-[#595562] uppercase font-bold">Ujian Kompetensi</div>
                    <div className="font-bold text-[#24212b]">{certificate.exam.title}</div>
                    <div className="text-[#287a58] font-bold">Skor Kelulusan: {certificate.exam.score} / 100</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-[#583682] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] text-[#595562] uppercase font-bold">Tanggal Penerbitan</div>
                    <div className="font-bold text-[#24212b]">
                      {formatWIBDate(certificate.issued_at, { weekday: undefined })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Revocation notice if any */}
              {!certificate.is_valid && (
                <div className="p-4 bg-[#fbeeed] border border-[#f4c6cb] rounded text-[#b63b48]">
                  <div className="font-bold mb-1">Alasan Pencabutan:</div>
                  <div>{certificate.revoked_reason || 'Dicabut oleh administrator atas evaluasi penilaian ulang.'}</div>
                  {certificate.revoked_at && (
                    <div className="text-[11px] mt-1 text-[#922b37]">
                      Waktu Pencabutan: {formatWIBDateTime(certificate.revoked_at)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Verification Footer Stamp */}
            <div className="mt-6 pt-4 border-t border-[#e6e1eb] flex items-center justify-between text-[11px] text-[#595562]">
              <div>Kode Verifikasi: <span className="font-mono font-bold text-[#24212b]">{certificate.verification_code}</span></div>
              <div className="text-[#583682] font-semibold">Tervalidasi oleh Fakultas Ilmu Administrasi</div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
