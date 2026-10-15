import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Menu, LogOut, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminHeaderProps {
  onToggleSidebar: () => void;
  title: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ onToggleSidebar, title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 h-[80px] bg-white border-b border-[#e6e1eb] px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-[#583682] border border-[#e6e1eb] rounded lg:hidden hover:bg-[#faf9fc]"
          aria-label="Toggle sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display font-bold text-xl text-[#24212b] tracking-tight">{title}</h1>
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
