import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sessionService } from '../../services';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import { formatWIBDate, formatWIBTimeRange } from '../../utils/date';
import {
  Calendar,
  Clock,
  BookOpen,
  Check,
  Shield,
  HelpCircle,
  LogIn,
  ArrowRight,
  CalendarClock,
  Search,
} from 'lucide-react';

export const ExplorePage: React.FC = () => {
  const [publicSessions, setPublicSessions] = useState<any[]>([]);
  const [mySessions, setMySessions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, user, profile } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Ambil seluruh jadwal ujian aktif & terjadwal yang diatur admin
        const publicList = await sessionService.getPublicSessions().catch(() => []);
        if (!isMounted) return;
        setPublicSessions(publicList || []);

        // Jika user sudah login, ambil juga sesi terdaftarnya
        if (isAuthenticated) {
          const myList = await sessionService.getMySessions().catch(() => []);
          if (!isMounted) return;
          setMySessions(myList || []);
          if (myList && myList.length > 0) {
            setActiveTab('mine');
          } else {
            setActiveTab('all');
          }
        } else {
          setActiveTab('all');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Gagal memuat jadwal ujian.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // Sesi yang ditampilkan berdasarkan tab aktif dan pencarian
  const baseSessions = activeTab === 'mine' && isAuthenticated ? mySessions : publicSessions;
  const displayedSessions = baseSessions.filter((sess) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = (sess.name || sess.session_name || sess.exam_title || '').toLowerCase();
    const code = (sess.code || sess.session_code || '').toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  // Sesi terdekat (dari sesi basis tanpa filter pencarian)
  const nearestSession =
    baseSessions.find((s) => s.status === 'active' || s.session_status === 'active') ||
    baseSessions[0] ||
    null;

  const handleActionClick = (sess: any) => {
    const sessionId = sess.id || sess.session_id;

    // Jika belum login, bawa ke form login 1 pintu dengan target redirect
    if (!isAuthenticated) {
      const redirectTarget = encodeURIComponent(`/instructions?sessionId=${sessionId}`);
      navigate(`/login?redirect=${redirectTarget}`);
      return;
    }

    // Jika sudah login dan sesi selesai dengan hasil
    if (sess.session_status === 'completed' && sess.result_id) {
      navigate(`/results/latest?resultId=${sess.result_id}`);
      return;
    }

    // Jika sedang dalam progres
    if (sess.attempt_status === 'in_progress' && sess.attempt_id) {
      navigate(`/exam?attemptId=${sess.attempt_id}`);
      return;
    }

    // Masuk ke halaman petunjuk ujian
    navigate(`/instructions?sessionId=${sessionId}`);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-10 w-full space-y-10">
      {/* 1. Header with Academic Identity / Public Banner */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">
            {isAuthenticated ? 'JADWAL ASESMEN PESERTA' : 'JADWAL UJIAN RESMI'}
          </div>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-[#24212b]">
            Jadwal Sesi Ujian Kompetensi
          </h1>
          <p className="text-xs text-[#595562] mt-1 max-w-xl">
            {isAuthenticated
              ? 'Daftar sesi ujian CAT aktif dan terjadwal di Fakultas Ilmu Administrasi Universitas Madura.'
              : 'Seluruh sesi ujian Computer Assisted Test (CAT) resmi yang diselenggarakan oleh fakultas.'}
          </p>
        </div>

        {/* Identity Pill Card */}
        {isAuthenticated ? (
          <div className="bg-white border border-[#e6e1eb] rounded-[8px] p-4 flex flex-wrap items-center gap-6 shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-[#595562] uppercase tracking-wider">
                {user?.role === 'umum' || profile?.identifier?.startsWith('UMUM') ? 'NO. PESERTA' : 'NIM / ID'}
              </div>
              <div className="text-xs font-bold text-[#24212b]">{profile?.identifier || user?.email}</div>
            </div>
            <div className="border-l border-[#e6e1eb] pl-6">
              <div className="text-[10px] font-bold text-[#595562] uppercase tracking-wider">INSTANSI</div>
              <div className="text-xs font-bold text-[#24212b]">{profile?.institution || 'FIA Universitas Madura'}</div>
            </div>
            <div className="border-l border-[#e6e1eb] pl-6">
              <div className="text-[10px] font-bold text-[#595562] uppercase tracking-wider">STATUS</div>
              <div className="text-xs font-bold text-[#583682]">Aktif</div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#e6e1eb] rounded-[8px] p-4 flex items-center gap-4 shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-[#595562] uppercase tracking-wider">INSTITUSI PENYELENGGARA</div>
              <div className="text-xs font-bold text-[#24212b]">FIA Universitas Madura</div>
            </div>
            <div className="border-l border-[#e6e1eb] pl-4">
              <Button
                variant="primary"
                onClick={() => navigate('/login?redirect=/explore')}
                leftIcon={<LogIn className="w-3.5 h-3.5" />}
                className="text-xs h-8 px-4"
              >
                Masuk Akun
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && <ErrorAlert message={error} />}

      {/* 2. Upgraded Executive Featured Nearest Session Hero Banner */}
      {nearestSession && (
        <section className="relative overflow-hidden rounded-[10px] bg-gradient-to-br from-[#1b1126] via-[#2f174a] to-[#583682] text-white p-6 md:p-8 shadow-lg border border-[#4d2876]">
          {/* Subtle concentric circles watermark */}
          <div className="absolute -right-12 -bottom-24 w-80 h-80 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute right-12 -bottom-8 w-44 h-44 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute -left-12 -top-12 w-40 h-40 rounded-full border border-white/5 pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 text-[#e5d4f7] border border-white/15 backdrop-blur-xs">
                    <CalendarClock className="w-3.5 h-3.5 text-[#e5d4f7]" />
                    SESI UJIAN TERDEKAT
                  </span>
                  <Badge
                    variant={
                      (nearestSession.status || nearestSession.session_status) === 'active'
                        ? 'success'
                        : (nearestSession.status || nearestSession.session_status) === 'completed'
                        ? 'neutral'
                        : 'purple'
                    }
                  >
                    {(nearestSession.status || nearestSession.session_status) === 'active'
                      ? 'Sedang Berlangsung'
                      : (nearestSession.status || nearestSession.session_status) === 'completed'
                      ? 'Selesai'
                      : 'Akan Datang'}
                  </Badge>
                </div>

                <h2 className="font-display font-bold text-2xl md:text-3xl text-white tracking-tight pt-1">
                  {nearestSession.name || nearestSession.exam_title || nearestSession.session_name}
                </h2>

                <p className="text-xs text-[#cfc2de] flex flex-wrap items-center gap-2 pt-0.5">
                  <span>Kode Sesi:</span>
                  <span className="font-mono font-bold bg-white/15 text-white px-2 py-0.5 rounded text-xs">
                    {nearestSession.code || nearestSession.session_code}
                  </span>
                  <span>·</span>
                  <span>FIA Universitas Madura</span>
                </p>
              </div>

              <div className="shrink-0 flex items-center lg:self-center">
                <button
                  type="button"
                  onClick={() => handleActionClick(nearestSession)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-[#43206c] hover:bg-[#faf7fd] hover:shadow-lg active:scale-[0.98] transition font-bold text-xs md:text-sm px-6 py-3 rounded-[6px] cursor-pointer shadow-md"
                >
                  <span>
                    {nearestSession.session_status === 'completed'
                      ? 'Lihat Hasil Ujian'
                      : nearestSession.attempt_status === 'in_progress'
                      ? 'Lanjutkan Ujian'
                      : 'Ikuti Ujian Sekarang'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Structured Specifications Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/15">
              <div className="bg-white/10 border border-white/15 rounded-[8px] p-3.5 backdrop-blur-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#d1bfeb] flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  JADWAL PELAKSANAAN
                </div>
                <div className="text-xs font-bold text-white">
                  {formatWIBDate(nearestSession.starts_at)}
                </div>
                <div className="text-[11px] text-[#e0d3f2]">
                  {formatWIBTimeRange(nearestSession.starts_at, nearestSession.ends_at)}
                </div>
              </div>

              <div className="bg-white/10 border border-white/15 rounded-[8px] p-3.5 backdrop-blur-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#d1bfeb] flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  DURASI PENGERJAAN
                </div>
                <div className="text-xs font-bold text-white">
                  {nearestSession.duration_minutes || 90} Menit
                </div>
                <div className="text-[11px] text-[#e0d3f2]">
                  Waktu berjalan otomatis
                </div>
              </div>

              <div className="bg-white/10 border border-white/15 rounded-[8px] p-3.5 backdrop-blur-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#d1bfeb] flex items-center gap-1.5 mb-1">
                  <Shield className="w-3.5 h-3.5" />
                  AMBANG BATAS KELULUSAN
                </div>
                <div className="text-xs font-bold text-white">
                  {Math.round(Number(nearestSession.passing_score) || 70)} / 100
                </div>
                <div className="text-[11px] text-[#e0d3f2]">
                  Standar kelulusan kompetensi
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. Tab Selector (Jika user sudah login), Search, & Sesi Cards */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e6e1eb]">
          <div>
            <div className="eyebrow text-xs">AGENDA UJIAN</div>
            <h2 className="font-display font-bold text-lg text-[#24212b]">
              {activeTab === 'mine' ? 'Sesi Ujian Terdaftar Anda' : 'Daftar Seluruh Sesi Ujian'}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Cari ujian"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-gray-400" />}
                className="h-9 text-xs"
                spellCheck={false}
                autoComplete="off"
                aria-label="Cari ujian atau kode sesi"
              />
            </div>

            {isAuthenticated && (
              <div className="flex items-center gap-1.5 bg-[#eae5f2] p-1 rounded-md text-xs font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('mine')}
                  className={`px-3 py-1.5 rounded transition ${
                    activeTab === 'mine'
                      ? 'bg-white text-[#583682] shadow-xs'
                      : 'text-[#595562] hover:text-[#24212b]'
                  }`}
                >
                  Ujian Saya ({mySessions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded transition ${
                    activeTab === 'all'
                      ? 'bg-white text-[#583682] shadow-xs'
                      : 'text-[#595562] hover:text-[#24212b]'
                  }`}
                >
                  Semua Jadwal ({publicSessions.length})
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : displayedSessions.length === 0 ? (
          <div className="bg-white border border-[#e6e1eb] rounded-[8px] p-8 text-center space-y-3 shadow-sm">
            <EmptyState
              title={
                search.trim()
                  ? 'Sesi Ujian Tidak Ditemukan'
                  : activeTab === 'mine'
                  ? 'Belum Ada Sesi Terdaftar'
                  : 'Belum Ada Jadwal Sesi'
              }
              description={
                search.trim()
                  ? `Tidak ada sesi ujian yang cocok dengan kata kunci "${search}".`
                  : activeTab === 'mine'
                  ? 'Akun Anda belum didaftarkan ke sesi ujian manapun. Anda dapat melihat jadwal umum atau menghubungi panitia.'
                  : 'Saat ini belum ada sesi ujian aktif yang dibuka untuk publik.'
              }
              icon={<Calendar className="w-8 h-8 text-[#583682]" />}
            />
            {search.trim() && (
              <Button
                variant="secondary"
                onClick={() => setSearch('')}
                className="mt-2 text-xs h-8 px-3"
              >
                Reset Pencarian
              </Button>
            )}
          </div>
        ) : (
          <div className="course-card-grid">
            {displayedSessions.map((sess, idx) => {
              const status = sess.status || sess.session_status;
              const isOngoing = status === 'active';
              const isCompleted = status === 'completed';

              return (
                <article key={sess.id || sess.session_id} className="course-exam-card">
                  <div className="course-exam-card__visual">
                    <span>{String(idx + 1).padStart(2, '0')}</span>
                    <BookOpen className="w-7 h-7 text-white" />
                    <small>SESI UJIAN</small>
                  </div>

                  <div className="course-exam-card__body">
                    <div className="mb-2">
                      <Badge variant={isOngoing ? 'success' : isCompleted ? 'neutral' : 'purple'}>
                        {isOngoing ? 'Sedang Berlangsung' : isCompleted ? 'Selesai' : 'Akan Datang'}
                      </Badge>
                    </div>
                    <h3>{sess.name || sess.exam_title || sess.session_name}</h3>
                    <p>
                      Kode: {sess.code || sess.session_code} · FIA Universitas Madura
                    </p>

                    <div className="course-exam-card__facts">
                      <span>
                        <Clock className="w-3.5 h-3.5 text-[#583682]" />
                        <b>{sess.duration_minutes || 90} menit</b>
                      </span>
                    </div>

                    <div className="course-exam-card__schedule">
                      <Calendar className="w-4 h-4 text-[#583682]" />
                      <span>
                        <small>JADWAL (WIB)</small>
                        <b>{formatWIBDate(sess.starts_at)}</b>
                        <em>{formatWIBTimeRange(sess.starts_at, sess.ends_at)}</em>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="course-exam-card__action cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#583682]"
                    onClick={() => handleActionClick(sess)}
                  >
                    <span>
                      {isCompleted
                        ? 'Lihat Hasil'
                        : sess.attempt_status === 'in_progress'
                        ? 'Lanjutkan Ujian'
                        : 'Ikuti Ujian'}
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Exam Preparation Checklist */}
      <section className="bg-white border border-[#e6e1eb] rounded-[8px] p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-8">
        <div className="md:max-w-xs space-y-3">
          <div className="eyebrow text-xs">PANDUAN PESERTA</div>
          <h2 className="font-display font-bold text-xl text-[#24212b]">
            Persiapan Asesmen
          </h2>
          <p className="text-xs text-[#595562] leading-relaxed">
            Periksa kelengkapan akun dan perangkat Anda sebelum sesi ujian berlangsung.
          </p>
          <Button
            variant="secondary"
            onClick={() => setShowRules(true)}
            leftIcon={<HelpCircle className="w-4 h-4" />}
            className="text-xs h-9 px-4 mt-2"
          >
            Tata Tertib Ujian
          </Button>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 text-xs text-[#24212b]">
          {[
            'Akun terdaftar dan dapat masuk ke sistem.',
            'Perangkat ujian (laptop/PC) dalam kondisi normal.',
            'Koneksi internet stabil selama asesmen.',
            'Masuk 15 menit sebelum waktu sesi dimulai.',
            'Pastikan daya baterai terisi penuh.',
            'Pahami tata tertib dan panduan pelaksanaan ujian.',
          ].map((item, index) => (
            <li
              key={index}
              className="flex items-center gap-2.5 p-3 rounded bg-[#faf9fc] border border-[#e6e1eb]"
            >
              <Check className="w-4 h-4 text-[#287a58] shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Rules Modal */}
      <Modal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="Tata Tertib Ujian CAT"
        description="Ketentuan resmi asesmen digital Fakultas Ilmu Administrasi."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-[#24212b]">
          <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
            <li>Peserta wajib masuk menggunakan akun terdaftar (NIM atau Email resmi).</li>
            <li>Ujian dilaksanakan secara mandiri, objektif, dan jujur sesuai durasi waktu.</li>
            <li>Jawaban tersimpan otomatis saat batas waktu pengerjaan berakhir.</li>
            <li>Apabila terjadi kendala teknis, segera hubungi pengawas atau admin lab.</li>
          </ol>
          <div className="pt-4 border-t border-[#e6e1eb] flex justify-end">
            <Button variant="primary" onClick={() => setShowRules(false)} className="text-xs h-9 px-5">
              Saya Mengerti
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
