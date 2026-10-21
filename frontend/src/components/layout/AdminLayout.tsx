import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

export const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (pathname: string): string => {
    if (pathname.includes('/admin/dashboard')) return 'Dashboard';
    if (pathname.includes('/admin/users')) return 'Pengguna';
    if (pathname.includes('/admin/subtests') || pathname.includes('/admin/categories')) return 'Subtes Soal';
    if (pathname.includes('/admin/exams')) return 'Paket Ujian';
    if (pathname.includes('/admin/questions')) return 'Bank Soal';
    if (pathname.includes('/admin/schedules')) return 'Jadwal Sesi';
    if (pathname.includes('/admin/participants')) return 'Data Peserta';
    if (pathname.includes('/admin/results')) return 'Hasil Ujian';
    if (pathname.includes('/admin/activity-log') || pathname.includes('/admin/notifications')) return 'Log & Notifikasi';
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
        <footer className="mt-auto py-3 px-6 md:px-8 border-t border-[#e6e1eb] bg-white text-[11px] text-[#8e859b] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#583682]">CAT GOVERNANCE</span>
            <span className="text-[#dcd6e5]">·</span>
            <span>Panel Administrasi FIA Universitas Madura</span>
          </div>
          <div>
            <span>Versi 2.4</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
