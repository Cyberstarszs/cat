import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { sessionService, attemptService } from '../../services';
import { ExamSession } from '../../types';
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
  FileText,
} from 'lucide-react';

export const InstructionsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const navigate = useNavigate();

  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        // Fallback: check my sessions
        try {
          const mySessions = await sessionService.getMySessions();
          if (mySessions.length > 0) {
            const first = mySessions[0];
            const detail = await sessionService.getSessionById(first.id || first.session_id);
            setSession(detail);
          } else {
            setError('Sesi ujian tidak ditentukan dan tidak ada sesi aktif ditemukan.');
          }
        } catch (err: any) {
          setError(err.message || 'Gagal memuat sesi.');
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
  }, [sessionId]);

  const handleStartExam = async () => {
    if (!session || !agreed) return;

    setStarting(true);
    setError(null);

    try {
      const res = await attemptService.startAttempt(session.id);
      // Navigate to exam room with attemptId
      navigate(`/assessment-lg/start?attemptId=${res.attempt_id}`);
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
        <div className="eyebrow">PETUNJUK PENGERJAAN & INTEGRITAS UJIAN</div>
        <h1 className="font-display font-bold text-2xl md:text-3xl text-[#24212b]">
          {session?.exam_title || session?.name || 'Uji Kompetensi FIA'}
        </h1>
        <p className="text-xs text-[#595562]">
          Kode Sesi: <span className="font-mono font-bold text-[#583682]">{session?.code}</span> | Durasi:{' '}
          <span className="font-bold">{session?.duration_minutes || 90} Menit</span>
        </p>
      </div>

      {error && <ErrorAlert message={error} />}

      <Card hasShadow className="space-y-6">
        <div>
          <h3 className="font-display font-bold text-base text-[#24212b] mb-3 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#583682]" />
            Ketentuan & Tata Tertib CAT
          </h3>
          <ul className="space-y-3 text-xs text-[#595562] leading-relaxed">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#287a58] shrink-0 mt-0.5" />
              <span>
                <strong>Timer Mandiri Terikat Server:</strong> Waktu ujian dihitung secara ketat oleh server sejak Anda mengklik tombol &quot;Mulai Mengerjakan Ujian&quot;. Timer tidak dapat dijeda atau dihentikan sementara.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#287a58] shrink-0 mt-0.5" />
              <span>
                <strong>Autosave Real-Time:</strong> Setiap kali Anda memilih opsi jawaban, sistem secara otomatis menyimpannya ke server. Jika koneksi terputus sejenak, jawaban terakhir Anda tetap tersimpan aman.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#a96817] shrink-0 mt-0.5" />
              <span>
                <strong>Integritas Layar & Anti-Kecurangan:</strong> Berpindah tab peramban, meminimalkan jendela, atau membuka aplikasi lain akan tercatat secara permanen di log audit sistem pengawas.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#287a58] shrink-0 mt-0.5" />
              <span>
                <strong>Opsi Ragu-ragu:</strong> Gunakan tombol bendera &quot;Ragu-ragu&quot; untuk menandai soal yang ingin Anda tinjau kembali sebelum menekan tombol selesaikan ujian.
              </span>
            </li>
          </ul>
        </div>

        {/* Agreement Checkbox */}
        <div className="pt-4 border-t border-[#e6e1eb]">
          <label className="flex items-start gap-3 p-3 bg-[#faf9fc] border border-[#e6e1eb] rounded cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 text-[#583682] rounded mt-0.5 cursor-pointer accent-[#583682]"
            />
            <span className="text-xs text-[#24212b] font-medium leading-relaxed">
              Saya telah membaca, memahami, dan menyetujui seluruh tata tertib pelaksanaan uji kompetensi ini secara sadar dan berintegritas.
            </span>
          </label>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <Link to="/dashboard" className="w-full sm:w-auto">
            <Button variant="ghost" fullWidth>
              Batal & Kembali
            </Button>
          </Link>

          <Button
            variant="primary"
            disabled={!agreed || starting}
            isLoading={starting}
            onClick={handleStartExam}
            className="w-full sm:w-auto min-w-[200px]"
          >
            Mulai Mengerjakan Ujian
          </Button>
        </div>
      </Card>
    </div>
  );
};
