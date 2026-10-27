import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/cat-governance-logo.png';
import { FigmaIcon } from '../common/FigmaIcon';

export interface FooterProps {
  minimal?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ minimal = false }) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const goSection = (id: string) => {
    if (window.location.pathname !== '/') {
      navigate('/');
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Minimal Footer untuk Halaman Portal Mahasiswa / Siswa
  if (minimal) {
    return (
      <footer className="mt-auto py-3.5 px-6 border-t border-[#e6e1eb] bg-white text-xs text-[#595562]">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[#583682]">CAT GOVERNANCE</span>
            <span className="text-[#dcd6e5]">•</span>
            <span>Fakultas Ilmu Administrasi Universitas Madura</span>
          </div>
          <div className="text-[11px] text-[#8e859b]">
            <span>© 2026 Hak Cipta Dilindungi</span>
          </div>
        </div>
      </footer>
    );
  }

  // Full Footer untuk Halaman Publik & Landing
  return (
    <footer id="bantuan" className="site-footer">
      <div className="site-footer__main">
        {/* Kolom 1: Profil & Identitas Institusi */}
        <div className="site-footer__brand">
          <div className="brand">
            <img
              className="brand__logo"
              src={logoImg}
              alt="CAT Governance FIA Universitas Madura"
            />
          </div>
          <p>
            Sistem ujian kompetensi berbasis komputer Fakultas Ilmu Administrasi Universitas Madura
            untuk pelaksanaan asesmen yang tertib, adil, dan transparan.
          </p>
          <div className="site-footer__address">
            <span>
              <FigmaIcon name="book" size={13} />
              Fakultas Ilmu Administrasi (FIA), Universitas Madura
            </span>
            <span>
              <FigmaIcon name="target" size={13} />
              Jl. Raya Panglegur No. 3.5, Pamekasan, Madura, Jawa Timur
            </span>
          </div>
        </div>

        {/* Kolom 2: Navigasi Ujian */}
        <div className="site-footer__col">
          <h4>Menu Utama</h4>
          <div className="site-footer__links">
            <button type="button" onClick={() => navigate('/')}>
              Beranda
            </button>
            <button type="button" onClick={() => navigate('/explore')}>
              Jadwal Sesi Ujian
            </button>
            <button type="button" onClick={() => goSection('tentang')}>
              Tentang Platform
            </button>
            <button type="button" onClick={() => goSection('cara-kerja')}>
              Tahapan Asesmen
            </button>
          </div>
        </div>

        {/* Kolom 3: Layanan & Akses Akun */}
        <div className="site-footer__col">
          <h4>Akses & Layanan</h4>
          <div className="site-footer__links">
            <button
              type="button"
              onClick={() => {
                if (isAuthenticated) {
                  navigate(user?.role === 'admin' ? '/admin/dashboard' : '/dashboard');
                } else {
                  navigate('/login');
                }
              }}
            >
              Ruang Ujian Peserta
            </button>
            <button
              type="button"
              onClick={() => {
                if (isAuthenticated && user?.role === 'admin') {
                  navigate('/admin/dashboard');
                } else {
                  navigate('/login');
                }
              }}
            >
              Panel Administrator
            </button>
            <button type="button" onClick={() => goSection('bantuan')}>
              Pusat Informasi & FAQ
            </button>
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#8f8993', lineHeight: '1.5' }}>
            <span>Layanan Laboratorium CAT:</span>
            <br />
            <strong style={{ color: '#dacbe8' }}>Senin – Jumat: 08.00 – 16.00 WIB</strong>
          </div>
        </div>
      </div>

      {/* Baris Bawah: Hak Cipta */}
      <div className="site-footer__bottom">
        <small>
          © 2026 CAT GOVERNANCE · Fakultas Ilmu Administrasi, Universitas Madura. Seluruh hak cipta dilindungi undang-undang.
        </small>
      </div>
    </footer>
  );
};
