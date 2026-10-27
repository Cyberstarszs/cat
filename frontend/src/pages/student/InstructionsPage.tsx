import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { sessionService, attemptService } from '../../services';
import { ExamSession } from '../../types';
import { formatWIBScheduleRange } from '../../utils/date';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorAlert } from '../../components/ui/EmptyState';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  FileText,
  Check,
} from 'lucide-react';

export const InstructionsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const examId = searchParams.get('examId');
  const navigate = useNavigate();

  const [session, setSession] = useState<ExamSession | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        try {
          const mySessions = await sessionService.getMySessions();
          let matched = null;
          if (examId) {
            matched = mySessions.find((s: any) => s.exam_id === examId);
          }
          if (!matched && mySessions.length > 0) {
            matched = mySessions[0];
          }
          if (matched) {
            const detail = await sessionService.getSessionById(matched.id || matched.session_id);
            setSession(detail);
          } else {
            setError('Anda belum terdaftar dalam sesi ujian aktif untuk paket ujian ini.');
          }
        } catch (err: any) {
          setError(err.message || 'Gagal memuat detail sesi.');
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await sessionService.getSessionById(sessionId);
        setSession(data);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat detail sesi ujian.');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, examId]);

  const handleStartExam = async () => {
    if (!session || !agreed || starting) return;

    if (session.has_access_code && !accessCode.trim()) {
      setError('Kode akses (PIN) sesi ujian wajib diisi dari pengawas ruangan.');
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const res = await attemptService.startAttempt(session.id, accessCode.trim());
      // Navigate to exam room with attemptId directly
      navigate(`/exam?attemptId=${res.attempt_id}`);
    } catch (err: any) {
      setError(err.message || 'Gagal memulai ujian. Pastikan sesi sudah dibuka oleh pengawas.');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-12 w-full space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full rounded-[8px]" />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-12 w-full">
        <ErrorAlert message={error} />
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

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12 w-full space-y-8">
      {/* Back button */}
      <div>
        <Link to="/dashboard" className="text-xs font-semibold text-[#583682] hover:underline inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Dashboard
        </Link>
      </div>

      <div className="text-center space-y-2">
        <div className="eyebrow">PETUNJUK PENGERJAAN</div>
        <h1 className="font-display font-bold text-2xl md:text-3xl text-[#24212b]">
          {session?.exam_title || session?.name || 'Uji Kompetensi'}
        </h1>
        <p className="text-xs text-[#595562]">
          Kode Sesi: <span className="font-mono font-bold text-[#583682]">{session?.code}</span> | Durasi:{' '}
          <span className="font-bold">{session?.duration_minutes || 90} Menit</span>
          {session?.starts_at && (
            <>
              {' '}| Jadwal: <span className="font-bold text-[#24212b]">{formatWIBScheduleRange(session.starts_at, session.ends_at)}</span>
            </>
          )}
        </p>
      </div>

      {error && <ErrorAlert message={error} />}

      <Card hasShadow className="space-y-6">
        <div>
          <h3 className="font-display font-bold text-base text-[#24212b] mb-3 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#583682]" />
            Ketentuan & Tata Tertib Ujian
          </h3>
          <ul className="space-y-3 text-xs text-[#595562] leading-relaxed">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#287a58] shrink-0 mt-0.5" />
              <span>
                <strong>Waktu Ujian:</strong> Waktu berjalan otomatis sejak tombol &quot;Mulai Ujian&quot; ditekan dan tidak dapat dijeda.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#287a58] shrink-0 mt-0.5" />
              <span>
                <strong>Simpan Otomatis:</strong> Jawaban tersimpan otomatis ke server setiap kali Anda memilih opsi jawaban.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#a96817] shrink-0 mt-0.5" />
              <span>
                <strong>Integritas Ujian:</strong> Berpindah tab peramban atau membuka jendela lain terekam oleh sistem pengawas.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#287a58] shrink-0 mt-0.5" />
              <span>
                <strong>Indikator Warna Soal:</strong> Warna ungu menandakan soal sudah dijawab, warna putih menandakan soal belum dijawab/dilewati, dan kotak bergaris tepi aksen menandakan nomor soal yang sedang dibuka.
              </span>
            </li>
          </ul>
        </div>


        {/* PIN Akses Sesi jika diatur oleh pengawas/admin */}
        {session?.has_access_code && (
          <div className="p-4 bg-[#fbf9fe] border-2 border-[#583682]/25 rounded-[8px] space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-[#24212b]">
              <KeyRound className="w-4 h-4 text-[#583682]" />
              <span>Kode Akses (PIN Sesi) <span className="text-red-500">*</span></span>
            </label>
            <p className="text-[11px] text-[#595562]">
              Masukkan PIN sesi yang diberikan oleh pengawas ruangan.
            </p>
            <input
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              placeholder="PIN sesi"
              className="w-full sm:w-72 px-3.5 py-2 rounded bg-white border border-[#e6e1eb] font-mono font-bold tracking-widest text-[#583682] uppercase text-sm focus:outline-none focus:ring-2 focus:ring-[#583682]"
            />
          </div>
        )}
        {/* Agreement Checkbox */}
        <div className="pt-4 border-t border-[#e6e1eb]">
          <label
            htmlFor="agreed-rules"
            className="inline-flex items-center gap-2.5 cursor-pointer select-none py-1 group"
          >
            <div className="relative flex items-center justify-center shrink-0">
              <input
                id="agreed-rules"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className={`w-4 h-4 rounded-[4px] border transition-all flex items-center justify-center ${
                  agreed
                    ? 'bg-[#583682] border-[#583682] shadow-sm'
                    : 'bg-white border-[#cfc6d7] group-hover:border-[#583682]'
                } peer-focus-visible:ring-2 peer-focus-visible:ring-[#583682]/30`}
              >
                <Check
                  className={`w-3 h-3 text-white stroke-[2.75] transition-all duration-150 ${
                    agreed ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                  }`}
                />
              </div>
            </div>
            <span className="text-xs text-[#24212b] font-medium group-hover:text-[#583682] transition-colors leading-relaxed">
              Saya telah membaca dan menyetujui seluruh tata tertib pelaksanaan ujian ini.
            </span>
          </label>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e6e1eb]">
          <Link to="/dashboard">
            <Button variant="ghost" className="h-9 px-4 text-xs font-semibold">
              Batal
            </Button>
          </Link>

          <Button
            variant="primary"
            disabled={!agreed || starting}
            isLoading={starting}
            onClick={handleStartExam}
            className="h-9 px-6 text-xs font-semibold"
          >
            Mulai Ujian
          </Button>
        </div>
      </Card>
    </div>
  );
};
