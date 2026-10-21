import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { examService } from '../../services';
import { Exam } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorAlert } from '../../components/ui/EmptyState';
import { Clock, Award, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const DetailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const examId = searchParams.get('id');
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExam = async () => {
      if (!examId) {
        // If no examId provided, fetch first active exam
        try {
          const all = await examService.getExams();
          if (all.length > 0) {
            const detail = await examService.getExamById(all[0].id);
            setExam(detail);
          } else {
            setError('Belum ada ujian yang tersedia.');
          }
        } catch (err: any) {
          setError(err.message || 'Gagal memuat ujian.');
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const detail = await examService.getExamById(examId);
        setExam(detail);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat detail ujian.');
      } finally {
        setLoading(false);
      }
    };

    fetchExam();
  }, [examId]);

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-12 w-full space-y-6">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-48 w-full rounded-[8px]" />
        <Skeleton className="h-64 w-full rounded-[8px]" />
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-12 w-full">
        <ErrorAlert message={error || 'Ujian tidak ditemukan.'} />
        <div className="mt-4">
          <Link to="/explore">
            <Button variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Kembali ke Jadwal
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 w-full space-y-8">
      {/* Back button */}
      <div>
        <Link to="/explore" className="text-xs font-semibold text-[#583682] hover:underline inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Jadwal Ujian
        </Link>
      </div>

      {/* Hero Banner */}
      <div className="bg-white border border-[#e6e1eb] rounded-[8px] p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="purple">{exam.code}</Badge>
            <Badge variant={exam.status === 'active' ? 'success' : 'neutral'}>
              {exam.status === 'active' ? 'Status: Aktif' : 'Status: Draft'}
            </Badge>
          </div>
          <span className="text-xs text-[#595562]">
            Fakultas Ilmu Administrasi (FIA)
          </span>
        </div>

        <h1 className="font-display font-bold text-3xl md:text-4xl text-[#24212b] mb-4">
          {exam.title}
        </h1>

        <p className="text-xs md:text-sm text-[#595562] leading-relaxed max-w-3xl mb-8">
          {exam.description ||
            'Uji kompetensi terstandar untuk mengukur pemahaman, kapabilitas analitis, dan tata kelola administrasi.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-[#e6e1eb]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#eae2f5] text-[#583682] flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-[#595562] uppercase font-bold">Durasi Ujian</div>
              <div className="font-bold text-sm text-[#24212b]">{exam.duration_minutes} Menit</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#eaf4ef] text-[#287a58] flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-[#595562] uppercase font-bold">Ambang Batas</div>
              <div className="font-bold text-sm text-[#24212b]">{exam.passing_score} / 100</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f6f2fa] text-[#754ead] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-[#595562] uppercase font-bold">Tipe Ujian</div>
              <div className="font-bold text-sm text-[#24212b]">Asesmen Mandiri CAT</div>
            </div>
          </div>
        </div>
      </div>

      {/* Rules and Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h3 className="font-display font-bold text-lg text-[#24212b] mb-4 pb-3 border-b border-[#e6e1eb]">
              Komposisi Soal per Kategori
            </h3>

            {exam.rules && exam.rules.length > 0 ? (
              <div className="divide-y divide-[#e6e1eb]">
                {exam.rules.map((rule, idx) => (
                  <div key={rule.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#583682] bg-[#eae2f5] px-2 py-0.5 rounded">
                        0{idx + 1}
                      </span>
                      <span className="font-semibold text-[#24212b]">{rule.category_name || rule.category_id}</span>
                    </div>
                    <span className="font-bold text-[#583682]">{rule.question_count} Soal</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#595562]">
                Komposisi soal diatur sesuai ketentuan bank soal.
              </p>
            )}
          </Card>

          <Card>
            <h3 className="font-display font-bold text-lg text-[#24212b] mb-4 pb-3 border-b border-[#e6e1eb]">
              Tata Tertib Ujian
            </h3>
            <ul className="space-y-3 text-xs text-[#595562]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#287a58] shrink-0 mt-0.5" />
                <span>Ujian hanya dapat diakses pada waktu sesi yang ditentukan.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#287a58] shrink-0 mt-0.5" />
                <span>Waktu berjalan otomatis sejak ujian dimulai dan tidak dapat dijeda.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#287a58] shrink-0 mt-0.5" />
                <span>Perpindahan tab atau aktivitas tidak wajar akan terekam oleh sistem.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#287a58] shrink-0 mt-0.5" />
                <span>Nilai keluar otomatis setelah ujian selesai.</span>
              </li>
            </ul>
          </Card>
        </div>

        {/* CTA Sidecard */}
        <div className="space-y-6">
          <Card hasShadow className="bg-[#583682] text-white border-[#583682]">
            <h3 className="font-display font-bold text-lg text-white mb-2">
              Mulai Ujian
            </h3>
            <p className="text-xs text-[#eae2f5] mb-6 leading-relaxed">
              Masuk dengan akun terdaftar untuk memulai pengerjaan ujian ini.
            </p>

            {isAuthenticated ? (
              <Button
                variant="light"
                fullWidth
                onClick={() => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/dashboard')}
              >
                {user?.role === 'admin' ? 'Buka Portal Admin' : 'Buka Dashboard Ujian'}
              </Button>
            ) : (
              <Button
                variant="light"
                fullWidth
                onClick={() =>
                  navigate(`/login?redirect=${encodeURIComponent(`/detail?id=${exam.id}`)}`)
                }
              >
                Masuk Akun
              </Button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
