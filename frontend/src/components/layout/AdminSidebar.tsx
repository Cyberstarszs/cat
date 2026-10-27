import React from 'react';
import { NavLink } from 'react-router-dom';
import logoImg from '../../assets/cat-governance-logo.png';
import {
  LayoutDashboard,
  Users,
  FileText,
  HelpCircle,
  Calendar,
  UserCheck,
  BarChart3,
  ShieldAlert,
  Settings,
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
      title: 'UJIAN & SOAL',
      items: [
        { label: 'Bank Soal', path: '/admin/questions', icon: <HelpCircle className="w-4 h-4" /> },
        { label: 'Paket Ujian', path: '/admin/exams', icon: <FileText className="w-4 h-4" /> },
        { label: 'Jadwal Sesi', path: '/admin/schedules', icon: <Calendar className="w-4 h-4" /> },
        { label: 'Data Peserta', path: '/admin/participants', icon: <UserCheck className="w-4 h-4" /> },
      ],
    },
    {
      title: 'HASIL & PENGAWASAN',
      items: [
        { label: 'Hasil Ujian', path: '/admin/results', icon: <BarChart3 className="w-4 h-4" /> },
        { label: 'Log & Notifikasi', path: '/admin/activity-log', icon: <ShieldAlert className="w-4 h-4" /> },
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
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-[#352148] text-white flex flex-col transition-transform duration-300 ease-in-out shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-[80px] px-6 flex items-center border-b border-[#4d3363]">
          <img
            src={logoImg}
            alt="CAT GOVERNANCE Logo"
            className="h-9 w-auto brightness-0 invert"
          />
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
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        onClose();
                      }
                    }}
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
      </aside>
    </>
  );
};
