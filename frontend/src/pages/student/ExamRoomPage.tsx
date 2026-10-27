import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { attemptService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useStudentPhoto } from '../../services/unira';
import { AttemptDetail, AttemptQuestionItem } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorAlert } from '../../components/ui/EmptyState';
import { alert } from '../../utils/alert';
import logoImg from '../../assets/cat-governance-logo.png';
import {
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  RotateCw,
  Shield,
  User,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Keyboard,
} from 'lucide-react';

export const ExamRoomPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { photoUrl } = useStudentPhoto(profile?.identifier, user?.role, profile?.institution);

  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [questions, setQuestions] = useState<AttemptQuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | null>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Client sequence for idempotent updates
  const clientSeqRef = useRef<number>(1);
  const submittingRef = useRef<boolean>(false);
  const hasExpiredRef = useRef<boolean>(false);
  const targetDeadlineRef = useRef<number | null>(null);

  // Prevent accidental tab closure or navigation during active exam
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submittingRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Load attempt data
  useEffect(() => {
    if (!attemptId) {
      navigate('/dashboard');
      return;
    }

    const loadAttempt = async () => {
      setLoading(true);
      try {
        const data = await attemptService.getAttempt(attemptId);

        // Validasi status attempt: jangan izinkan pengerjaan ulang jika sudah selesai/dibatalkan
        if (data.status === 'submitted' || data.status === 'timed_out') {
          const resId = (data as any).result_id || data.id;
          navigate(`/results/latest?resultId=${resId}`, { replace: true });
          return;
        }
        if (data.status === 'void') {
          await alert.info('Sesi Ujian Dibatalkan', 'Percobaan pengerjaan sesi ujian ini telah dibatalkan oleh panitia/pengawas.');
          navigate('/dashboard', { replace: true });
          return;
        }

        setAttempt(data);
        const questionsList = data.questions || [];
        setQuestions(questionsList);
        const remainingSec = Math.max(0, data.time_remaining_seconds ?? (data.duration_minutes ? data.duration_minutes * 60 : 0));
        setTimeRemaining(remainingSec);
        targetDeadlineRef.current = Date.now() + remainingSec * 1000;

        // Prepopulate answers
        const ansMap: Record<string, string | null> = {};
        questionsList.forEach((q) => {
          ansMap[q.id] = q.selected_option_id || null;
        });
        setSelectedAnswers(ansMap);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat sesi pengerjaan ujian.');
      } finally {
        setLoading(false);
      }
    };

    loadAttempt();
  }, [attemptId, navigate]);

  // Anti-cheat & Telemetry: blur & focus listeners
  useEffect(() => {
    if (!attemptId) return;

    const handleBlur = () => {
      attemptService.recordEvent(attemptId, 'blur').catch(() => {});
    };

    const handleFocus = () => {
      attemptService.recordEvent(attemptId, 'focus').catch(() => {});
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [attemptId]);

  // Submit attempt handler with synchronous double-submit protection
  const handleFinishExam = useCallback(async () => {
    if (!attemptId || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await attemptService.finishAttempt(attemptId);
      navigate(`/results/latest?resultId=${res.result_id}`);
    } catch (err: any) {
      submittingRef.current = false;
      setSubmitting(false);
      await alert.error(
        'Pengiriman Ujian',
        err.message || 'Terjadi kendala jaringan saat mengirimkan lembar ujian. Jawaban Anda tetap tersimpan di server. Silakan coba klik tombol kirim kembali.'
      );
    }
  }, [attemptId, navigate]);

  // Countdown Timer with zero-drift & background-tab compensation
  useEffect(() => {
    if (loading || !targetDeadlineRef.current) return;

    let intervalId: any = null;

    const updateTimer = () => {
      if (!targetDeadlineRef.current) return;
      const remaining = Math.max(0, Math.floor((targetDeadlineRef.current - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        if (intervalId) clearInterval(intervalId);
        handleFinishExam();
      }
    };

    updateTimer();
    intervalId = setInterval(updateTimer, 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loading, handleFinishExam]);

  // Format seconds into HH:MM:SS (strictly non-negative)
  const formatTime = (seconds: number) => {
    const safeSec = Math.max(0, Math.floor(seconds));
    const h = Math.floor(safeSec / 3600);
    const m = Math.floor((safeSec % 3600) / 60);
    const s = safeSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Answer selection & autosave
  const handleSelectOption = useCallback(async (optionId: string) => {
    if (!attemptId || questions.length === 0 || !questions[currentIndex]) return;
    const currentQ = questions[currentIndex];

    // Optimistic UI update
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionId,
    }));

    setSavingStatus('saving');
    const seq = ++clientSeqRef.current;

    try {
      await attemptService.autosaveAnswer(attemptId, {
        attempt_question_id: currentQ.id,
        selected_option_id: optionId,
        is_flagged: false,
        client_seq: seq,
      });
      if (clientSeqRef.current === seq) {
        setSavingStatus('saved');
      }
    } catch (err) {
      console.error('Autosave failed:', err);
      if (clientSeqRef.current === seq) {
        setSavingStatus('error');
      }
    }
  }, [attemptId, questions, currentIndex]);

  // Toggle Fullscreen mode for maximum exam focus
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard navigation & quick answer shortcuts for participant ergonomics
  useEffect(() => {
    if (loading || finishModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
      } else if (['a', 'b', 'c', 'd', 'e', 'A', 'B', 'C', 'D', 'E'].includes(e.key)) {
        const targetLabel = e.key.toUpperCase();
        const currentQ = questions[currentIndex];
        if (currentQ?.options) {
          const matched = currentQ.options.find(
            (o) => o.label.toUpperCase() === targetLabel
          );
          if (matched) {
            e.preventDefault();
            handleSelectOption(matched.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, finishModalOpen, currentIndex, questions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9fc] p-8 flex items-center justify-center">
        <div className="w-full max-w-3xl space-y-6">
          <Skeleton className="h-14 w-full rounded-[8px]" />
          <Skeleton className="h-72 w-full rounded-[8px]" />
          <Skeleton className="h-20 w-full rounded-[8px]" />
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#faf9fc] p-8 flex items-center justify-center">
        <div className="w-full max-w-md">
          <ErrorAlert message={error || 'Soal ujian tidak tersedia.'} />
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.values(selectedAnswers).filter(Boolean).length;
  const isTimeCritical = timeRemaining < 300; // < 5 mins
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  const stemFontSizeClass =
    fontSize === 'sm' ? 'text-[13.5px]' : fontSize === 'lg' ? 'text-[16.5px]' : 'text-[14.5px]';
  const optionFontSizeClass =
    fontSize === 'sm' ? 'text-[12.5px]' : fontSize === 'lg' ? 'text-[15px]' : 'text-[13.5px]';

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden bg-[#f4f2f7] flex flex-col select-none">
      {/* 1. Compact CAT Header (52px height) */}
      <header className="h-[52px] bg-[#352148] text-white px-3 sm:px-5 flex items-center justify-between border-b border-[#4d3363] shrink-0 z-30">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="CAT GOVERNANCE" className="h-7 w-auto brightness-0 invert" />
          <div className="hidden sm:block border-l border-[#59466f] pl-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#bda8d6] block leading-tight">
              FIA UNIVERSITAS MADURA · CAT
            </span>
            <strong className="text-xs font-display text-white block leading-tight truncate max-w-[260px] md:max-w-md">
              {attempt?.exam_title || 'Uji Kompetensi CAT'}
            </strong>
          </div>
        </div>

        {/* Header Tools: Font adjuster, Timer, Fullscreen, Finish */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Font Size Adjuster */}
          <div className="hidden md:flex items-center bg-[#452d5e] p-0.5 rounded-[5px] border border-[#59466f]">
            <button
              type="button"
              onClick={() => setFontSize('sm')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition ${
                fontSize === 'sm' ? 'bg-[#583682] text-white shadow-xs' : 'text-[#bda8d6] hover:text-white'
              }`}
              title="Ukuran teks kecil"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize('base')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition ${
                fontSize === 'base' ? 'bg-[#583682] text-white shadow-xs' : 'text-[#bda8d6] hover:text-white'
              }`}
              title="Ukuran teks normal"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSize('lg')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition ${
                fontSize === 'lg' ? 'bg-[#583682] text-white shadow-xs' : 'text-[#bda8d6] hover:text-white'
              }`}
              title="Ukuran teks besar"
            >
              A+
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-[5px] bg-[#452d5e] border border-[#59466f] text-[#eae2f5] hover:bg-[#583682] hover:text-white transition"
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Countdown Timer */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] border font-mono font-bold text-xs transition-colors ${
              isTimeCritical
                ? 'bg-[#b63b48] border-[#b63b48] text-white animate-pulse'
                : 'bg-[#452d5e] border-[#59466f] text-[#eae2f5]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline text-[11px] font-sans font-normal text-[#bda8d6]">Sisa:</span>
            <span>{formatTime(timeRemaining)}</span>
          </div>

          {/* Mobile Navigator Drawer Toggle */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden p-1.5 bg-[#452d5e] rounded-[5px] border border-[#59466f] text-[#eae2f5]"
            title="Daftar Soal"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>

          {/* Header Submit Button */}
          <Button
            variant="light"
            onClick={() => setFinishModalOpen(true)}
            className="text-xs min-h-[32px] h-8 px-3 bg-[#eaf4ef] text-[#287a58] border-none hover:bg-white font-bold"
            rightIcon={<Send className="w-3 h-3" />}
          >
            Selesaikan
          </Button>
        </div>
      </header>

      {/* Progress Line */}
      <div className="h-[3px] bg-[#ded6e8] w-full shrink-0">
        <div
          className="h-full bg-[#583682] transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 2. Main 3-Column Single-Viewport Layout */}
      <main className="flex-1 min-h-0 w-full max-w-[1560px] mx-auto p-2.5 sm:p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch overflow-hidden">
        {/* Left Column: Participant Identity & Keyboard Guide (3 cols) */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col justify-between bg-white border border-[#e2dce8] rounded-[8px] p-3.5 shadow-xs overflow-hidden">
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#754ead]">
              IDENTITAS PESERTA
            </div>

            <div className="flex flex-col items-center text-center p-3 bg-[#faf9fc] rounded-[6px] border border-[#e8e2ef]">
              <div className="w-14 h-14 rounded-full bg-[#eae2f5] text-[#583682] flex items-center justify-center font-bold text-base mb-2 overflow-hidden border-2 border-[#583682]/20 shadow-inner">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={profile?.full_name || 'Foto Mahasiswa'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <User className="w-7 h-7 stroke-1 text-[#583682]" />
                )}
              </div>
              <h2 className="font-display font-bold text-sm text-[#24212b] line-clamp-1">
                {profile?.full_name || 'Peserta Ujian'}
              </h2>
              <span className="text-[11.5px] text-[#595562] mt-0.5">
                {user?.role === 'umum' || profile?.identifier?.startsWith('UMUM') ? 'No. Peserta' : 'NIM'}:{' '}
                <b>{profile?.identifier || '-'}</b>
              </span>
              <span className="text-[10.5px] text-[#754ead] font-medium mt-0.5">
                FIA Universitas Madura
              </span>
            </div>

            {/* Autosave Status */}
            <div className="flex items-center gap-2 p-2 bg-[#f6f2fa] border border-[#ded6e8] rounded-[6px] text-[11px] text-[#595562]">
              <Shield className="w-3.5 h-3.5 text-[#583682] shrink-0" />
              <span>Sinkronisasi otomatis aktif</span>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-[#e2dce8]">
            {/* Progress summary */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-[#24212b]">
                <span className="text-[11px] text-[#595562] uppercase tracking-wider font-bold">Progres</span>
                <b>{answeredCount} / {questions.length} Soal</b>
              </div>
              <div className="h-2 bg-[#f6f2fa] rounded-full overflow-hidden border border-[#ded6e8]">
                <div
                  className="h-full bg-[#583682] rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-[10.5px] text-[#595562] text-right font-semibold">
                {progressPercent}% selesai
              </div>
            </div>

            {/* Keyboard shortcuts tip */}
            <div className="p-2.5 bg-[#fbfafd] border border-[#ded6e8] rounded-[6px] text-[10.5px] text-[#6b6477] space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-[#583682]">
                <Keyboard className="w-3.5 h-3.5" /> Pintasan Keyboard
              </div>
              <div className="flex justify-between items-center pt-0.5">
                <span>Pindah Soal:</span>
                <span className="px-1.5 py-0.5 bg-white border border-[#ded6e8] rounded font-mono font-semibold text-[#352148]">← / →</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Pilih Jawaban:</span>
                <span className="px-1.5 py-0.5 bg-white border border-[#ded6e8] rounded font-mono font-semibold text-[#352148]">A - E</span>
              </div>
            </div>
          </div>
        </aside>
        {/* Center Column: Question Stem, Options, and Actions (6 cols) */}
        <section className="col-span-1 lg:col-span-6 flex flex-col h-full bg-white border border-[#e2dce8] rounded-[8px] p-3.5 sm:p-4 shadow-xs overflow-hidden">
          {/* Card Top Bar */}
          <div className="flex items-center justify-between pb-2.5 border-b border-[#e2dce8] shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base sm:text-lg text-[#352148]">
                Soal No. {currentIndex + 1}
              </span>
              <span className="text-xs text-[#595562]">
                / dari {questions.length}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              {/* Font Adjuster for mobile/tablets */}
              <div className="flex md:hidden items-center bg-[#f4f2f7] p-0.5 rounded border border-[#ded6e8]">
                <button
                  type="button"
                  onClick={() => setFontSize('sm')}
                  className={`px-1.5 text-[10px] font-bold rounded ${fontSize === 'sm' ? 'bg-white text-[#583682] shadow-xs' : 'text-[#756f82]'}`}
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('base')}
                  className={`px-1.5 text-[10px] font-bold rounded ${fontSize === 'base' ? 'bg-white text-[#583682] shadow-xs' : 'text-[#756f82]'}`}
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('lg')}
                  className={`px-1.5 text-[10px] font-bold rounded ${fontSize === 'lg' ? 'bg-white text-[#583682] shadow-xs' : 'text-[#756f82]'}`}
                >
                  A+
                </button>
              </div>

              {savingStatus === 'saving' && (
                <span className="text-gray-400 flex items-center gap-1 text-[11.5px]">
                  <RotateCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                </span>
              )}
              {savingStatus === 'saved' && (
                <span className="text-[#287a58] flex items-center gap-1 text-[11.5px] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan
                </span>
              )}
              {savingStatus === 'error' && (
                <span className="text-[#a96817] flex items-center gap-1 text-[11.5px] font-medium">
                  <RotateCw className="w-3.5 h-3.5 animate-spin" /> Sinkron ulang...
                </span>
              )}
            </div>
          </div>

          {/* Card Middle: Question Stem + Options (Internal Scrollable Area) */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 sm:pr-2 my-2 space-y-3">
            {/* Question Stem */}
            <div className={`${stemFontSizeClass} text-[#24212b] font-medium leading-relaxed select-text py-1`}>
              {currentQuestion.stem}
            </div>

            {/* Options List */}
            <div className="space-y-2">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedAnswers[currentQuestion.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(opt.id)}
                    className={`w-full text-left p-2.5 sm:p-3 rounded-[6px] border transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-[#eae2f5] border-[#583682] text-[#24212b] ring-1 ring-[#583682] shadow-xs'
                        : 'bg-white border-[#e2dce8] text-[#24212b] hover:bg-[#faf9fc] hover:border-[#cfc2df]'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 transition-all ${
                        isSelected
                          ? 'bg-[#583682] text-white shadow-xs'
                          : 'bg-[#f6f2fa] text-[#583682] border border-[#cfc2df]'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className={`${optionFontSizeClass} pt-0.5 leading-snug flex-1`}>
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card Bottom: Navigation Actions */}
          <div className="shrink-0 pt-2.5 border-t border-[#e2dce8] flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
              className="text-xs h-8.5 px-3.5"
            >
              Sebelumnya
            </Button>

            <span className="text-xs font-semibold text-[#595562] hidden sm:inline">
              Soal {currentIndex + 1} dari {questions.length}
            </span>

            {currentIndex < questions.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                rightIcon={<ChevronRight className="w-4 h-4" />}
                className="text-xs h-8.5 px-4"
              >
                Berikutnya
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setFinishModalOpen(true)}
                rightIcon={<Send className="w-3.5 h-3.5" />}
                className="text-xs h-8.5 px-4 bg-[#287a58] border-[#287a58] hover:bg-[#206346]"
              >
                Selesaikan Ujian
              </Button>
            )}
          </div>
        </section>

        {/* Right Column: Question Navigator Palette (3 cols) */}
        <aside
          className={`${
            mobileNavOpen
              ? 'block fixed inset-x-3 top-16 z-40 bg-white p-4 shadow-2xl rounded-[8px] max-h-[85vh] overflow-y-auto border border-[#ded6e8]'
              : 'hidden'
          } lg:flex lg:col-span-3 flex-col justify-between bg-white border border-[#e2dce8] rounded-[8px] p-3.5 shadow-xs overflow-hidden`}
        >
          {/* Mobile Identity Header */}
          <div className="lg:hidden flex items-center gap-3 p-2.5 bg-[#faf9fc] rounded border border-[#e2dce8] mb-2.5">
            <div className="w-9 h-9 rounded-full bg-[#eae2f5] text-[#583682] flex items-center justify-center overflow-hidden border border-[#d5cae8] shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-[#24212b] truncate">{profile?.full_name || 'Peserta'}</div>
              <div className="text-[10px] text-[#595562]">
                {user?.role === 'umum' || profile?.identifier?.startsWith('UMUM') ? 'No' : 'NIM'}: {profile?.identifier || '-'}
              </div>
            </div>
          </div>

          {/* Palette Top Bar */}
          <div className="flex items-center justify-between pb-2 border-b border-[#e2dce8] shrink-0">
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-[#352148]">
                DAFTAR SOAL
              </h3>
              <span className="text-[11px] text-[#595562]">
                {answeredCount} dari {questions.length} dijawab
              </span>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#f6f2fa] text-[#583682] border border-[#ded6e8]">
              {progressPercent}%
            </span>
          </div>

          {/* Number Palette Grid (Scrollable internally if many questions) */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 py-2 custom-scrollbar">
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = !!selectedAnswers[q.id];

                let btnStyle = '';
                if (isCurrent) {
                  btnStyle =
                    'bg-[#eae2f5] border-2 border-[#583682] text-[#583682] font-black ring-2 ring-[#583682]/25 shadow-xs';
                } else if (isAnswered) {
                  btnStyle = 'bg-[#583682] border-[#583682] text-white font-bold hover:bg-[#4d3363]';
                } else {
                  btnStyle = 'bg-white border-[#dcd6e5] text-[#595562] font-medium hover:bg-[#faf9fc]';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setMobileNavOpen(false);
                    }}
                    className={`h-8 rounded-[4px] border text-xs font-mono transition-all flex items-center justify-center cursor-pointer ${btnStyle}`}
                    title={`Buka Soal No. ${idx + 1}`}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend: 3 Colors Only + Finish Button */}
          <div className="pt-2.5 border-t border-[#e2dce8] space-y-2 shrink-0">
            <div className="space-y-1 text-[11px] text-[#595562]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-[2px] bg-[#eae2f5] border-2 border-[#583682]" />
                  Sedang Dibuka:
                </span>
                <b className="font-mono text-[#583682]">No. {currentIndex + 1}</b>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-[2px] bg-[#583682]" />
                  Sudah Dijawab:
                </span>
                <b className="font-mono text-[#24212b]">{answeredCount}</b>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-[2px] bg-white border border-[#dcd6e5]" />
                  Belum Dijawab:
                </span>
                <b className="font-mono text-[#24212b]">{questions.length - answeredCount}</b>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={() => setFinishModalOpen(true)}
              className="w-full text-xs h-8.5 bg-[#287a58] border-[#287a58] hover:bg-[#206346] font-bold shadow-xs mt-1"
              rightIcon={<Send className="w-3.5 h-3.5" />}
            >
              Selesaikan Ujian
            </Button>
          </div>
        </aside>
      </main>

      {/* Confirmation Finish Modal */}
      <Modal
        isOpen={finishModalOpen}
        onClose={() => setFinishModalOpen(false)}
        title="Selesaikan Ujian?"
        description="Pastikan semua soal telah Anda periksa sebelum dikirim."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-center p-3 bg-[#faf9fc] rounded border border-[#e6e1eb]">
            <div>
              <div className="font-display font-bold text-xl text-[#287a58]">{answeredCount}</div>
              <div className="text-[11px] text-[#595562] font-semibold">Sudah Dijawab</div>
            </div>
            <div>
              <div className="font-display font-bold text-xl text-[#b63b48]">
                {questions.length - answeredCount}
              </div>
              <div className="text-[11px] text-[#595562] font-semibold">Belum Dijawab</div>
            </div>
          </div>

          {answeredCount < questions.length && (
            <div className="p-3 bg-[#fff4df] border border-[#f6ddba] rounded text-xs text-[#a96817] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <b>Perhatian:</b> Masih ada {questions.length - answeredCount} butir soal yang belum Anda jawab.
              </div>
            </div>
          )}

          <p className="text-xs text-[#595562] leading-relaxed">
            Setelah dikirim, lembar jawaban tidak dapat diubah lagi dan sistem akan memproses nilai Anda.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button
              variant="secondary"
              onClick={() => setFinishModalOpen(false)}
              disabled={submitting}
              className="text-xs h-9 px-4"
            >
              Periksa Lagi
            </Button>
            <Button
              variant="primary"
              onClick={handleFinishExam}
              isLoading={submitting}
              className="bg-[#287a58] border-[#287a58] hover:bg-[#206346] text-xs h-9 px-5"
            >
              Kirim Jawaban <Send className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
