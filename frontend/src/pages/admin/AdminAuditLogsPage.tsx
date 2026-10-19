import React, { useEffect, useState } from 'react';
import { auditService } from '../../services';
import { AuditLog } from '../../types';
import { formatWIBDateTime } from '../../utils/date';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import { ShieldAlert, Search, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const AdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
    return (
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      (l.actor_email && l.actor_email.toLowerCase().includes(search.toLowerCase())) ||
      (l.reason && l.reason.toLowerCase().includes(search.toLowerCase())) ||
      (l.ip_address && l.ip_address.includes(search))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">AUDIT TRAIL & KEAMANAN</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Log Audit & Jejak Aktivitas Sistem
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Rekam jejak tindakan administratif, perubahan kunci jawaban, autentikasi sesi, dan interaksi peserta.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={fetchLogs}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          className="text-xs"
        >
          Muat Ulang Log
        </Button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchLogs} />}

      <div className="max-w-md">
        <Input
          placeholder="Cari aksi, email aktor, atau alamat IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-gray-400" />}
        />
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
              description="Aktivitas penting sistem seperti login, koreksi soal, dan perubahan data akan tercatat di sini."
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
                  <th className="px-6 py-3.5">Aktor / Pengguna</th>
                  <th className="px-6 py-3.5">IP Address</th>
                  <th className="px-6 py-3.5">Keterangan / Entitas</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
