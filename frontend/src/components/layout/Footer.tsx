import React from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from '../../assets/cat-governance-logo.png';
import { FigmaIcon } from '../common/FigmaIcon';

export const Footer: React.FC = () => {
  const navigate = useNavigate();

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
            Platform Ujian Kompetensi Digital berbasis Computer Assisted Test (CAT)
            Fakultas Ilmu Administrasi – Universitas Madura. Terstandar, objektif, dan transparan.
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
          <h4>Navigasi Portal</h4>
          <div className="site-footer__links">
            <button type="button" onClick={() => navigate('/')}>
              Beranda
            </button>
            <button type="button" onClick={() => navigate('/explore')}>
              Jadwal & Informasi Ujian
            </button>
            <button type="button" onClick={() => goSection('tentang')}>
              Tentang Platform
            </button>
            <button type="button" onClick={() => goSection('cara-kerja')}>
              Tahapan Asesmen
            </button>
            <button type="button" onClick={() => navigate('/verify')}>
              Verifikasi Sertifikat
            </button>
          </div>
        </div>

        {/* Kolom 3: Layanan & Akses Akun */}
        <div className="site-footer__col">
          <h4>Akses & Layanan</h4>
          <div className="site-footer__links">
            <button type="button" onClick={() => navigate('/login')}>
              Ruang Ujian Peserta
            </button>
            <button type="button" onClick={() => navigate('/login')}>
              Portal Administrator
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

      {/* Baris Bawah: Hak Cipta & Status Sistem */}
      <div className="site-footer__bottom">
        <small>
          © 2026 CAT GOVERNANCE — Fakultas Ilmu Administrasi, Universitas Madura. Seluruh hak cipta dilindungi undang-undang.
        </small>
        <div className="system-live-dark">
          <i />
          <span>Sistem Ujian CAT Aktif & Terverifikasi</span>
        </div>
      </div>
    </footer>
  );
};
