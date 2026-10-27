import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resultService } from '../../services';
import { ExamResult } from '../../types';
import { formatWIBDate } from '../../utils/date';
import { Button } from '../../components/ui/Button';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { ErrorAlert } from '../../components/ui/EmptyState';
import { History as HistoryIcon, Search } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua status');
  const navigate = useNavigate();

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await resultService.getMyResults();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat riwayat ujian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredResults = results.filter((item) => {
    const matchName = (item.exam_title || item.session_name || '').toLowerCase().includes(search.toLowerCase());
    const itemStatus = item.status === 'pending_publication'
      ? 'Menunggu Publikasi'
      : item.passed
      ? 'Lulus'
      : 'Tidak Lulus';
    const matchStatus = statusFilter === 'Semua status' || itemStatus === statusFilter;
    return matchName && matchStatus;
  });

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-10 w-full space-y-8">
      {/* 1. History Head */}
      <div className="history-head">
        <div>
          <div className="eyebrow text-xs mb-1">RIWAYAT UJIAN</div>
          <h1>Riwayat Ujian</h1>
          <p>Daftar ujian kompetensi yang telah Anda ikuti.</p>
        </div>
        <span>{filteredResults.length} Ujian</span>
      </div>

      {/* 2. Tabs */}
      <div className="history-tabs" role="tablist">
        <button className="active" role="tab" aria-selected="true">
          Riwayat Ujian
        </button>
        <button
          role="tab"
          onClick={() => {
            if (results[0]) {
              navigate(`/results/latest?resultId=${results[0].id}`);
            } else {
              navigate('/results/latest');
            }
          }}
        >
          Hasil Terakhir
        </button>
        <button
          role="tab"
          onClick={() => {
            const passedResult = results.find((r) => r.passed && r.certificate_id);
            if (passedResult) {
              navigate(`/certificates/latest?id=${passedResult.certificate_id}`);
            } else {
              navigate('/certificates/latest');
            }
          }}
        >
          Sertifikat
        </button>
      </div>

      {/* 3. Filters */}
      <div className="history-filters">
        <label>
          <span className="text-xs font-bold text-[#24212b] block mb-1">Cari Ujian</span>
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ujian"
              className="w-full bg-white border border-[#e6e1eb] rounded-[6px] !pl-10 pr-3 py-2 text-xs text-[#24212b] outline-none focus:border-[#583682]"
            />
          </div>
        </label>
        <label>
          <span className="text-xs font-bold text-[#24212b] block mb-1">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-white border border-[#e6e1eb] rounded-[6px] px-3 py-2 text-xs text-[#24212b] outline-none focus:border-[#583682]"
          >
            <option>Semua status</option>
            <option>Menunggu Publikasi</option>
            <option>Lulus</option>
            <option>Tidak Lulus</option>
          </select>
        </label>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchHistory} />}

      {/* 4. Table */}
      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="empty-state p-12 text-center bg-white border border-[#e6e1eb] rounded-[8px]">
          <HistoryIcon className="w-10 h-10 text-[#583682] mx-auto mb-3" />
          <h2 className="font-display font-bold text-lg text-[#24212b] mb-1">
            Belum Ada Riwayat Ujian
          </h2>
          <p className="text-xs text-[#595562] mb-4">
            Anda belum memiliki riwayat pengerjaan ujian atau tidak cocok dengan filter.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch('');
              setStatusFilter('Semua status');
            }}
            className="text-xs"
          >
            Reset Filter
          </Button>
        </div>
      ) : (
        <div className="history-table rounded-[8px] overflow-hidden border border-[#e6e1eb]">
          <div className="history-table__head">
            <span>Nama Ujian</span>
            <span>Tanggal</span>
            <span>Nilai</span>
            <span>Status</span>
            <span>Aksi</span>
          </div>
          {filteredResults.map((row) => (
            <div className="history-table__row" key={row.id}>
              <strong className="text-sm font-display text-[#24212b]">
                {row.exam_title || row.session_name}
              </strong>
              <span className="text-xs text-[#595562]">
                {formatWIBDate(row.submitted_at || row.created_at, { weekday: undefined })}
              </span>
              <b className="text-sm text-[#24212b]">{row.score}</b>
              <i
                className={`not-italic text-xs font-bold px-2 py-0.5 rounded ${
                  row.status === 'pending_publication'
                    ? 'bg-[#fef3c7] text-[#92400e]'
                    : row.passed
                    ? 'passed bg-[#e8f3ed] text-[#287a58]'
                    : 'failed bg-[#f8e9eb] text-[#b63b48]'
                }`}
              >
                {row.status === 'pending_publication'
                  ? 'Menunggu Publikasi'
                  : row.passed
                  ? 'Lulus'
                  : 'Tidak Lulus'}
              </i>
              <button
                onClick={() => navigate(`/results/latest?resultId=${row.id}`)}
                className="text-xs font-bold text-[#583682] hover:underline cursor-pointer"
              >
                Lihat Hasil
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
