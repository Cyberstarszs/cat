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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Jika sudah terautentikasi, alihkan langsung berdasarkan peran
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
        res.user.role === 'admin'
          ? 'Login Administrator berhasil.'
          : 'Berhasil masuk ke Portal Peserta.',
        'success'
      );

      // Pertahankan rute tujuan (redirect) jika ada
      const searchRedirect = new URLSearchParams(location.search).get('redirect');
      const fromLoc = (location.state as any)?.from;
      const targetUrl = fromLoc
        ? `${fromLoc.pathname || ''}${fromLoc.search || ''}${fromLoc.hash || ''}`
        : searchRedirect || null;

      if (res.user.role === 'admin') {
        if (targetUrl && targetUrl.startsWith('/admin')) {
          navigate(targetUrl, { replace: true });
        } else {
          navigate('/admin/dashboard', { replace: true });
        }
      } else {
        if (targetUrl && !targetUrl.startsWith('/admin') && targetUrl !== '/login') {
          navigate(targetUrl, { replace: true });
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
        </div>

        <div className="auth-heading">
          <div className="eyebrow">PORTAL CAT FIA / 2026</div>
          <h1>Masuk ke Sistem CAT</h1>
          <p>
            Masukkan alamat email atau NIM dan kata sandi akun Anda.
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
            <span>Alamat email atau NIM</span>
            <input
              id="auth-identifier"
              name="identifier"
              required
              type="text"
              autoComplete="username"
              spellCheck={false}
              placeholder="nama@email.com atau NIM"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
            />
          </label>

          <label className="auth-password-field">
            <span>Kata sandi</span>
            <input
              id="auth-password"
              name="password"
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              minLength={1}
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              {showPassword ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </label>

          <label className="check">
            <input
              id="auth-remember"
              name="rememberMe"
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
            {loading ? 'MEMPROSES…' : 'MASUK KE SISTEM'}
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
      </section>

      <div className="auth-caption">CAT • ASSESSMENT • GOVERNANCE</div>
      <small className="auth-copyright">
        © CAT GOVERNANCE — Fakultas Ilmu Administrasi, Universitas Madura
      </small>
    </main>
  );
};
