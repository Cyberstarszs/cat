import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStudentPhoto } from '../../services/unira';
import { sessionService, resultService, notificationService, examService } from '../../services';
import { ExamResult, NotificationItem, Exam } from '../../types';
import { formatWIBDate, formatWIBTimeRange, formatWIBDateShort } from '../../utils/date';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import {
  Calendar,
  Clock,
  Shield,
  CheckCircle2,
  BookOpen,
  User,
  Check,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { profile, user } = useAuth();
  const { photoUrl } = useStudentPhoto(profile?.identifier, user?.role, profile?.institution);
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<any[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsData, resultsData, examsData] = await Promise.all([
        sessionService.getMySessions().catch(() => []),
        resultService.getMyResults().catch(() => []),
        examService.getExams().catch(() => []),
      ]);
      setSessions(sessionsData);
      setResults(resultsData);
      setExams(examsData);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const activeSession = sessions.find((s) => s.status === 'active' || s.status === 'scheduled') || sessions[0];
  const latestResult = results[0] || null;

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-10 w-full space-y-10">
      {/* 1. Portal Topbar */}
      <div className="portal-topbar">
        <div>
          <span className="status-active text-xs">
            <i /> TERHUBUNG
          </span>
          <b>PORTAL PESERTA</b>
        </div>
        <div>
          <small>SESI AKTIF</small>
          <strong>{activeSession?.session_code || activeSession?.code || 'SESI-01'}</strong>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchDashboardData} />}

      {/* 2. Participant ID Card */}
      <section className="participant-card">
        <div className="participant-photo">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={profile?.full_name || 'Foto Mahasiswa'}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
              <User className="w-16 h-16 stroke-1" />
            </div>
          )}
          <span>FOTO</span>
        </div>

        <div className="participant-main">
          <div className="eyebrow mb-1">IDENTITAS PESERTA</div>
          <h1>{profile?.full_name || 'Peserta Ujian'}</h1>

          <div className="participant-data">
            <span>
              <small>{user?.role === 'umum' || profile?.identifier?.startsWith('UMUM') ? 'NO. PESERTA' : 'NIM'}</small>
              <b>{profile?.identifier || '-'}</b>
            </span>
            <span>
              <small>PROGRAM STUDI / INSTANSI</small>
              <b>{profile?.institution || (user?.role === 'umum' ? 'Umum' : 'Administrasi Publik')}</b>
            </span>
            <span>
              <small>FAKULTAS / ASAL</small>
              <b>{user?.role === 'umum' ? (profile?.institution || 'Peserta Umum') : 'Ilmu Administrasi'}</b>
            </span>
            <span>
              <small>UNIVERSITAS / LEMBAGA</small>
              <b>{user?.role === 'umum' ? 'CAT Mandiri' : 'Universitas Madura'}</b>
            </span>
          </div>

          <button
            onClick={() => navigate('/profile')}
            className="text-xs font-bold text-[#583682] hover:underline mt-6 cursor-pointer"
          >
            Lihat Profil
          </button>
        </div>

        <div className="participant-status">
          <span className="status-active">
            <i /> PESERTA AKTIF
          </span>
          <small>NOMOR PESERTA</small>
          <strong>{profile?.identifier ? `CAT-2026-${profile.identifier}` : 'CAT-2026-001'}</strong>
          <small>PERAN</small>
          <b>Mahasiswa</b>
          <small>STATUS</small>
          <b className="flex items-center gap-1 text-[#287a58]">
            <Check className="w-3.5 h-3.5" /> Terverifikasi
          </b>
        </div>
      </section>

      {/* 3. Available Exam Sessions Section Title */}
      <div className="flex items-end justify-between pb-2 border-b border-[#e6e1eb] mt-10">
        <div>
          <div className="eyebrow text-xs">JADWAL UJIAN</div>
          <h2 className="font-display font-bold text-2xl text-[#24212b]">
            Sesi Ujian Tersedia
          </h2>
        </div>
        <span className="text-xs font-bold bg-[#eae2f5] text-[#583682] px-3 py-1 rounded">
          {sessions.length || 1} UJIAN
        </span>
      </div>

      {/* 4. Course Exam Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="Belum Ada Sesi Ujian"
          description="Saat ini belum ada sesi ujian aktif yang terdaftar untuk Anda."
          icon={<Calendar className="w-8 h-8 text-[#583682]" />}
        />
      ) : (
        <div className="course-card-grid">
          {sessions.map((sess, index) => {
            const isOngoing = sess.status === 'active';
            const isCompleted = sess.status === 'completed';

            return (
              <article key={sess.id} className="course-exam-card">
                <div className="course-exam-card__visual">
                  <span>0{index + 1}</span>
                  <BookOpen className="w-7 h-7 text-white" />
                  <small>UJI KOMPETENSI</small>
                </div>

                <div className="course-exam-card__body">
                  <div className="mb-2">
                    <Badge variant={isOngoing ? 'success' : isCompleted ? 'neutral' : 'purple'}>
                      {isOngoing ? 'Sedang Berlangsung' : isCompleted ? 'Selesai' : 'Akan Datang'}
                    </Badge>
                  </div>
                  <h3>{sess.exam_title || sess.name || 'Uji Kompetensi Administrasi'}</h3>
                  <p>Fakultas Ilmu Administrasi · Universitas Madura</p>

                  <div className="course-exam-card__facts">
                    <span>
                      <Clock className="w-3.5 h-3.5 text-[#583682]" />
                      <b>{sess.duration_minutes || 90} menit</b>
                    </span>
                    <span>
                      <Shield className="w-3.5 h-3.5 text-[#583682]" />
                      <b>Batas: 75</b>
                    </span>
                  </div>

                  <div className="course-exam-card__schedule">
                    <Calendar className="w-4 h-4 text-[#583682]" />
                    <span>
                      <small>JADWAL (WIB)</small>
                      <b>
                        {sess.starts_at
                          ? formatWIBDate(sess.starts_at)
                          : 'Senin, 12 Oktober 2026'}
                      </b>
                      <em>
                        {sess.starts_at
                          ? formatWIBTimeRange(sess.starts_at, sess.ends_at)
                          : '08.00–09.30 WIB'}
                      </em>
                    </span>
                  </div>
                </div>

                <button
                  className="course-exam-card__action"
                  onClick={() => {
                    if (isCompleted) {
                      navigate('/history');
                    } else {
                      navigate(`/assessment-lg/instructions?sessionId=${sess.id || sess.session_id}`);
                    }
                  }}
                >
                  <span>
                    {isCompleted
                      ? 'Lihat Hasil'
                      : isOngoing
                      ? 'Lanjutkan Ujian'
                      : 'Lihat Detail'}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* 5. Exam Status & Assessment Record (Rekam Asesmen) */}
      <section className="bg-white border border-[#e6e1eb] rounded-[8px] p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#e6e1eb]">
          <div>
            <div className="eyebrow text-xs">RIWAYAT UJIAN</div>
            <h2 className="font-display font-bold text-xl text-[#24212b]">
              Hasil Ujian Terakhir
            </h2>
          </div>
          <Link to="/history" className="text-xs font-bold text-[#583682] hover:underline">
            Semua Riwayat
          </Link>
        </div>

        {results.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#595562]">
            Belum ada riwayat ujian yang selesai.
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((res, idx) => (
              <div
                key={res.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded bg-[#faf9fc] border border-[#e6e1eb]"
              >
                <div className="flex items-center gap-4">
                  <span className="font-display font-bold text-base text-gray-400">
                    0{idx + 1}
                  </span>
                  <div>
                    <h4 className="font-display font-bold text-sm text-[#24212b]">
                      {res.exam_title || 'Uji Kompetensi Administrasi'}
                    </h4>
                    <p className="text-[11px] text-[#595562]">
                      Selesai: {formatWIBDate(res.submitted_at || res.created_at, { weekday: undefined })} · Skor: <strong className="text-[#24212b]">{res.score}/100</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`status-pill ${
                      res.passed ? 'passed' : 'failed'
                    }`}
                  >
                    {res.passed ? 'LULUS' : 'TIDAK LULUS'}
                  </span>

                  <button
                    onClick={() => navigate(`/results/latest?resultId=${res.id}`)}
                    className="text-xs font-bold text-[#583682] hover:underline cursor-pointer"
                  >
                    Lihat Hasil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
