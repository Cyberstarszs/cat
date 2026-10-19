import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

export const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (pathname: string): string => {
    if (pathname.includes('/admin/dashboard')) return 'Dashboard';
    if (pathname.includes('/admin/users')) return 'Kelola Pengguna';
    if (pathname.includes('/admin/subtests')) return 'Kategori & Subtes';
    if (pathname.includes('/admin/exams')) return 'Daftar Ujian';
    if (pathname.includes('/admin/questions/import')) return 'Impor Soal';
    if (pathname.includes('/admin/questions')) return 'Bank Soal';
    if (pathname.includes('/admin/schedules')) return 'Jadwal Ujian';
    if (pathname.includes('/admin/participants')) return 'Peserta Ujian';
    if (pathname.includes('/admin/results')) return 'Hasil Ujian';
    if (pathname.includes('/admin/activity-log')) return 'Log Aktivitas';
    if (pathname.includes('/admin/notifications')) return 'Notifikasi';
    if (pathname.includes('/admin/settings')) return 'Pengaturan';
    return 'Admin';
  };

  return (
    <div className="min-h-screen bg-[#faf9fc] text-[#24212b] flex">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <AdminHeader
          title={getPageTitle(location.pathname)}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 p-6 md:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
