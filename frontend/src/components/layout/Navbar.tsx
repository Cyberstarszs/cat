import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStudentPhoto } from '../../services/unira';
import logoImg from '../../assets/cat-governance-logo.png';
import { FigmaIcon } from '../common/FigmaIcon';

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

  // Close mobile menu on route change
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
    navigate('/');
  };

  const isHomeActive = location.pathname === '/' && !location.hash;
  const isVerifyActive = location.pathname.startsWith('/verify');

  const userInitial = user?.role === 'admin'
    ? 'A'
    : (profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U');

  const displayName = user?.role === 'admin'
    ? 'Administrator'
    : (profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Peserta');

  return (
    <header className={`site-header ${isScrolled ? 'site-header--scrolled' : ''}`}>
      <div className="site-header__inner">
        {/* Brand & Faculty Institutional Identification */}
        <Link
          to="/"
          className="brand-link"
          onClick={() => setMenuOpen(false)}
          aria-label="Ke beranda CAT Governance FIA Universitas Madura"
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
                <span className="brand__tag">Sistem Ujian CAT Mandiri</span>
              </div>
            </>
          )}
        </Link>

        {/* Center Navigation Links */}
        {!minimal && (
          <nav
            className={`nav-links ${menuOpen ? 'open' : ''}`}
            aria-label="Navigasi utama portal"
          >
            <button
              type="button"
              className={`nav-link-btn ${isHomeActive ? 'active' : ''}`}
              onClick={() => handleNav('/')}
            >
              <FigmaIcon name="home" size={15} />
              <span>Beranda</span>
            </button>

            <button
              type="button"
              className="nav-link-btn"
              onClick={() => goSection('tentang')}
            >
              <FigmaIcon name="book" size={15} />
              <span>Tentang Kami</span>
            </button>

            <button
              type="button"
              className={`nav-link-btn ${isVerifyActive ? 'active' : ''}`}
              onClick={() => handleNav('/verify')}
            >
              <FigmaIcon name="shield" size={15} />
              <span>Verifikasi Sertifikat</span>
            </button>

            <button
              type="button"
              className="nav-link-btn"
              onClick={() => goSection('bantuan')}
            >
              <FigmaIcon name="help" size={15} />
              <span>Bantuan</span>
            </button>

            <div className="nav-mobile-auth">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => handleNav(user?.role === 'admin' ? '/admin/dashboard' : '/dashboard')}
                >
                  {user?.role === 'admin' ? 'Buka Portal Admin' : 'Buka Dashboard Peserta'}
                </button>
              ) : (
                <button type="button" onClick={() => handleNav('/login')}>
                  Masuk Akun CAT
                </button>
              )}
            </div>
          </nav>
        )}

        {/* Right Actions: Authenticated Pill / CTA Login + Mobile Toggle */}
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
          ) : (
            <div className="header-user-wrapper">
              <button
                type="button"
                className="header-profile-btn"
                onClick={() => handleNav(user?.role === 'admin' ? '/admin/dashboard' : '/dashboard')}
                title="Buka Dashboard Akun"
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
                    {user?.role === 'admin' ? 'ADMIN' : user?.role === 'umum' ? 'UMUM' : 'MHS'}
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
