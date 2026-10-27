import React, { useState, useEffect, useCallback } from 'react';
import {
  settingsService,
  SmtpSettings,
  EmailOutboxItem,
  EmailOutboxStats,
} from '../../services';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../../context/ToastContext';
import {
  Mail,
  Send,
  Save,
  RefreshCw,
  ShieldCheck,
  Server,
  KeyRound,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Zap,
  FileCheck2,
  ListOrdered,
} from 'lucide-react';

export const EmailSettingsTab: React.FC = () => {
  const { showToast } = useToast();

  // Settings state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SmtpSettings>({
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from_name: 'Fakultas Ilmu Administrasi UNIRA',
    from_email: '',
    reply_to: '',
    rate_limit_per_minute: 20,
    delay_between_emails_ms: 2000,
    is_configured: false,
  });

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Outbox monitor state
  const [outboxItems, setOutboxItems] = useState<EmailOutboxItem[]>([]);
  const [outboxStats, setOutboxStats] = useState<EmailOutboxStats>({
    pending_count: 0,
    sending_count: 0,
    sent_count: 0,
    failed_count: 0,
    total_count: 0,
  });
  const [outboxLoading, setOutboxLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Fetch SMTP Settings
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsService.getSmtpSettings();
      setForm(data);
      if (data.from_email && !testEmail) {
        setTestEmail(data.from_email);
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal memuat pengaturan SMTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Outbox
  const fetchOutbox = useCallback(async () => {
    setOutboxLoading(true);
    try {
      const params: { limit?: number; offset?: number; status?: string } = { limit: 25, offset: 0 };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const res = await settingsService.getEmailOutbox(params);
      setOutboxItems(res.items);
      setOutboxStats(res.stats);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal memuat antrean outbox email', 'error');
    } finally {
      setOutboxLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchOutbox();
  }, [fetchOutbox]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setForm((prev) => ({ ...prev, [name]: Number(value) }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Don't send masked password if unchanged or blank
      const payload = { ...form };
      if (payload.pass === '••••••••' || !payload.pass || !payload.pass.trim()) {
        delete payload.pass;
      }
      const updated = await settingsService.updateSmtpSettings(payload);
      setForm(updated);
      showToast('Konfigurasi SMTP dan anti-spam berhasil disimpan!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal menyimpan konfigurasi SMTP', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      showToast('Masukkan alamat email tujuan uji yang valid', 'warning');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await settingsService.testSmtpConnection({
        test_email: testEmail,
        host: form.host,
        port: form.port,
        user: form.user,
        pass: form.pass === '••••••••' ? undefined : form.pass,
        from_email: form.from_email,
      });
      setTestResult(res);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Koneksi ke SMTP server gagal';
      setTestResult({ success: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleRetryEmail = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await settingsService.retryEmailOutbox(id);
      showToast(res.message || 'Email dijadwalkan ulang untuk dikirim', 'success');
      fetchOutbox();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Gagal menjadwalkan ulang email', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-[#595562] flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-[#583682]" />
        <span>Memuat konfigurasi SMTP & sistem antrean email...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Header Banner & Anti-Spam Architecture Explanation */}
      <Card hasShadow className="border-l-4 border-l-[#583682] bg-gradient-to-r from-[#faf9fc] to-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#583682]" />
              <h3 className="font-display font-bold text-base text-[#24212b]">
                Pengiriman Otomatis Email Sertifikat & SMTP Kampus
              </h3>
            </div>
            <p className="text-xs text-[#595562] max-w-2xl">
              Ketika mahasiswa berhasil menyelesaikan ujian (lulus), sistem secara otomatis menerbitkan sertifikat,
              melampirkan berkas PDF asli, dan mengirimkannya ke email mahasiswa melalui server email kampus UNIRA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Badge variant={form.enabled ? 'success' : 'neutral'}>
              {form.enabled ? 'STATUS: AKTIF OTOMATIS' : 'STATUS: DINONAKTIFKAN'}
            </Badge>
            <Badge variant={form.is_configured ? 'purple' : 'warning'}>
              {form.is_configured ? 'SMTP TERKONFIGURASI' : 'SMTP BELUM LENGKAP'}
            </Badge>
          </div>
        </div>

        {/* Protection Pills */}
        <div className="mt-4 pt-3 border-t border-[#e6e1eb] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#24212b]">
            <ShieldCheck className="w-4 h-4 text-[#287a58] shrink-0" />
            <span>
              <strong>Anti-Spam Throttling:</strong> Jeda terkontrol {form.delay_between_emails_ms / 1000} detik
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#24212b]">
            <Zap className="w-4 h-4 text-[#583682] shrink-0" />
            <span>
              <strong>Background Outbox:</strong> Non-blocking, ujian tetap kilat (&lt;20ms)
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#24212b]">
            <FileCheck2 className="w-4 h-4 text-[#287a58] shrink-0" />
            <span>
              <strong>Idempotensi Sertifikat:</strong> Mencegah email ganda / duplikat
            </span>
          </div>
        </div>
      </Card>

      {/* 2. SMTP Server Configuration Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <Card hasShadow className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#e6e1eb]">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#583682]" />
              <h4 className="font-display font-bold text-sm text-[#24212b]">
                Parameter Server SMTP Kampus
              </h4>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#24212b]">
              <input
                type="checkbox"
                name="enabled"
                checked={form.enabled}
                onChange={handleChange}
                className="w-4 h-4 text-[#583682] rounded border-[#cfc2df] focus:ring-[#583682]"
              />
              <span>Aktifkan Pengiriman Email</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Host / Server SMTP Kampus"
                name="host"
                value={form.host}
                onChange={handleChange}
                placeholder="smtp.example.com"
                helperText="Domain server email internal kampus atau relay mail provider."
                required={form.enabled}
              />
            </div>
            <div>
              <Input
                label="Port SMTP"
                name="port"
                type="number"
                value={form.port}
                onChange={handleChange}
                placeholder="587"
                helperText="Umumnya 587 (STARTTLS/TLS) atau 465 (SSL)."
                required={form.enabled}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Username / Akun Email Kampus"
                name="user"
                value={form.user}
                onChange={handleChange}
                placeholder="Username SMTP"
                helperText="Akun otentikasi resmi kampus."
                leftIcon={<Mail className="w-4 h-4" />}
                required={form.enabled}
              />
            </div>
            <div>
              <Input
                label="Kata Sandi / App Password SMTP"
                name="pass"
                type="password"
                value={form.pass}
                onChange={handleChange}
                placeholder="Kata sandi"
                helperText="Kosongkan jika tidak ingin mengubah kata sandi tersimpan."
                leftIcon={<KeyRound className="w-4 h-4" />}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-dashed border-[#e6e1eb]">
            <div>
              <Input
                label="Nama Pengirim Resmi"
                name="from_name"
                value={form.from_name}
                onChange={handleChange}
                placeholder="Nama pengirim"
                helperText="Nama institusi yang tampil di kotak masuk mahasiswa."
              />
            </div>
            <div>
              <Input
                label="Email Pengirim (Sender Address)"
                name="from_email"
                type="email"
                value={form.from_email}
                onChange={handleChange}
                placeholder="Email pengirim"
                helperText="Harus sesuai dengan domain email resmi."
                required={form.enabled}
              />
            </div>
            <div>
              <Input
                label="Email Reply-To (Opsional)"
                name="reply_to"
                type="email"
                value={form.reply_to || ''}
                onChange={handleChange}
                placeholder="Email balasan"
                helperText="Tujuan jika mahasiswa membalas email."
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[#24212b]">
              <input
                type="checkbox"
                name="secure"
                checked={form.secure}
                onChange={handleChange}
                className="w-4 h-4 text-[#583682] rounded border-[#cfc2df] focus:ring-[#583682]"
              />
              <span className="font-medium">
                Gunakan Koneksi SSL Langsung (Aktifkan jika menggunakan Port 465)
              </span>
            </label>
          </div>

          {/* 3. Anti-Spam Throttling Controls */}
          <div className="p-4 bg-[#faf9fc] rounded-[6px] border border-[#e6e1eb] space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#583682]" />
              <h5 className="font-display font-bold text-xs uppercase tracking-wider text-[#24212b]">
                Pencegahan Blokir & Pembatasan Laju (Anti-Spam Throttling)
              </h5>
            </div>
            <p className="text-[11px] text-[#595562]">
              Ketika ratusan mahasiswa selesai ujian serentak, pengiriman ratusan email sekaligus dalam 1 detik
              dapat menyebabkan IP server kampus masuk blacklist (DNSBL) atau diblokir filter spam Google/Microsoft.
              Sistem antrean CAT GOVERNANCE menggunakan laju bertahap:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <Input
                  label="Jeda Waktu Antar-Email (Milidetik)"
                  name="delay_between_emails_ms"
                  type="number"
                  min="500"
                  step="500"
                  value={form.delay_between_emails_ms}
                  onChange={handleChange}
                  helperText="Rekomendasi: 2000 ms (2 detik) agar server SMTP tetap stabil."
                />
              </div>
              <div>
                <Input
                  label="Maksimum Email Per Menit (Rate Limit)"
                  name="rate_limit_per_minute"
                  type="number"
                  min="5"
                  max="120"
                  value={form.rate_limit_per_minute}
                  onChange={handleChange}
                  helperText="Rekomendasi: 20 - 30 email per menit untuk server kampus."
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#e6e1eb]">
            <span className="text-xs text-[#595562]">
              {form.is_configured
                ? 'Konfigurasi SMTP aktif dan siap mengirim sertifikat mahasiswa.'
                : 'Peringatan: Isi Host, Port, Username, dan Email Pengirim untuk mengaktifkan pengiriman.'}
            </span>

            <Button
              type="submit"
              isLoading={saving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Simpan Konfigurasi SMTP
            </Button>
          </div>
        </Card>
      </form>

      {/* 4. SMTP Connection & Delivery Test Box */}
      <Card hasShadow className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#e6e1eb]">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[#583682]" />
            <h4 className="font-display font-bold text-sm text-[#24212b]">
              Uji Koneksi & Pengiriman Percobaan
            </h4>
          </div>
          <Badge variant="neutral">TESTING TOOL</Badge>
        </div>

        <p className="text-xs text-[#595562]">
          Kirimkan email uji coba ke alamat email administrator untuk memastikan kredensial SMTP,
          port jaringan, dan handshake TLS berjalan tanpa kendala.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 max-w-xl">
          <div className="flex-1 w-full">
            <Input
              label="Email Penerima Uji Coba"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Email penerima"
              leftIcon={<Mail className="w-4 h-4" />}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleTestConnection}
            isLoading={testing}
            leftIcon={<Send className="w-3.5 h-3.5" />}
            className="shrink-0 h-[46px]"
          >
            Kirim Email Tes
          </Button>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-[6px] border text-xs flex items-start gap-2.5 ${
              testResult.success
                ? 'bg-[#eaf4ef] border-[#bce2cf] text-[#287a58]'
                : 'bg-[#fbeeed] border-[#f4c6cb] text-[#b63b48]'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <strong className="block font-semibold">
                {testResult.success ? 'Koneksi Berhasil!' : 'Koneksi SMTP Gagal'}
              </strong>
              <span>{testResult.message}</span>
            </div>
          </div>
        )}
      </Card>

      {/* 5. Outbox Monitor (Antrean Email Sertifikat) */}
      <Card hasShadow className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#e6e1eb]">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-[#583682]" />
              <h4 className="font-display font-bold text-sm text-[#24212b]">
                Monitor Antrean Outbox Email Sertifikat
              </h4>
            </div>
            <p className="text-xs text-[#595562]">
              Pantau status pengiriman email sertifikat mahasiswa secara real-time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={fetchOutbox}
              isLoading={outboxLoading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="text-xs h-8"
            >
              Segarkan
            </Button>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div
            onClick={() => setStatusFilter('all')}
            className={`p-3 rounded border text-center cursor-pointer transition ${
              statusFilter === 'all'
                ? 'bg-[#eae2f5] border-[#583682]'
                : 'bg-[#faf9fc] border-[#e6e1eb] hover:bg-[#f6f2fa]'
            }`}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#595562]">
              Total Antrean
            </span>
            <span className="font-display font-bold text-lg text-[#24212b]">
              {outboxStats.total_count}
            </span>
          </div>

          <div
            onClick={() => setStatusFilter('sent')}
            className={`p-3 rounded border text-center cursor-pointer transition ${
              statusFilter === 'sent'
                ? 'bg-[#eaf4ef] border-[#287a58]'
                : 'bg-[#faf9fc] border-[#e6e1eb] hover:bg-[#eaf4ef]'
            }`}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#287a58]">
              Terkirim
            </span>
            <span className="font-display font-bold text-lg text-[#287a58]">
              {outboxStats.sent_count}
            </span>
          </div>

          <div
            onClick={() => setStatusFilter('pending')}
            className={`p-3 rounded border text-center cursor-pointer transition ${
              statusFilter === 'pending'
                ? 'bg-[#fdf6ec] border-[#a96817]'
                : 'bg-[#faf9fc] border-[#e6e1eb] hover:bg-[#fdf6ec]'
            }`}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#a96817]">
              Menunggu Antrean
            </span>
            <span className="font-display font-bold text-lg text-[#a96817]">
              {outboxStats.pending_count}
            </span>
          </div>

          <div
            onClick={() => setStatusFilter('sending')}
            className={`p-3 rounded border text-center cursor-pointer transition ${
              statusFilter === 'sending'
                ? 'bg-[#eae2f5] border-[#754ead]'
                : 'bg-[#faf9fc] border-[#e6e1eb] hover:bg-[#eae2f5]'
            }`}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#754ead]">
              Sedang Mengirim
            </span>
            <span className="font-display font-bold text-lg text-[#754ead]">
              {outboxStats.sending_count}
            </span>
          </div>

          <div
            onClick={() => setStatusFilter('failed')}
            className={`p-3 rounded border text-center cursor-pointer transition ${
              statusFilter === 'failed'
                ? 'bg-[#fbeeed] border-[#b63b48]'
                : 'bg-[#faf9fc] border-[#e6e1eb] hover:bg-[#fbeeed]'
            }`}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#b63b48]">
              Gagal Kirim
            </span>
            <span className="font-display font-bold text-lg text-[#b63b48]">
              {outboxStats.failed_count}
            </span>
          </div>
        </div>

        {/* Outbox Table */}
        <div className="overflow-x-auto border border-[#e6e1eb] rounded-[6px]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#f6f2fa] border-b border-[#e6e1eb] text-[#595562] font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Waktu</th>
                <th className="py-2.5 px-3">Mahasiswa</th>
                <th className="py-2.5 px-3">No. Sertifikat</th>
                <th className="py-2.5 px-3">Email Tujuan</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Percobaan</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e1eb]">
              {outboxItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#595562]">
                    {outboxLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#583682]" />
                        Memuat data outbox...
                      </span>
                    ) : (
                      'Belum ada email sertifikat dalam antrean atau filter yang dipilih.'
                    )}
                  </td>
                </tr>
              ) : (
                outboxItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#faf9fc] transition">
                    <td className="py-2.5 px-3 font-mono text-[#595562]">
                      {new Date(item.created_at).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-[#24212b]">
                        {item.recipient_name}
                      </div>
                      {item.identifier && (
                        <div className="font-mono text-[11px] text-[#595562]">
                          NIM: {item.identifier}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#583682] font-semibold">
                      {item.certificate_no || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#24212b]">
                      {item.recipient_email}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge
                        variant={
                          item.status === 'sent'
                            ? 'success'
                            : item.status === 'failed'
                            ? 'danger'
                            : item.status === 'sending'
                            ? 'purple'
                            : 'warning'
                        }
                      >
                        {item.status.toUpperCase()}
                      </Badge>
                      {item.last_error && (
                        <div
                          title={item.last_error}
                          className="text-[10px] text-[#b63b48] truncate max-w-[140px] mt-0.5 mx-auto"
                        >
                          {item.last_error}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[#595562]">
                      {item.attempts} / {item.max_attempts}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {item.status === 'failed' ? (
                        <Button
                          variant="secondary"
                          onClick={() => handleRetryEmail(item.id)}
                          isLoading={retryingId === item.id}
                          leftIcon={<RotateCcw className="w-3 h-3" />}
                          className="h-7 px-2.5 text-[11px]"
                        >
                          Kirim Ulang
                        </Button>
                      ) : (
                        <span className="text-[#595562] text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
