import React, { useState, FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { KeyRound } from 'lucide-react';

export const ForcePasswordModal: React.FC = () => {
  const { mustChangePassword, changePassword, logout } = useAuth();
  const { showToast } = useToast();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!mustChangePassword) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 10) {
      setError('Kata sandi baru minimal harus 10 karakter.');
      return;
    }

    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Kata sandi baru harus mengandung kombinasi huruf besar, huruf kecil, dan angka.');
      return;
    }

    if (oldPassword === newPassword) {
      setError('Kata sandi baru tidak boleh sama dengan kata sandi lama.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      showToast('Kata sandi berhasil diperbarui!', 'success');
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah kata sandi. Periksa kata sandi lama Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={mustChangePassword}
      onClose={logout}
      title="Ganti Kata Sandi"
      description="Ubah kata sandi akun Anda untuk melanjutkan."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="p-3 bg-[#fbeeed] border border-[#f4c6cb] rounded text-xs text-[#b63b48] font-medium leading-relaxed">
            {error}
          </div>
        )}

        <Input
          type="password"
          label="Kata Sandi Lama"
          required
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          placeholder="Kata sandi lama"
          leftIcon={<KeyRound className="w-4 h-4" />}
        />

        <Input
          type="password"
          label="Kata Sandi Baru"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Kata sandi baru"
          leftIcon={<KeyRound className="w-4 h-4" />}
          helperText="Minimal 10 karakter (huruf besar, kecil, dan angka)."
        />

        <Input
          type="password"
          label="Konfirmasi Kata Sandi"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Ulangi kata sandi baru"
          leftIcon={<KeyRound className="w-4 h-4" />}
        />

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#e6e1eb] mt-2">
          <Button type="button" variant="ghost" onClick={logout}>
            Keluar
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            Simpan
          </Button>
        </div>
      </form>
    </Modal>
  );
};
