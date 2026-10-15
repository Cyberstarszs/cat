import React, { useEffect, useState } from 'react';
import { notificationService } from '../../services';
import { NotificationItem } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorAlert } from '../../components/ui/EmptyState';
import { Bell, CheckCircle2, Clock } from 'lucide-react';

export const AdminNotificationsPage: React.FC = () => {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat notifikasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      showToast('Notifikasi ditandai telah dibaca.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui notifikasi.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">PUSAT PEMBERITAHUAN</div>
          <h1 className="font-display font-bold text-2xl text-[#24212b]">
            Notifikasi & Peringatan Sistem
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Informasi penting terkait permohonan sanggah, sesi ujian kedaluwarsa, dan aktivitas akun.
          </p>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchNotifs} />}

      <Card hasShadow className="overflow-hidden p-0">
        {loading ? (
          <div className="p-6">
            <CardSkeleton />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Tidak Ada Notifikasi"
              description="Seluruh pemberitahuan sistem telah dibaca atau belum ada notifikasi baru."
              icon={<Bell className="w-8 h-8 text-[#583682]" />}
            />
          </div>
        ) : (
          <div className="divide-y divide-[#e6e1eb]">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-6 flex items-start justify-between gap-4 transition ${
                  notif.is_read ? 'bg-white' : 'bg-[#faf9fc]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={notif.type === 'warning' ? 'warning' : 'purple'}>
                      {notif.type.toUpperCase()}
                    </Badge>
                    <span className="font-bold text-sm text-[#24212b]">{notif.title}</span>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#583682]" />
                    )}
                  </div>
                  <p className="text-xs text-[#595562] leading-relaxed max-w-2xl">{notif.message}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 pt-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(notif.created_at).toLocaleString('id-ID')}</span>
                  </div>
                </div>

                {!notif.is_read && (
                  <Button
                    variant="ghost"
                    onClick={() => handleMarkAsRead(notif.id)}
                    className="text-xs min-h-[32px] px-2.5 shrink-0"
                  >
                    Tandai Dibaca
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
