import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { examService } from '../../services';
import { Exam } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import {
  Calendar,
  Clock,
  BookOpen,
  FileText,
  Check,
  AlertTriangle,
  Shield,
  HelpCircle,
} from 'lucide-react';

export const ExplorePage: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [startModalExam, setStartModalExam] = useState<Exam | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const navigate = useNavigate();

  const fetchExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await examService.getExams();
      setExams(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat jadwal ujian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const nearestExam = exams[0] || null;

  const handleStartExamClick = (exam: Exam) => {
    setStartModalExam(exam);
    setRulesAccepted(false);
  };

  const handleConfirmStart = () => {
    if (!startModalExam || !rulesAccepted) return;
    navigate(`/assessment-lg/instructions?examId=${startModalExam.id}`);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-10 w-full space-y-10">
      {/* 1. Header with Academic Identity */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">PORTAL PESERTA / UJI KOMPETENSI</div>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-[#24212b]">
            Jadwal Ujian
          </h1>
          <p className="text-xs text-[#595562] mt-1 max-w-xl">
            Lihat jadwal, detail, dan akses ujian kompetensi digital Anda di lingkungan Fakultas Ilmu Administrasi.
          </p>
        </div>

        {/* Academic Identity Pill Card */}
        <div className="bg-white border border-[#e6e1eb] rounded-[8px] p-4 flex flex-wrap items-center gap-6 shadow-sm">
          <div>
            <div className="text-[10px] font-bold text-[#595562] uppercase tracking-wider">PROGRAM STUDI</div>
            <div className="text-xs font-bold text-[#24212b]">Administrasi Publik</div>
          </div>
          <div className="border-l border-[#e6e1eb] pl-6">
            <div className="text-[10px] font-bold text-[#595562] uppercase tracking-wider">FAKULTAS</div>
            <div className="text-xs font-bold text-[#24212b]">Ilmu Administrasi</div>
          </div>
          <div className="border-l border-[#e6e1eb] pl-6">
            <div className="text-[10px] font-bold text-[#595562] uppercase tracking-wider">SUBSOAL AKTIF</div>
            <div className="text-xs font-bold text-[#583682]">Tes Wawasan Kebangsaan</div>
          </div>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchExams} />}

      {/* 2. Schedule Summary Metrics Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e6e1eb] rounded-[8px] p-5 flex items-center gap-4 shadow-sm">
          <BookOpen className="w-8 h-8 text-[#583682]" />
          <div>
            <div className="font-display font-bold text-2xl text-[#24212b]">{exams.length || 1}</div>
            <div className="text-xs text-[#595562] font-semibold">Ujian Utama</div>
          </div>
        </div>

        <div className="bg-white border border-[#e6e1eb] rounded-[8px] p-5 flex items-center gap-4 shadow-sm">
          <FileText className="w-8 h-8 text-[#583682]" />
          <div>
            <div className="font-display font-bold text-2xl text-[#24212b]">1</div>
            <div className="text-xs text-[#595562] font-semibold">Subsoal Aktif</div>
          </div>
        </div>

        <div className="bg-white border border-[#e6e1eb] rounded-[8px] p-5 flex items-center gap-4 shadow-sm">
          <Clock className="w-8 h-8 text-[#583682]" />
          <div>
            <div className="font-display font-bold text-2xl text-[#24212b]">
              {nearestExam?.duration_minutes || 90}
            </div>
            <div className="text-xs text-[#595562] font-semibold">Durasi Menit</div>
          </div>
        </div>

        <div className="bg-white border border-[#e6e1eb] rounded-[8px] p-5 flex items-center gap-4 shadow-sm">
          <Shield className="w-8 h-8 text-[#583682]" />
          <div>
            <div className="font-display font-bold text-2xl text-[#24212b]">
              {nearestExam?.passing_score || 75}
            </div>
            <div className="text-xs text-[#595562] font-semibold">Nilai Kelulusan</div>
          </div>
        </div>
      </section>

      {/* 3. Nearest Exam Highlight Banner */}
      {nearestExam && (
        <section className="bg-white border border-[#e6e1eb] border-l-4 border-l-[#583682] rounded-[8px] p-6 md:p-8 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <span className="font-display font-bold text-3xl text-gray-300">01</span>
            <div className="space-y-1">
              <div className="eyebrow text-xs">UJIAN TERDEKAT</div>
              <h2 className="font-display font-bold text-xl md:text-2xl text-[#24212b]">
                {nearestExam.title}
              </h2>
              <p className="text-xs text-[#595562]">
                Ujian Kompetensi Digital · Fakultas Ilmu Administrasi (FIA)
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[#595562]">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#583682]" />
                  <b>Senin, 12 Oktober 2026</b>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#583682]" />
                  <b>08.00–09.30 WIB</b>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-4 bg-[#faf9fc] p-3 rounded border border-[#e6e1eb] text-xs">
              <div>
                <div className="text-[10px] text-[#595562] font-bold uppercase">DURASI</div>
                <div className="font-bold text-[#24212b]">{nearestExam.duration_minutes} Menit</div>
              </div>
              <div className="border-l border-[#e6e1eb] pl-4">
                <div className="text-[10px] text-[#595562] font-bold uppercase">NILAI MINIMAL</div>
                <div className="font-bold text-[#24212b]">{nearestExam.passing_score} / 100</div>
              </div>
              <div className="border-l border-[#e6e1eb] pl-4">
                <Badge variant={nearestExam.status === 'active' ? 'success' : 'neutral'}>
                  {nearestExam.status === 'active' ? 'Sedang Berlangsung' : 'Akan Datang'}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link to={`/assessment-lg/detail?id=${nearestExam.id}`}>
                <Button variant="secondary" className="text-xs">
                  Lihat Detail
                </Button>
              </Link>
              <Button
                variant="primary"
                onClick={() => handleStartExamClick(nearestExam)}
                className="text-xs"
              >
                Mulai Ujian
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* 4. Course Exam Cards Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#e6e1eb]">
          <div>
            <div className="eyebrow text-xs">DAFTAR UJIAN</div>
            <h2 className="font-display font-bold text-lg text-[#24212b]">
              Ujian Kompetensi Aktif
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : exams.length === 0 ? (
          <EmptyState
            title="Belum Ada Ujian Aktif"
            description="Saat ini belum ada sesi ujian yang dijadwalkan."
          />
        ) : (
          <div className="course-card-grid">
            {exams.map((item, idx) => (
              <article key={item.id} className="course-exam-card">
                <div className="course-exam-card__visual">
                  <span>0{idx + 1}</span>
                  <BookOpen className="w-7 h-7 text-white" />
                  <small>UJI KOMPETENSI</small>
                </div>

                <div className="course-exam-card__body">
                  <div className="mb-2">
                    <Badge variant={item.status === 'active' ? 'success' : 'neutral'}>
                      {item.status === 'active' ? 'Sedang Berlangsung' : 'Akan Datang'}
                    </Badge>
                  </div>
                  <h3>{item.title}</h3>
                  <p>Fakultas Ilmu Administrasi · Universitas Madura</p>

                  <div className="course-exam-card__facts">
                    <span>
                      <Clock className="w-3.5 h-3.5 text-[#583682]" />
                      <b>{item.duration_minutes} menit</b>
                    </span>
                    <span>
                      <Shield className="w-3.5 h-3.5 text-[#583682]" />
                      <b>Batas: {item.passing_score}</b>
                    </span>
                  </div>

                  <div className="course-exam-card__schedule">
                    <Calendar className="w-4 h-4 text-[#583682]" />
                    <span>
                      <small>JADWAL</small>
                      <b>Senin, 12 Oktober 2026</b>
                      <em>08.00–09.30 WIB</em>
                    </span>
                  </div>
                </div>

                <button
                  className="course-exam-card__action"
                  onClick={() => handleStartExamClick(item)}
                >
                  <span>Mulai Ujian</span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 5. Exam Preparation Checklist */}
      <section className="bg-white border border-[#e6e1eb] rounded-[8px] p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-8">
        <div className="md:max-w-xs space-y-3">
          <div className="eyebrow text-xs">PETUNJUK PESERTA</div>
          <h2 className="font-display font-bold text-xl text-[#24212b]">
            Persiapan Ujian
          </h2>
          <p className="text-xs text-[#595562] leading-relaxed">
            Periksa kesiapan perangkat dan akun Anda sebelum sesi ujian dimulai.
          </p>
          <Button
            variant="secondary"
            onClick={() => setShowRules(true)}
            leftIcon={<HelpCircle className="w-4 h-4" />}
            className="text-xs mt-2"
          >
            Tata Tertib Ujian
          </Button>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 text-xs text-[#24212b]">
          {[
            'Akun terdaftar dan dapat masuk.',
            'Perangkat ujian berfungsi baik.',
            'Koneksi internet stabil.',
            'Masuk tepat waktu sebelum sesi dimulai.',
            'Baterai perangkat terisi penuh.',
            'Pahami tata tertib dan sanksi.',
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
        title="Tata Tertib Ujian"
        description="Ketentuan resmi peserta ujian CAT FIA."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-[#24212b]">
          <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
            <li>Peserta wajib masuk menggunakan akun pribadi yang terdaftar.</li>
            <li>Ujian dikerjakan secara mandiri dan jujur sesuai durasi waktu.</li>
            <li>Jawaban otomatis tersimpan saat waktu ujian habis.</li>
            <li>Kendala teknis segera laporkan ke panitia pengawas.</li>
          </ol>
          <div className="pt-4 border-t border-[#e6e1eb] flex justify-end">
            <Button variant="primary" onClick={() => setShowRules(false)}>
              Saya Mengerti
            </Button>
          </div>
        </div>
      </Modal>

      {/* Start Exam Confirmation Modal */}
      <Modal
        isOpen={!!startModalExam}
        onClose={() => setStartModalExam(null)}
        title="Mulai Ujian"
        description="Pastikan Anda siap sebelum memulai sesi ujian."
        maxWidth="md"
      >
        {startModalExam && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-2 p-3 bg-[#faf9fc] rounded border border-[#e6e1eb] text-xs">
              <div>
                <dt className="text-gray-500 font-semibold">Nama Ujian</dt>
                <dd className="font-bold text-[#24212b]">{startModalExam.title}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-semibold">Jenis</dt>
                <dd className="font-bold text-[#24212b]">Uji Kompetensi</dd>
              </div>
              <div className="mt-2">
                <dt className="text-gray-500 font-semibold">Durasi</dt>
                <dd className="font-bold text-[#24212b]">{startModalExam.duration_minutes} Menit</dd>
              </div>
              <div className="mt-2">
                <dt className="text-gray-500 font-semibold">Nilai Minimal</dt>
                <dd className="font-bold text-[#24212b]">{startModalExam.passing_score} / 100</dd>
              </div>
            </dl>

            <div className="p-3 bg-[#fff4df] border border-[#f6ddba] rounded flex items-start gap-2 text-xs text-[#a96817]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <b>Perhatian:</b> Waktu pengerjaan langsung berjalan setelah tombol ditekan dan tidak dapat dijeda.
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-[#24212b] cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(e) => setRulesAccepted(e.target.checked)}
                className="mt-0.5 accent-[#583682]"
              />
              <span>Saya siap dan menyetujui seluruh tata tertib ujian.</span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e6e1eb]">
              <Button variant="ghost" onClick={() => setStartModalExam(null)}>
                Batal
              </Button>
              <Button
                variant="primary"
                disabled={!rulesAccepted}
                onClick={handleConfirmStart}
              >
                Mulai Ujian
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
