import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { alert } from '../../utils/alert';
import { LogOut, ShieldCheck, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminHeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  title: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ onToggleSidebar, sidebarOpen, title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const confirmed = await alert.confirm({
      title: 'Keluar dari Sesi Administrator?',
      text: 'Pastikan seluruh perubahan data telah tersimpan sebelum keluar dari panel manajemen CAT.',
      confirmButtonText: 'Ya, Keluar',
      cancelButtonText: 'Batal',
      icon: 'question',
    });
    if (!confirmed) return;

    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 h-[80px] bg-white border-b border-[#e6e1eb] px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-[#583682] border border-[#e6e1eb] rounded-lg hover:bg-[#eae2f5] hover:border-[#583682] transition cursor-pointer flex items-center justify-center shrink-0"
          title={sidebarOpen ? 'Tutup Sidebar' : 'Buka Sidebar'}
          aria-label={sidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
        >
          {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
        </button>
        <div>
          <h1 className="font-display font-bold text-lg sm:text-xl text-[#24212b] tracking-tight">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 pl-4 border-l border-[#e6e1eb]">
          <div className="w-8 h-8 rounded-full bg-[#583682] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="hidden sm:block text-left text-xs">
            <div className="font-bold text-[#24212b]">{user?.email}</div>
            <div className="text-[10px] text-[#583682] font-semibold uppercase tracking-wider">
              Admin FIA
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-[#595562] hover:text-[#b63b48] hover:bg-[#fbeeed] rounded-[6px] transition ml-2"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
