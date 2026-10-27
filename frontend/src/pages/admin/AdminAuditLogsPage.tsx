import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NotificationsManagerView } from './AdminNotificationsPage';
import { auditService } from '../../services';
import { AuditLog } from '../../types';
import { formatWIBDateTime } from '../../utils/date';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { alert } from '../../utils/alert';
import { ShieldAlert, Search, RefreshCw, Bell, Eye, Download, FileCode, Filter } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const AdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditLog | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'logs' | 'notifications'>(
    tabParam === 'notifications' ? 'notifications' : 'logs'
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'notifications') {
      setActiveTab('notifications');
    } else {
      setActiveTab('logs');
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'logs' | 'notifications') => {
    setActiveTab(tab);
    if (tab === 'notifications') {
      setSearchParams({ tab: 'notifications' });
    } else {
      setSearchParams({});
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await auditService.getAuditLogs({ limit: 100 });
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat log audit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      (l.actor_email && l.actor_email.toLowerCase().includes(search.toLowerCase())) ||
      (l.reason && l.reason.toLowerCase().includes(search.toLowerCase())) ||
      (l.ip_address && l.ip_address.includes(search));

    const matchesEntity = entityFilter === 'all' || l.entity_type === entityFilter;

    return matchesSearch && matchesEntity;
  });

  const handleExportLogsJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(filteredLogs, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `Audit_Trail_Export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    alert.toast('Log audit berhasil diekspor ke format JSON!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigasi Terpadu: Audit Trail & Notifikasi Sistem */}
      <div className="flex border-b border-[#e6e1eb] gap-6">
        <button
          type="button"
          onClick={() => handleTabChange('logs')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'logs'
              ? 'border-[#583682] text-[#583682] font-bold'
              : 'border-transparent text-[#595562] hover:text-[#24212b]'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Log Audit</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#eae2f5] text-[#583682] font-bold">
            {logs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('notifications')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'notifications'
              ? 'border-[#583682] text-[#583682] font-bold'
              : 'border-transparent text-[#595562] hover:text-[#24212b]'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notifikasi Sistem</span>
        </button>
      </div>

      {activeTab === 'notifications' ? (
        <NotificationsManagerView hideHeaderTitle={true} />
      ) : (
        <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">AUDIT TRAIL</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Log Audit Sistem
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Catatan riwayat aktivitas pengguna, sesi, dan perubahan data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleExportLogsJSON}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            className="text-xs"
            title="Ekspor ke JSON"
          >
            Ekspor JSON
          </Button>
          <Button
            variant="secondary"
            onClick={fetchLogs}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            Muat Ulang
          </Button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchLogs} />}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Cari log audit"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-gray-400" />}
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="w-full h-[46px] px-3.5 bg-white border border-[#e6e1eb] rounded-[6px] text-xs text-[#24212b] outline-none"
            title="Filter entitas"
          >
            <option value="all">Semua Entitas</option>
            <option value="users">Pengguna (users)</option>
            <option value="questions">Bank Soal (questions)</option>
            <option value="exams">Paket Ujian (exams)</option>
            <option value="sessions">Jadwal Sesi (sessions)</option>
            <option value="results">Hasil Ujian (results)</option>
            <option value="settings">Pengaturan (settings)</option>
          </select>
        </div>
      </div>

      <Card hasShadow className="overflow-hidden p-0">
        {loading ? (
          <div className="p-6">
            <CardSkeleton />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Belum Ada Log Audit"
              description="Aktivitas penting sistem seperti login dan perubahan data akan tercatat di sini."
              icon={<ShieldAlert className="w-8 h-8 text-[#583682]" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf9fc] border-b border-[#e6e1eb] text-[#595562] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-3.5">Waktu</th>
                  <th className="px-6 py-3.5">Aksi</th>
                  <th className="px-6 py-3.5">Aktor</th>
                  <th className="px-6 py-3.5">Alamat IP</th>
                  <th className="px-6 py-3.5">Keterangan</th>
                  <th className="px-6 py-3.5 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e1eb]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#faf9fc]/80 transition">
                    <td className="px-6 py-4 font-mono text-gray-500 whitespace-nowrap">
                      {formatWIBDateTime(log.created_at)}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-[#583682]">
                      <span className="bg-[#eae2f5] px-2 py-0.5 rounded">{log.action}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#24212b]">{log.actor_email || log.actor_id}</div>
                      <div className="text-[10px] text-[#595562] uppercase">{log.actor_role}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500">{log.ip_address || '-'}</td>
                    <td className="px-6 py-4 text-[#24212b] max-w-sm">
                      {log.reason || `Entitas: ${log.entity_type} (${log.entity_id || '-'})`}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedLogForDetail(log);
                          setDetailModalOpen(true);
                        }}
                        className="p-1.5 text-gray-500 hover:text-[#583682] hover:bg-[#eae2f5] rounded transition cursor-pointer"
                        title="Lihat Detail JSON"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
        </div>
      )}

      {/* Modal Detail Payload JSON */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedLogForDetail(null);
        }}
        title="Detail Log Audit"
        description={`Aksi: ${selectedLogForDetail?.action} | Waktu: ${selectedLogForDetail?.created_at ? formatWIBDateTime(selectedLogForDetail.created_at) : '-'}`}
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end w-full">
            <Button
              variant="secondary"
              onClick={() => {
                setDetailModalOpen(false);
                setSelectedLogForDetail(null);
              }}
            >
              Tutup
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-[#faf9fc] rounded border border-[#e6e1eb] grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400 block text-[11px]">Aktor:</span>
              <strong className="text-[#24212b]">{selectedLogForDetail?.actor_email || selectedLogForDetail?.actor_id}</strong>
              <span className="text-[10px] text-[#583682] uppercase ml-1">({selectedLogForDetail?.actor_role})</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Alamat IP:</span>
              <span className="font-mono text-[#24212b]">{selectedLogForDetail?.ip_address || '-'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Tipe Entitas:</span>
              <strong className="text-[#24212b]">{selectedLogForDetail?.entity_type}</strong>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">ID Entitas:</span>
              <span className="font-mono text-[11px] text-gray-500">{selectedLogForDetail?.entity_id || '-'}</span>
            </div>
          </div>

          {selectedLogForDetail?.reason && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
              <span className="font-bold block mb-0.5">Alasan Perubahan:</span>
              <span>{selectedLogForDetail.reason}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <div className="text-xs font-bold text-[#24212b] mb-1 flex items-center justify-between">
                <span>Data Sebelum Perubahan (before_data):</span>
                {!selectedLogForDetail?.before_data && <span className="text-gray-400 text-[11px] font-normal">(Tidak ada)</span>}
              </div>
              <pre className="p-3 bg-[#1e1b2e] text-[#bce2cf] rounded text-[11px] font-mono overflow-x-auto max-h-48 border border-gray-700">
                {selectedLogForDetail?.before_data
                  ? JSON.stringify(selectedLogForDetail.before_data, null, 2)
                  : '// Tidak ada data awal (operasi insert)'}
              </pre>
            </div>

            <div>
              <div className="text-xs font-bold text-[#24212b] mb-1 flex items-center justify-between">
                <span>Data Sesudah Perubahan (after_data):</span>
                {!selectedLogForDetail?.after_data && <span className="text-gray-400 text-[11px] font-normal">(Tidak ada)</span>}
              </div>
              <pre className="p-3 bg-[#1e1b2e] text-[#f2eff6] rounded text-[11px] font-mono overflow-x-auto max-h-48 border border-gray-700">
                {selectedLogForDetail?.after_data
                  ? JSON.stringify(selectedLogForDetail.after_data, null, 2)
                  : '// Tidak ada data akhir (operasi delete)'}
              </pre>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
