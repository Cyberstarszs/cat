import React from 'react';
import { NavLink } from 'react-router-dom';
import logoImg from '../../assets/cat-governance-logo.png';
import {
  LayoutDashboard,
  Users,
  FolderTree,
  FileText,
  HelpCircle,
  Upload,
  Calendar,
  UserCheck,
  BarChart3,
  ShieldAlert,
  Bell,
  Settings,
  X,
  ExternalLink,
} from 'lucide-react';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onClose }) => {
  const menuGroups = [
    {
      title: 'UTAMA',
      items: [
        { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      ],
    },
    {
      title: 'MANAJEMEN UJIAN',
      items: [
        { label: 'Kategori & Subtes', path: '/admin/subtests', icon: <FolderTree className="w-4 h-4" /> },
        { label: 'Daftar Ujian', path: '/admin/exams', icon: <FileText className="w-4 h-4" /> },
        { label: 'Bank Soal', path: '/admin/questions', icon: <HelpCircle className="w-4 h-4" /> },
        { label: 'Impor Soal', path: '/admin/questions/import', icon: <Upload className="w-4 h-4" /> },
        { label: 'Jadwal Ujian', path: '/admin/schedules', icon: <Calendar className="w-4 h-4" /> },
        { label: 'Peserta Ujian', path: '/admin/participants', icon: <UserCheck className="w-4 h-4" /> },
      ],
    },
    {
      title: 'HASIL & PENGAWASAN',
      items: [
        { label: 'Hasil Ujian', path: '/admin/results', icon: <BarChart3 className="w-4 h-4" /> },
        { label: 'Log Aktivitas', path: '/admin/activity-log', icon: <ShieldAlert className="w-4 h-4" /> },
        { label: 'Notifikasi', path: '/admin/notifications', icon: <Bell className="w-4 h-4" /> },
      ],
    },
    {
      title: 'SISTEM',
      items: [
        { label: 'Pengguna', path: '/admin/users', icon: <Users className="w-4 h-4" /> },
        { label: 'Pengaturan', path: '/admin/settings', icon: <Settings className="w-4 h-4" /> },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-[#352148] text-white flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-[80px] px-6 flex items-center justify-between border-b border-[#4d3363]">
          <div className="flex items-center gap-3">
            <img
              src={logoImg}
              alt="CAT GOVERNANCE Logo"
              className="h-9 w-auto brightness-0 invert"
            />
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-300 hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 no-scrollbar">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <div className="px-3 mb-2 text-[10px] font-bold tracking-widest text-[#bda8d6] uppercase">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => onClose()}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-xs font-semibold tracking-wide transition ${
                        isActive
                          ? 'bg-[#583682] text-white shadow-sm font-bold'
                          : 'text-[#cfc3dc] hover:bg-[#4d3363] hover:text-white'
                      }`
                    }
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer / Switch Portal Link */}
        <div className="p-4 border-t border-[#4d3363]">
          <a
            href="/"
            className="flex items-center justify-between px-3 py-2 text-xs text-[#cfc3dc] hover:text-white hover:bg-[#4d3363] rounded-[6px] transition"
          >
            <span>Buka Portal Publik</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </aside>
    </>
  );
};
