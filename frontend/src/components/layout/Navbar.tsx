import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStudentPhoto } from '../../services/unira';
import logoImg from '../../assets/cat-governance-logo.png';
import { FigmaIcon, IconName } from '../common/FigmaIcon';

export interface NavbarProps {
  minimal?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ minimal = false }) => {
  const { user, profile, isAuthenticated, logout } = useAuth();
  const { photoUrl } = useStudentPhoto(profile?.identifier, user?.role, profile?.institution);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Tutup menu mobile ketika rute berganti
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  const goSection = (id: string) => {
    setMenuOpen(false);
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNav = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  // URL Logo dinamis berdasarkan role akun
  const logoHref = !isAuthenticated
    ? '/'
    : user?.role === 'admin'
    ? '/admin/dashboard'
    : '/dashboard';

  const userInitial = user?.role === 'admin'
    ? 'A'
    : (profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U');

  const displayName = user?.role === 'admin'
    ? 'Administrator'
    : (profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Peserta');

  // Definisi tautan navigasi tengah berdasarkan peran pengguna
  interface NavItem {
    label: string;
    path?: string;
    sectionId?: string;
    icon: IconName;
    isActive: boolean;
  }

  let navItems: NavItem[] = [];

  if (!isAuthenticated) {
    // 1. TAMU / BELUM LOGIN
    navItems = [
      {
        label: 'Beranda',
        path: '/',
        icon: 'home',
        isActive: location.pathname === '/' && !location.hash,
      },
      {
        label: 'Jadwal Ujian',
        path: '/explore',
        icon: 'calendar',
        isActive: location.pathname.startsWith('/explore') || location.pathname.startsWith('/assessment-lg'),
      },
      {
        label: 'Verifikasi Sertifikat',
        path: '/verify',
        icon: 'shield',
        isActive: location.pathname.startsWith('/verify'),
      },
      {
        label: 'Tentang Kami',
        sectionId: 'tentang',
        icon: 'book',
        isActive: location.pathname === '/' && location.hash === '#tentang',
      },
      {
        label: 'Bantuan',
        sectionId: 'bantuan',
        icon: 'help',
        isActive: location.pathname === '/' && location.hash === '#bantuan',
      },
    ];
  } else if (user?.role === 'admin') {
    // 2. ADMINISTRATOR
    navItems = [
      {
        label: 'Portal Admin',
        path: '/admin/dashboard',
        icon: 'monitor',
        isActive: location.pathname === '/admin/dashboard',
      },
      {
        label: 'Bank & Impor Soal',
        path: '/admin/questions',
        icon: 'book',
        isActive: location.pathname.startsWith('/admin/questions'),
      },
      {
        label: 'Kategori & Ujian',
        path: '/admin/exams',
        icon: 'file',
        isActive: location.pathname.startsWith('/admin/exams') || location.pathname.startsWith('/admin/subtests'),
      },
      {
        label: 'Jadwal Sesi',
        path: '/admin/schedules',
        icon: 'calendar',
        isActive: location.pathname.startsWith('/admin/schedules'),
      },
      {
        label: 'Hasil & Nilai',
        path: '/admin/results',
        icon: 'chart',
        isActive: location.pathname.startsWith('/admin/results'),
      },
      {
        label: 'Beranda Publik',
        path: '/',
        icon: 'home',
        isActive: location.pathname === '/',
      },
    ];
  } else {
    // 3. PESERTA UJIAN (Mahasiswa / Umum)
    navItems = [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: 'home',
        isActive: location.pathname === '/dashboard',
      },
      {
        label: 'Jadwal Ujian',
        path: '/explore',
        icon: 'calendar',
        isActive:
          location.pathname.startsWith('/explore') ||
          location.pathname.startsWith('/assessment-lg'),
      },
      {
        label: 'Riwayat Ujian',
        path: '/history',
        icon: 'history',
        isActive: location.pathname.startsWith('/history') || location.pathname.startsWith('/results'),
      },
      {
        label: 'Sertifikat',
        path: '/certificates',
        icon: 'award',
        isActive: location.pathname.startsWith('/certificates') || location.pathname === '/certificate',
      },
      {
        label: 'Verifikasi',
        path: '/verify',
        icon: 'shield',
        isActive: location.pathname.startsWith('/verify'),
      },
    ];
  }

  return (
    <header className={`site-header ${isScrolled ? 'site-header--scrolled' : ''}`}>
      <div className="site-header__inner">
        {/* Brand & Identitas Fakultas FIA Universitas Madura */}
        <Link
          to={logoHref}
          className="brand-link"
          onClick={() => setMenuOpen(false)}
          aria-label={
            !isAuthenticated
              ? 'Ke beranda CAT Governance FIA Universitas Madura'
              : user?.role === 'admin'
              ? 'Ke Dashboard Portal Admin FIA'
              : 'Ke Dashboard Peserta Ujian FIA'
          }
        >
          <div className={`brand ${minimal ? 'brand--compact' : ''}`}>
            <img
              className="brand__logo"
              src={logoImg}
              alt="CAT Governance FIA Universitas Madura"
            />
          </div>
          {!minimal && (
            <>
              <div className="brand__divider" aria-hidden="true" />
              <div className="brand__meta">
                <span className="brand__faculty">FIA UNIVERSITAS MADURA</span>
                <span className="brand__tag">
                  {user?.role === 'admin'
                    ? 'Portal Administrator Sistem'
                    : isAuthenticated
                    ? 'Portal Peserta Ujian Mandiri'
                    : 'Sistem Ujian CAT Mandiri'}
                </span>
              </div>
            </>
          )}
        </Link>

        {/* Navigasi Utama Bagian Tengah (Adaptif Sesuai Role & Auth State) */}
        {!minimal && (
          <nav
            className={`nav-links ${menuOpen ? 'open' : ''}`}
            aria-label="Navigasi utama portal"
          >
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`nav-link-btn ${item.isActive ? 'active' : ''}`}
                onClick={() => {
                  if (item.sectionId) {
                    goSection(item.sectionId);
                  } else if (item.path) {
                    handleNav(item.path);
                  }
                }}
              >
                <FigmaIcon name={item.icon} size={15} />
                <span>{item.label}</span>
              </button>
            ))}

            {/* Menu Aksi Tambahan untuk Mobile Drawer */}
            <div className="nav-mobile-auth">
              {!isAuthenticated ? (
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded bg-[#583682] text-white font-bold text-xs text-center"
                  onClick={() => handleNav('/login')}
                >
                  Masuk Akun CAT
                </button>
              ) : user?.role === 'admin' ? (
                <div className="flex flex-col gap-2 w-full pt-2 border-t border-[#e6e1eb]">
                  <button
                    type="button"
                    className="w-full py-2.5 px-4 rounded bg-[#583682] text-white font-bold text-xs text-center"
                    onClick={() => handleNav('/admin/dashboard')}
                  >
                    Buka Dashboard Admin
                  </button>
                  <button
                    type="button"
                    className="w-full py-2 px-4 rounded border border-[#b63b48] text-[#b63b48] font-bold text-xs text-center"
                    onClick={handleLogout}
                  >
                    Keluar Sesi Admin
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 w-full pt-2 border-t border-[#e6e1eb]">
                  <button
                    type="button"
                    className="w-full py-2 px-4 rounded border border-[#e6e1eb] text-[#24212b] font-semibold text-xs text-left flex items-center gap-2"
                    onClick={() => handleNav('/profile')}
                  >
                    <FigmaIcon name="user" size={14} />
                    <span>Profil Akun</span>
                  </button>
                  <button
                    type="button"
                    className="w-full py-2 px-4 rounded border border-[#b63b48] text-[#b63b48] font-bold text-xs text-center"
                    onClick={handleLogout}
                  >
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </nav>
        )}

        {/* Sisi Kanan: Aksi Autentikasi / Tombol Masuk / Profil Pill & Logout */}
        <div className="header-actions">
          {!isAuthenticated ? (
            <button
              type="button"
              className="header-cta-btn"
              onClick={() => handleNav('/login')}
              aria-label="Masuk ke Akun CAT"
            >
              <FigmaIcon name="shield" size={14} />
              <span>Masuk Akun</span>
            </button>
          ) : user?.role === 'admin' ? (
            <div className="header-user-wrapper">
              <button
                type="button"
                className="header-cta-btn hidden sm:inline-flex"
                onClick={() => handleNav('/admin/dashboard')}
                title="Buka Portal Administrator"
              >
                <FigmaIcon name="shield" size={14} />
                <span>Portal Admin</span>
              </button>

              <button
                type="button"
                className="header-profile-btn"
                onClick={() => handleNav('/admin/dashboard')}
                title="Kelola Portal Administrator"
              >
                <div className="header-profile-avatar" aria-hidden="true">
                  {userInitial}
                </div>
                <div className="header-profile-info">
                  <span className="header-profile-name">{displayName}</span>
                  <span className="header-profile-role">ADMIN</span>
                </div>
              </button>

              <button
                type="button"
                className="header-logout-btn"
                onClick={handleLogout}
                title="Keluar Sesi Akun"
                aria-label="Keluar Sesi Akun"
              >
                <FigmaIcon name="logout" size={14} />
              </button>
            </div>
          ) : (
            <div className="header-user-wrapper">
              <button
                type="button"
                className="header-profile-btn"
                onClick={() => handleNav('/profile')}
                title="Buka Pengaturan & Profil Akun"
              >
                <div className="header-profile-avatar" aria-hidden="true">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="Foto Profil"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    userInitial
                  )}
                </div>
                <div className="header-profile-info">
                  <span className="header-profile-name">{displayName}</span>
                  <span className="header-profile-role">
                    {user?.role === 'umum' ? 'UMUM' : 'MHS'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                className="header-logout-btn"
                onClick={handleLogout}
                title="Keluar Sesi Akun"
                aria-label="Keluar Sesi Akun"
              >
                <FigmaIcon name="logout" size={14} />
              </button>
            </div>
          )}

          {!minimal && (
            <button
              type="button"
              className={`menu-toggle ${menuOpen ? 'active' : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
