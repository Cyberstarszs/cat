import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { attemptService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { AttemptDetail, AttemptQuestionItem } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorAlert } from '../../components/ui/EmptyState';
import logoImg from '../../assets/cat-governance-logo.png';
import {
  Clock,
  CheckCircle2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  RotateCw,
  Shield,
  User,
  LayoutGrid,
} from 'lucide-react';

export const ExamRoomPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [questions, setQuestions] = useState<AttemptQuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | null>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client sequence for idempotent updates
  const clientSeqRef = useRef<number>(1);

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
        setAttempt(data);
        const questionsList = data.questions || [];
        setQuestions(questionsList);
        setTimeRemaining(data.time_remaining_seconds || (data.duration_minutes ? data.duration_minutes * 60 : 0));

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

  // Submit attempt handler
  const handleFinishExam = useCallback(async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    try {
      const res = await attemptService.finishAttempt(attemptId);
      navigate(`/results/latest?resultId=${res.result_id}`);
    } catch (err: any) {
      alert(err.message || 'Gagal mengirimkan ujian. Silakan coba kembali.');
      setSubmitting(false);
    }
  }, [attemptId, submitting, navigate]);

  // Countdown Timer
  useEffect(() => {
    if (loading || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [loading, timeRemaining, handleFinishExam]);

  // Format seconds into HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Answer selection & autosave
  const handleSelectOption = async (optionId: string) => {
    if (!attemptId || questions.length === 0) return;
    const currentQ = questions[currentIndex];

    // Optimistic UI update
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionId,
    }));

    setSavingStatus('saving');
    clientSeqRef.current += 1;

    try {
      await attemptService.autosaveAnswer(attemptId, {
        attempt_question_id: currentQ.id,
        selected_option_id: optionId,
        client_seq: clientSeqRef.current,
      });
      setSavingStatus('saved');
    } catch (err) {
      console.error('Autosave failed:', err);
      setSavingStatus('error');
    }
  };

  // Toggle doubtful flag
  const toggleDoubtful = () => {
    const currentQ = questions[currentIndex];
    setFlaggedQuestions((prev) => ({
      ...prev,
      [currentQ.id]: !prev[currentQ.id],
    }));
  };

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
  const flaggedCount = Object.values(flaggedQuestions).filter(Boolean).length;
  const isTimeCritical = timeRemaining < 300; // < 5 mins
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="min-h-screen bg-[#faf9fc] flex flex-col select-none">
      {/* 1. Top CAT Header */}
      <header className="sticky top-0 z-30 h-[70px] bg-[#352148] text-white px-6 flex items-center justify-between border-b border-[#4d3363]">
        <div className="flex items-center gap-4">
          <img src={logoImg} alt="CAT GOVERNANCE" className="h-8 w-auto brightness-0 invert" />
          <div className="hidden md:block border-l border-[#59466f] pl-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#bda8d6] block">
              UJI KOMPETENSI · SOAL {currentIndex + 1} DARI {questions.length}
            </span>
            <strong className="text-sm font-display text-white">
              {attempt?.exam_title || 'Soal Assessment LG / Uji Kompetensi'}
            </strong>
          </div>
        </div>

        {/* Real-time Timer display & Finish Button */}
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] border font-mono font-bold text-sm transition-colors ${
              isTimeCritical
                ? 'bg-[#b63b48] border-[#b63b48] text-white animate-pulse'
                : 'bg-[#4d3363] border-[#59466f] text-[#eae2f5]'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Waktu Tersisa:</span>
            <span>{formatTime(timeRemaining)}</span>
          </div>

          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden p-2 bg-[#4d3363] rounded border border-[#59466f] text-[#eae2f5]"
            title="Navigasi Soal"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          <Button
            variant="light"
            onClick={() => setFinishModalOpen(true)}
            className="text-xs min-h-[38px] px-3.5 bg-[#eaf4ef] text-[#287a58] border-none hover:bg-white font-bold"
            rightIcon={<Send className="w-3.5 h-3.5" />}
          >
            Selesaikan Ujian
          </Button>
        </div>
      </header>

      {/* Progress Line */}
      <div className="h-1 bg-[#e6e1eb] w-full">
        <div
          className="h-full bg-[#583682] transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 2. Main 3-Column Exam Layout */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Participant Identity & Live Telemetry (3 cols) */}
        <aside className="hidden lg:block lg:col-span-3 bg-white border border-[#e6e1eb] rounded-[8px] p-5 shadow-sm space-y-5">
          <div className="eyebrow text-[11px]">
            PESERTA / {profile?.identifier ? profile.identifier.slice(-6) : '001245'}
          </div>

          <div className="flex flex-col items-center text-center p-4 bg-[#faf9fc] rounded border border-[#e6e1eb]">
            <div className="w-16 h-16 rounded-full bg-[#eae2f5] text-[#583682] flex items-center justify-center font-bold text-xl mb-3">
              <User className="w-8 h-8 stroke-1" />
            </div>
            <h2 className="font-display font-bold text-base text-[#24212b]">
              {profile?.full_name || 'Wahyu Hidayatullah'}
            </h2>
            <span className="text-xs text-[#595562] mt-0.5">
              NIM {profile?.identifier || '202412345'}
            </span>
            <span className="text-[11px] font-mono font-semibold text-[#583682] mt-0.5">
              CAT-2026-{profile?.identifier || '001245'}
            </span>
          </div>

          {/* System Normal State */}
          <div className="flex items-start gap-3 p-3 bg-[#eaf4ef] border border-[#badfcb] rounded text-xs text-[#287a58]">
            <div className="w-2.5 h-2.5 rounded-full bg-[#287a58] mt-1 shrink-0 animate-ping" />
            <div>
              <b className="block">Sistem Normal</b>
              <span className="text-[11px] text-[#287a58]">Jawaban tersimpan otomatis</span>
            </div>
          </div>

          {/* Progress summary */}
          <div className="space-y-2 pt-2 border-t border-[#e6e1eb]">
            <div className="flex justify-between text-xs font-semibold text-[#24212b]">
              <span>KEMAJUAN UJIAN</span>
              <b>{answeredCount} / {questions.length} Soal</b>
            </div>
            <div className="h-2 bg-[#f6f2fa] rounded-full overflow-hidden border border-[#e6e1eb]">
              <div
                className="h-full bg-[#583682] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-[11px] text-[#595562] text-right font-semibold">
              {progressPercent}% selesai
            </div>
          </div>
        </aside>

        {/* Center Column: Question Stem, Options, and Actions (6 cols) */}
        <section className="lg:col-span-6 flex flex-col space-y-4">
          <Card hasShadow className="flex-1 flex flex-col justify-between p-6">
            <div>
              {/* Question Meta Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#e6e1eb] mb-6">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-lg text-[#583682]">
                    Soal No. {currentIndex + 1}
                  </span>
                  <span className="text-xs text-[#595562]">
                    / PILIHAN GANDA
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {savingStatus === 'saving' && (
                    <span className="text-gray-400 flex items-center gap-1">
                      <RotateCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                    </span>
                  )}
                  {savingStatus === 'saved' && (
                    <span className="text-[#287a58] flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan
                    </span>
                  )}
                  {savingStatus === 'error' && (
                    <span className="text-[#b63b48] flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" /> Gagal simpan
                    </span>
                  )}

                  <button
                    onClick={toggleDoubtful}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border transition cursor-pointer ${
                      flaggedQuestions[currentQuestion.id]
                        ? 'bg-[#fdf6ec] text-[#a96817] border-[#f6ddba]'
                        : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{flaggedQuestions[currentQuestion.id] ? 'Ditandai Ragu' : 'Tandai Ragu'}</span>
                  </button>
                </div>
              </div>

              {/* Question Stem / Content */}
              <div className="text-sm md:text-base text-[#24212b] font-medium leading-relaxed mb-8 select-text">
                {currentQuestion.stem}
              </div>

              {/* Options List */}
              <div className="space-y-3">
                {currentQuestion.options.map((opt) => {
                  const isSelected = selectedAnswers[currentQuestion.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(opt.id)}
                      className={`w-full text-left p-4 rounded-[6px] border transition flex items-start gap-3.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#eae2f5] border-[#583682] text-[#24212b] shadow-xs'
                          : 'bg-white border-[#e6e1eb] text-[#24212b] hover:bg-[#faf9fc] hover:border-[#cfc2df]'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 transition ${
                          isSelected
                            ? 'bg-[#583682] text-white'
                            : 'bg-[#f6f2fa] text-[#583682] border border-[#cfc2df]'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-xs md:text-sm pt-0.5 leading-normal">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Question Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-[#e6e1eb] mt-8 gap-2">
              <Button
                variant="secondary"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
                className="text-xs"
              >
                Soal Sebelumnya
              </Button>

              <button
                onClick={toggleDoubtful}
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold border transition cursor-pointer ${
                  flaggedQuestions[currentQuestion.id]
                    ? 'bg-[#fdf6ec] text-[#a96817] border-[#f6ddba]'
                    : 'bg-white text-[#595562] border-[#e6e1eb] hover:bg-[#faf9fc]'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                {flaggedQuestions[currentQuestion.id] ? 'Ditandai untuk ditinjau' : 'Tandai untuk ditinjau'}
              </button>

              {currentIndex < questions.length - 1 ? (
                <Button
                  variant="primary"
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                  className="text-xs"
                >
                  Soal Berikutnya
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => setFinishModalOpen(true)}
                  rightIcon={<Send className="w-4 h-4" />}
                  className="text-xs bg-[#287a58] border-[#287a58] hover:bg-[#206346]"
                >
                  Selesaikan Ujian
                </Button>
              )}
            </div>
          </Card>
        </section>

        {/* Right Column: Question Navigator Palette (3 cols) */}
        <aside
          className={`${
            mobileNavOpen ? 'block fixed inset-x-4 top-20 z-40 bg-white p-5 shadow-2xl rounded-[8px]' : 'hidden'
          } lg:block lg:col-span-3 bg-white border border-[#e6e1eb] rounded-[8px] p-5 shadow-sm space-y-4`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#e6e1eb]">
            <h3 className="font-display font-bold text-sm text-[#24212b]">
              NAVIGASI SOAL
            </h3>
            <button
              onClick={() => setFinishModalOpen(true)}
              className="text-xs font-bold text-[#583682] hover:underline cursor-pointer"
            >
              Selesaikan Ujian
            </button>
          </div>

          {/* Number grid */}
          <div className="grid grid-cols-5 gap-2 max-h-[360px] overflow-y-auto pr-1 no-scrollbar">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = !!selectedAnswers[q.id];
              const isFlagged = !!flaggedQuestions[q.id];

              let btnStyle = 'bg-white border-[#e6e1eb] text-[#24212b] hover:bg-[#faf9fc]';
              if (isFlagged) {
                btnStyle = 'bg-[#fdf6ec] border-[#a96817] text-[#a96817] font-bold';
              } else if (isAnswered) {
                btnStyle = 'bg-[#583682] border-[#583682] text-white font-bold';
              }

              if (isCurrent) {
                btnStyle += ' ring-2 ring-[#754ead] ring-offset-1 font-bold';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setMobileNavOpen(false);
                  }}
                  className={`h-9 rounded-[4px] border text-xs font-mono transition flex items-center justify-center cursor-pointer ${btnStyle}`}
                >
                  {String(idx + 1).padStart(2, '0')}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="space-y-1.5 text-[11px] text-[#595562] pt-3 border-t border-[#e6e1eb]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#583682]" /> Terjawab:
              </span>
              <b>{answeredCount}</b>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-white border border-[#e6e1eb]" /> Belum dijawab:
              </span>
              <b>{questions.length - answeredCount}</b>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#fdf6ec] border border-[#a96817]" /> Ditandai:
              </span>
              <b>{flaggedCount}</b>
            </div>
          </div>

          <p className="text-[10px] text-[#595562] flex items-center gap-1.5 pt-2 border-t border-[#e6e1eb]">
            <Shield className="w-3.5 h-3.5 text-[#583682] shrink-0" />
            Jawaban tersimpan otomatis pada perangkat ini.
          </p>
        </aside>
      </div>

      {/* Confirmation Finish Modal */}
      <Modal
        isOpen={finishModalOpen}
        onClose={() => setFinishModalOpen(false)}
        title="Konfirmasi Pengiriman Ujian"
        description="Selesaikan dan kirim seluruh lembar jawaban ujian?"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center p-3 bg-[#faf9fc] rounded border border-[#e6e1eb]">
            <div>
              <div className="font-display font-bold text-lg text-[#287a58]">{answeredCount}</div>
              <div className="text-[10px] text-[#595562] font-semibold">Soal Terjawab</div>
            </div>
            <div>
              <div className="font-display font-bold text-lg text-[#a96817]">{flaggedCount}</div>
              <div className="text-[10px] text-[#595562] font-semibold">Ditandai</div>
            </div>
            <div>
              <div className="font-display font-bold text-lg text-[#b63b48]">
                {questions.length - answeredCount}
              </div>
              <div className="text-[10px] text-[#595562] font-semibold">Belum Dijawab</div>
            </div>
          </div>

          {answeredCount < questions.length && (
            <div className="p-3 bg-[#fff4df] border border-[#f6ddba] rounded text-xs text-[#a96817] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <b>Periksa kembali jawaban Anda:</b> Masih terdapat {questions.length - answeredCount} butir soal yang belum dijawab.
              </div>
            </div>
          )}

          <p className="text-xs text-[#595562] leading-relaxed">
            Setelah dikirimkan, jawaban tidak dapat diubah kembali dan hasil asesmen akan segera diproses oleh sistem.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e1eb]">
            <Button
              variant="secondary"
              onClick={() => setFinishModalOpen(false)}
              disabled={submitting}
            >
              Kembali Periksa Jawaban
            </Button>
            <Button
              variant="primary"
              onClick={handleFinishExam}
              isLoading={submitting}
              className="bg-[#287a58] border-[#287a58] hover:bg-[#206346]"
            >
              Kirim Jawaban <Send className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
