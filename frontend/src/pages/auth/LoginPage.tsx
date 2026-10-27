import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import logoImg from '../../assets/cat-governance-logo.png';
import { User, Lock, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          : 'Berhasil masuk ke Ruang Peserta Ujian.',
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
      setError(err.message || 'NIM/Email atau kata sandi belum sesuai. Silakan periksa kembali data Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-portal">
      <div className="auth-grid" aria-hidden="true" />

      {/* Tombol Kembali ke Beranda yang Halus & Elegan */}
      <button
        type="button"
        className="auth-back"
        onClick={() => navigate('/')}
        aria-label="Kembali ke beranda"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Beranda</span>
      </button>

      {/* Kartu Login Minimalis & Elegan */}
      <section className="auth-card">
        {/* Brand & Heading Terpadu */}
        <div className="auth-card-head">
          <img
            className="auth-card-logo"
            src={logoImg}
            alt="CAT Governance FIA Universitas Madura"
          />
          <h1 className="auth-card-title">Masuk ke Ruang Ujian</h1>
          <p className="auth-card-subtitle">
            Fakultas Ilmu Administrasi · Universitas Madura
          </p>
        </div>

        {error && (
          <div className="login-error-alert" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form className="login-card-form" onSubmit={handleSubmit}>
          {/* Input NIM / Email */}
          <div className="login-field-group">
            <label htmlFor="auth-identifier" className="login-label">
              NIM atau Alamat Email
            </label>
            <div className="login-input-wrapper">
              <User className="login-input-icon" />
              <input
                id="auth-identifier"
                name="identifier"
                required
                type="text"
                autoComplete="username"
                spellCheck={false}
                placeholder="NIM atau email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoFocus
                className="login-input"
              />
            </div>
          </div>

          {/* Input Password */}
          <div className="login-field-group">
            <label htmlFor="auth-password" className="login-label">
              Kata Sandi
            </label>
            <div className="login-input-wrapper">
              <Lock className="login-input-icon" />
              <input
                id="auth-password"
                name="password"
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                minLength={1}
                placeholder="Kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input login-input--password"
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Tombol Masuk */}
          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <span>Masuk ke Akun</span>
            )}
          </button>
        </form>
      </section>

      <div className="auth-caption">CAT • ASSESSMENT • GOVERNANCE</div>
      <small className="auth-copyright">
        © 2026 CAT GOVERNANCE · Fakultas Ilmu Administrasi, Universitas Madura
      </small>
    </main>
  );
};
