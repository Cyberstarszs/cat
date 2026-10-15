import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { examService, questionService, sessionService, userService, auditService } from '../../services';
import { AuditLog } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CardSkeleton } from '../../components/ui/Skeleton';
import {
  Users,
  FileText,
  HelpCircle,
  Calendar,
  ShieldAlert,
  Plus,
  Upload,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState({
    studentsCount: 0,
    examsCount: 0,
    questionsCount: 0,
    sessionsCount: 0,
  });
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const [students, exams, questions, sessions, logs] = await Promise.all([
          userService.getStudents().catch(() => []),
          examService.getExams().catch(() => []),
          questionService.getQuestions().catch(() => []),
          sessionService.getSessions().catch(() => []),
          auditService.getAuditLogs({ limit: 6 }).catch(() => []),
        ]);

        setStats({
          studentsCount: students.length,
          examsCount: exams.length,
          questionsCount: questions.length,
          sessionsCount: sessions.length,
        });
        setRecentLogs(logs);
      } catch (err) {
        console.error('Failed to load admin stats', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e6e1eb]">
        <div>
          <div className="eyebrow mb-1">PUSAT KONTROL ADMINISTRATOR</div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-[#24212b]">
            Ikhtisar Sistem Uji Kompetensi FIA
          </h1>
          <p className="text-xs text-[#595562] mt-0.5">
            Pantau status pendaftaran peserta, ketersediaan butir soal, sesi ujian aktif, dan log integritas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/schedules">
            <Button variant="primary" className="text-xs" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Buka Sesi Ujian Baru
            </Button>
          </Link>
          <Link to="/admin/questions/import">
            <Button variant="secondary" className="text-xs" leftIcon={<Upload className="w-3.5 h-3.5" />}>
              Impor Soal CSV
            </Button>
          </Link>
        </div>
      </div>

      {/* Top 4 Stats Counters */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card hasShadow className="flex items-center gap-4 hover:border-[#583682] transition">
            <div className="w-12 h-12 rounded-full bg-[#eae2f5] text-[#583682] flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="font-display font-extrabold text-2xl text-[#24212b]">
                {stats.studentsCount}
              </div>
              <div className="text-xs text-[#595562] font-semibold">Peserta Terdaftar</div>
            </div>
          </Card>

          <Card hasShadow className="flex items-center gap-4 hover:border-[#583682] transition">
            <div className="w-12 h-12 rounded-full bg-[#f6f2fa] text-[#754ead] flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="font-display font-extrabold text-2xl text-[#24212b]">
                {stats.examsCount}
              </div>
              <div className="text-xs text-[#595562] font-semibold">Ujian Kompetensi</div>
            </div>
          </Card>

          <Card hasShadow className="flex items-center gap-4 hover:border-[#583682] transition">
            <div className="w-12 h-12 rounded-full bg-[#eaf4ef] text-[#287a58] flex items-center justify-center shrink-0">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="font-display font-extrabold text-2xl text-[#24212b]">
                {stats.questionsCount}
              </div>
              <div className="text-xs text-[#595562] font-semibold">Butir Soal Aktif</div>
            </div>
          </Card>

          <Card hasShadow className="flex items-center gap-4 hover:border-[#583682] transition">
            <div className="w-12 h-12 rounded-full bg-[#fdf6ec] text-[#a96817] flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="font-display font-extrabold text-2xl text-[#24212b]">
                {stats.sessionsCount}
              </div>
              <div className="text-xs text-[#595562] font-semibold">Total Sesi Ujian</div>
            </div>
          </Card>
        </div>
      )}

      {/* Main Grid: Fast Actions & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Fast Action Cards */}
        <div className="lg:col-span-1 space-y-4">
          <Card hasShadow>
            <h3 className="font-display font-bold text-base text-[#24212b] mb-4 pb-2 border-b border-[#e6e1eb]">
              Aksi Cepat Administrator
            </h3>
            <div className="space-y-2">
              <Link to="/admin/questions" className="block">
                <Button variant="ghost" fullWidth className="justify-start text-xs text-left" leftIcon={<HelpCircle className="w-4 h-4 text-[#583682]" />}>
                  Kelola Bank Soal & Versi
                </Button>
              </Link>
              <Link to="/admin/schedules" className="block">
                <Button variant="ghost" fullWidth className="justify-start text-xs text-left" leftIcon={<Calendar className="w-4 h-4 text-[#583682]" />}>
                  Jadwalkan Sesi Ujian Baru
                </Button>
              </Link>
              <Link to="/admin/participants" className="block">
                <Button variant="ghost" fullWidth className="justify-start text-xs text-left" leftIcon={<Users className="w-4 h-4 text-[#583682]" />}>
                  Daftarkan Peserta Ujian
                </Button>
              </Link>
              <Link to="/admin/results" className="block">
                <Button variant="ghost" fullWidth className="justify-start text-xs text-left" leftIcon={<FileText className="w-4 h-4 text-[#583682]" />}>
                  Publikasi Hasil & Rekap Nilai
                </Button>
              </Link>
              <Link to="/admin/subtests" className="block">
                <Button variant="ghost" fullWidth className="justify-start text-xs text-left" leftIcon={<Plus className="w-4 h-4 text-[#583682]" />}>
                  Atur Subtes & Kategori Soal
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* Recent Audit Logs */}
        <div className="lg:col-span-2">
          <Card hasShadow>
            <div className="flex items-center justify-between pb-3 border-b border-[#e6e1eb] mb-4">
              <h3 className="font-display font-bold text-base text-[#24212b] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#583682]" />
                Aktivitas & Log Audit Keamanan Terbaru
              </h3>
              <Link to="/admin/activity-log" className="text-xs text-[#583682] hover:underline font-semibold">
                Lihat Semua
              </Link>
            </div>

            {recentLogs.length === 0 ? (
              <p className="text-xs text-[#595562] py-8 text-center">
                Belum ada aktivitas audit yang terekam.
              </p>
            ) : (
              <div className="divide-y divide-[#e6e1eb]">
                {recentLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                    <div>
                      <div className="font-bold text-[#24212b] flex items-center gap-2">
                        <span className="font-mono text-[#583682] bg-[#eae2f5] px-1.5 py-0.5 rounded text-[10px]">
                          {log.action}
                        </span>
                        <span>{log.reason || `Entitas: ${log.entity_type}`}</span>
                      </div>
                      <div className="text-[#595562] text-[11px] mt-0.5">
                        Aktor: {log.actor_email || log.actor_role} {log.ip_address ? `• IP: ${log.ip_address}` : ''}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
