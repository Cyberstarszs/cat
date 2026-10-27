import React, { useMemo, useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  formatWIBDate,
  getWIBDateString,
  addMinutesToTime,
  addMinutesToWIBDateTime,
  calculateMinutesDuration,
} from '../../utils/date';

export interface SessionSchedulePickerProps {
  startsAt: string; // YYYY-MM-DDTHH:mm
  endsAt: string;   // YYYY-MM-DDTHH:mm
  onChange: (startsAt: string, endsAt: string) => void;
  examDurationMinutes?: number;
  className?: string;
}

const COMMON_SESSIONS = [
  { label: 'Sesi 1 (08:00)', time: '08:00' },
  { label: 'Sesi 2 (10:00)', time: '10:00' },
  { label: 'Sesi 3 (13:00)', time: '13:00' },
  { label: 'Sesi 4 (15:30)', time: '15:30' },
];

const COMMON_DURATIONS = [60, 90, 120, 180];

export const SessionSchedulePicker: React.FC<SessionSchedulePickerProps> = ({
  startsAt,
  endsAt,
  onChange,
  examDurationMinutes,
  className = '',
}) => {
  // Extract parts safely with fallbacks
  const todayWIB = useMemo(() => getWIBDateString(0), []);
  const tomorrowWIB = useMemo(() => getWIBDateString(1), []);
  const dayAfterWIB = useMemo(() => getWIBDateString(2), []);

  const startDate = startsAt ? startsAt.slice(0, 10) : todayWIB;
  const startTime = startsAt && startsAt.length >= 16 ? startsAt.slice(11, 16) : '08:00';

  const rawEndDate = endsAt ? endsAt.slice(0, 10) : startDate;
  const endTime = endsAt && endsAt.length >= 16 ? endsAt.slice(11, 16) : '09:30';

  // Multi-day toggle state
  const [isMultiDay, setIsMultiDay] = useState(rawEndDate !== startDate);
  const endDate = isMultiDay ? rawEndDate : startDate;

  useEffect(() => {
    setIsMultiDay(rawEndDate !== startDate);
  }, [rawEndDate, startDate]);

  // Calculate live duration in minutes
  const durationMinutes = useMemo(() => {
    return calculateMinutesDuration(`${startDate}T${startTime}`, `${endDate}T${endTime}`);
  }, [startDate, startTime, endDate, endTime]);

  const isTimeValid = durationMinutes > 0;

  // Indonesian date label preview
  const formattedDateLabel = useMemo(() => {
    try {
      return formatWIBDate(`${startDate}T00:00:00+07:00`);
    } catch {
      return startDate;
    }
  }, [startDate]);

  const formattedEndDateLabel = useMemo(() => {
    try {
      return formatWIBDate(`${endDate}T00:00:00+07:00`);
    } catch {
      return endDate;
    }
  }, [endDate]);

  // Handler: Change Date (WIB)
  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    const targetEndDate = isMultiDay ? endDate : newDate;
    onChange(`${newDate}T${startTime}`, `${targetEndDate}T${endTime}`);
  };

  // Handler: Change End Date (Multi-Day only)
  const handleEndDateChange = (newEndDate: string) => {
    if (!newEndDate) return;
    onChange(`${startDate}T${startTime}`, `${newEndDate}T${endTime}`);
  };

  // Handler: Toggle Multi-Day
  const handleToggleMultiDay = (checked: boolean) => {
    setIsMultiDay(checked);
    if (!checked) {
      // Sync end date back to start date
      onChange(`${startDate}T${startTime}`, `${startDate}T${endTime}`);
    }
  };

  // Handler: Change Start Time
  const handleStartTimeChange = (newStartTime: string) => {
    if (!newStartTime) return;
    // Keep current duration intact if it's already positive
    if (durationMinutes > 0) {
      const nextEndISO = addMinutesToWIBDateTime(`${startDate}T${newStartTime}`, durationMinutes);
      if (nextEndISO) {
        const nextEndDate = nextEndISO.slice(0, 10);
        if (nextEndDate !== startDate && !isMultiDay) {
          setIsMultiDay(true);
        }
        onChange(`${startDate}T${newStartTime}`, nextEndISO);
        return;
      }
    }
    onChange(`${startDate}T${newStartTime}`, `${endDate}T${endTime}`);
  };

  // Handler: Change End Time
  const handleEndTimeChange = (newEndTime: string) => {
    if (!newEndTime) return;
    onChange(`${startDate}T${startTime}`, `${endDate}T${newEndTime}`);
  };

  // Quick Preset: Click Sesi (08:00, 10:00, etc.)
  const handleSelectSessionPreset = (sessionTime: string) => {
    const desiredDuration = durationMinutes > 0 ? durationMinutes : (examDurationMinutes || 90);
    const nextEndISO = addMinutesToWIBDateTime(`${startDate}T${sessionTime}`, desiredDuration);
    if (!nextEndISO) return;
    const nextEndDate = nextEndISO.slice(0, 10);
    if (nextEndDate !== startDate && !isMultiDay) {
      setIsMultiDay(true);
    }
    onChange(`${startDate}T${sessionTime}`, nextEndISO);
  };

  // Quick Preset: Duration (+60m, +90m, or Sesuai Ujian)
  const handleApplyDuration = (minutes: number) => {
    const nextEndISO = addMinutesToWIBDateTime(`${startDate}T${startTime}`, minutes);
    if (!nextEndISO) return;
    const nextEndDate = nextEndISO.slice(0, 10);
    if (nextEndDate !== startDate && !isMultiDay) {
      setIsMultiDay(true);
    }
    onChange(`${startDate}T${startTime}`, nextEndISO);
  };

  return (
    <div className={`p-4 bg-[#faf9fc] border border-[#e6e1eb] rounded-lg space-y-4 text-left ${className}`}>
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e6e1eb] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#eae2f5] text-[#583682] flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#24212b] uppercase tracking-wider">
              Waktu
            </h4>
            <p className="text-[11px] text-[#595562]">
              WIB (24 Jam)
            </p>
          </div>
        </div>

        {/* Live Mini Badge */}
        {isTimeValid && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#eae2f5] text-[#583682] text-xs font-bold self-start sm:self-auto">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{durationMinutes} Menit</span>
          </div>
        )}
      </div>

      {/* Bagian 1: Tanggal Pelaksanaan */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-xs font-bold text-[#24212b] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#583682]" />
            <span>Tanggal</span>
            <span className="text-[#b63b48]">*</span>
          </label>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleDateChange(todayWIB)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${
                startDate === todayWIB
                  ? 'bg-[#583682] text-white shadow-xs'
                  : 'bg-white border border-[#e6e1eb] text-[#595562] hover:bg-[#eae2f5] hover:text-[#583682]'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => handleDateChange(tomorrowWIB)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${
                startDate === tomorrowWIB
                  ? 'bg-[#583682] text-white shadow-xs'
                  : 'bg-white border border-[#e6e1eb] text-[#595562] hover:bg-[#eae2f5] hover:text-[#583682]'
              }`}
            >
              Besok
            </button>
            <button
              type="button"
              onClick={() => handleDateChange(dayAfterWIB)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${
                startDate === dayAfterWIB
                  ? 'bg-[#583682] text-white shadow-xs'
                  : 'bg-white border border-[#e6e1eb] text-[#595562] hover:bg-[#eae2f5] hover:text-[#583682]'
              }`}
            >
              Lusa
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full h-10 px-3.5 bg-white border border-[#e6e1eb] focus:border-[#583682] rounded-[6px] text-sm font-semibold text-[#24212b] outline-none"
            required
          />
          <div className="text-xs text-[#583682] font-semibold flex items-center gap-1.5 px-3 py-2 bg-[#eae2f5]/60 rounded border border-[#dfd5ed]">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{formattedDateLabel}</span>
          </div>
        </div>
      </div>

      {/* Bagian 2: Jam Mulai & Jam Selesai */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {/* Kolom Jam Mulai */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#24212b]">
              Mulai <span className="text-[#b63b48]">*</span>
            </label>
            <span className="text-[10px] text-[#595562]">24 Jam</span>
          </div>

          <input
            type="time"
            value={startTime}
            onChange={(e) => handleStartTimeChange(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-[#e6e1eb] focus:border-[#583682] rounded-[6px] text-sm font-bold text-[#24212b] outline-none"
            required
          />

          {/* Quick Session Presets */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-[#595562] uppercase tracking-wider block">
              Sesi:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {COMMON_SESSIONS.map((sess) => (
                <button
                  key={sess.time}
                  type="button"
                  onClick={() => handleSelectSessionPreset(sess.time)}
                  className={`px-2 py-1 text-[11px] font-medium rounded border text-left transition ${
                    startTime === sess.time
                      ? 'border-[#583682] bg-[#eae2f5] text-[#583682] font-bold shadow-xs'
                      : 'border-[#e6e1eb] bg-white text-[#595562] hover:bg-[#faf9fc] hover:border-[#cfc9d6]'
                  }`}
                >
                  {sess.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Kolom Jam Selesai */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#24212b]">
              Selesai <span className="text-[#b63b48]">*</span>
            </label>
            {isTimeValid && (
              <span className="text-[11px] font-bold text-[#583682]">
                {durationMinutes} Menit
              </span>
            )}
          </div>

          <input
            type="time"
            value={endTime}
            onChange={(e) => handleEndTimeChange(e.target.value)}
            className={`w-full h-10 px-3 bg-white border ${
              !isTimeValid ? 'border-[#b63b48] ring-1 ring-[#b63b48]' : 'border-[#e6e1eb] focus:border-[#583682]'
            } rounded-[6px] text-sm font-bold text-[#24212b] outline-none`}
            required
          />

          {/* Quick Duration Presets */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-[#595562] uppercase tracking-wider block">
              Durasi:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {examDurationMinutes && examDurationMinutes > 0 ? (
                <button
                  type="button"
                  onClick={() => handleApplyDuration(examDurationMinutes)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded border flex items-center gap-1 transition ${
                    durationMinutes === examDurationMinutes
                      ? 'bg-[#583682] text-white border-[#583682] shadow-xs'
                      : 'bg-[#faf3e0] text-[#8a5d00] border-[#ecd8a5] hover:bg-[#f6ebd0]'
                  }`}
                  title="Sesuaikan durasi otomatis sesuai paket soal ujian"
                >
                  <Zap className="w-3 h-3" />
                  <span>Paket ({examDurationMinutes}m)</span>
                </button>
              ) : null}

              {COMMON_DURATIONS.map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => handleApplyDuration(dur)}
                  className={`px-2 py-1 text-[11px] font-medium rounded border transition ${
                    durationMinutes === dur && durationMinutes !== examDurationMinutes
                      ? 'border-[#583682] bg-[#eae2f5] text-[#583682] font-bold'
                      : 'border-[#e6e1eb] bg-white text-[#595562] hover:bg-[#faf9fc]'
                  }`}
                >
                  +{dur}m
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bagian 3: Ringkasan Sesi Terpilih (Live Card) */}
      {!isTimeValid ? (
        <div className="p-3 bg-[#fdf2f2] border border-[#f5c6cb] rounded-[6px] flex items-center gap-2.5 text-[#b63b48] text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div>
            <strong>Jam selesai ({endTime}) harus setelah jam mulai ({startTime}).</strong>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-white border border-[#e6e1eb] rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#e8f5e9] text-[#2e7d32] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-[#24212b] text-sm">
                {formattedDateLabel}
                {isMultiDay && ` s.d. ${formattedEndDateLabel}`} · {startTime} – {endTime} WIB
              </div>
              <div className="text-[11px] text-[#595562] mt-0.5">
                Durasi:{' '}
                <strong className="text-[#583682]">{durationMinutes} Menit</strong>
                {durationMinutes >= 60 && (
                  <span>
                    {' '}({Math.floor(durationMinutes / 60)} jam{durationMinutes % 60 ? ` ${durationMinutes % 60} menit` : ''})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-[11px] font-bold text-[#583682] bg-[#eae2f5] px-2.5 py-1 rounded self-start sm:self-auto uppercase tracking-wider">
            WIB
          </div>
        </div>
      )}

      {/* Bagian 4: Opsi Lintas Hari (Multi-Day Toggle) */}
      <div className="pt-1 border-t border-[#e6e1eb]/70">
        <label className="inline-flex items-center gap-2 text-xs text-[#595562] cursor-pointer hover:text-[#24212b]">
          <input
            type="checkbox"
            checked={isMultiDay}
            onChange={(e) => handleToggleMultiDay(e.target.checked)}
            className="rounded border-[#e6e1eb] text-[#583682] focus:ring-[#583682]"
          />
          <span>Lintas hari</span>
        </label>

        {isMultiDay && (
          <div className="mt-2.5 p-3 bg-white border border-[#e6e1eb] rounded-[6px] space-y-1.5 animate-fadeIn">
            <label className="text-xs font-bold text-[#24212b]">
              Selesai <span className="text-[#b63b48]">*</span>
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-[#e6e1eb] rounded-[6px] text-sm font-semibold text-[#24212b]"
              required
            />
            <p className="text-[11px] text-[#595562]">
              Tutup: <strong>{formattedEndDateLabel} {endTime} WIB</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
