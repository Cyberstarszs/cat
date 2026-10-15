import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import logoImg from '../../assets/cat-governance-logo.png';
import { FigmaIcon } from '../../components/common/FigmaIcon';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect automatically based on role
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(identifier.trim(), password);
      showToast(
        isAdminMode ? 'Login Administrator berhasil.' : 'Berhasil masuk ke Portal Peserta.',
        'success'
      );

      const fromPath = (location.state as any)?.from?.pathname;

      if (res.user.role === 'admin') {
        if (fromPath && fromPath.startsWith('/admin')) {
          navigate(fromPath, { replace: true });
        } else {
          navigate('/admin/dashboard', { replace: true });
        }
      } else {
        if (fromPath && !fromPath.startsWith('/admin') && fromPath !== '/login') {
          navigate(fromPath, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (err: any) {
      setError(err.message || 'NIM/Email atau kata sandi tidak sesuai.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-portal">
      <div className="auth-grid" aria-hidden="true" />
      <button
        type="button"
        className="auth-back"
        onClick={() => navigate('/')}
        aria-label="Kembali ke beranda"
      >
        <span aria-hidden="true">←</span> Kembali ke beranda
      </button>

      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand">
            <img
              className="brand__logo"
              src={logoImg}
              alt="CAT Governance FIA Universitas Madura"
            />
          </div>
          <span className="system-live">
            <i /> SISTEM AKTIF
          </span>
        </div>

        <div className="auth-heading">
          <div className="eyebrow">
            {isAdminMode ? 'PORTAL ADMINISTRATOR / CAT 2026' : 'PORTAL PESERTA / CAT 2026'}
          </div>
          <h1>{isAdminMode ? 'Masuk Administrator' : 'Portal Ujian Kompetensi'}</h1>
          <p>
            {isAdminMode
              ? 'Kelola user, ujian, bank soal, jadwal, dan hasil asesmen.'
              : 'Akses ujian kompetensi dan hasil asesmen resmi.'}
          </p>
        </div>

        {error && (
          <div
            className="p-2.5 mb-3 bg-[#f8e9eb] border-l-4 border-[#b63b48] text-xs text-[#b63b48] font-medium leading-relaxed"
            role="alert"
          >
            {error}
          </div>
        )}

        <form className="auth-fields" onSubmit={handleSubmit}>
          <label>
            <span>{isAdminMode ? 'Alamat email' : 'Alamat email atau NIM'}</span>
            <input
              required
              type={isAdminMode ? 'email' : 'text'}
              placeholder={isAdminMode ? 'admin@email.com' : 'nama@email.com atau NIM'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
            />
          </label>

          <label className="auth-password-field">
            <span>Kata sandi</span>
            <input
              required
              type={showPassword ? 'text' : 'password'}
              minLength={1}
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Ingat perangkat ini</span>
          </label>

          <button
            type="submit"
            className={`button full ${loading ? 'is-loading' : ''}`}
            disabled={loading}
          >
            <FigmaIcon name="shield" />
            {loading
              ? 'MEMPROSES...'
              : isAdminMode
              ? 'MASUK SEBAGAI ADMIN'
              : 'MASUK KE PORTAL'}
          </button>
        </form>

        <button
          type="button"
          className="forgot"
          onClick={() =>
            showToast('Tautan pemulihan akan dikirim jika alamat email terdaftar.', 'info')
          }
        >
          Lupa kata sandi?
        </button>

        <div className="admin-role-entry">
          <span>{isAdminMode ? 'Akses peserta ujian' : 'Akses pengelolaan sistem'}</span>
          <button
            type="button"
            onClick={() => {
              setIsAdminMode((prev) => !prev);
              setError(null);
            }}
          >
            <FigmaIcon name="shield" />
            {isAdminMode ? 'Kembali ke Portal Peserta' : 'Role Administrator'}
          </button>
        </div>
      </section>

      <div className="auth-caption">CAT • ASSESSMENT • GOVERNANCE</div>
      <small className="auth-copyright">
        © CAT GOVERNANCE — Fakultas Ilmu Administrasi, Universitas Madura
      </small>
    </main>
  );
};
