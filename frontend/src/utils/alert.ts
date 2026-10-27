import Swal, { SweetAlertOptions } from 'sweetalert2';
import { dispatchToast } from '../context/ToastContext';

// Base customized SweetAlert2 theme matching CAT Governance (FIA UNIRA Theme)
const customSwal = Swal.mixin({
  customClass: {
    popup: 'rounded-xl border border-[#e6e1eb] shadow-2xl p-6 font-sans text-[#24212b]',
    title: 'font-display font-bold text-lg text-[#24212b] pt-1 tracking-tight',
    htmlContainer: 'text-xs text-[#595562] leading-relaxed mt-2',
    confirmButton:
      'px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-[#583682] hover:bg-[#472b68] transition shadow-xs focus:ring-2 focus:ring-[#583682]/40 focus:outline-hidden mx-1.5',
    cancelButton:
      'px-4 py-2.5 rounded-lg text-xs font-semibold text-[#595562] bg-[#f0ecf4] hover:bg-[#e4dced] hover:text-[#24212b] transition border border-[#d8cde6] focus:outline-hidden mx-1.5',
    denyButton:
      'px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-[#dc2626] hover:bg-[#b91c1c] transition mx-1.5',
    actions: 'gap-2 mt-4',
  },
  buttonsStyling: false,
  reverseButtons: true,
  backdrop: 'rgba(23, 15, 34, 0.45)',
});

export const alert = {
  /**
   * Notifikasi Sukses
   */
  async success(title: string, text?: string): Promise<void> {
    await customSwal.fire({
      icon: 'success',
      iconColor: '#287a58',
      title,
      text,
      confirmButtonText: 'Selesai',
      timer: 3500,
      timerProgressBar: true,
    });
  },

  /**
   * Notifikasi Error / Kegagalan
   */
  async error(title: string, text?: string): Promise<void> {
    await customSwal.fire({
      icon: 'error',
      iconColor: '#b63b48',
      title,
      text: text || 'Terjadi kendala saat memproses permintaan.',
      confirmButtonText: 'Tutup',
    });
  },

  /**
   * Notifikasi Peringatan
   */
  async warning(title: string, text?: string): Promise<void> {
    await customSwal.fire({
      icon: 'warning',
      iconColor: '#ba7517',
      title,
      text,
      confirmButtonText: 'Mengerti',
    });
  },

  /**
   * Notifikasi Informasi
   */
  async info(title: string, text?: string): Promise<void> {
    await customSwal.fire({
      icon: 'info',
      iconColor: '#583682',
      title,
      text,
      confirmButtonText: 'OK',
    });
  },

  /**
   * Menampilkan Modal Kredensial (Akun / Kata Sandi Baru) dengan Fitur Salin Otomatis
   */
  async showCredential(options: {
    title: string;
    description: string;
    credentialLabel: string;
    credentialValue: string;
    extraNote?: string;
  }): Promise<void> {
    await customSwal.fire({
      icon: 'success',
      iconColor: '#287a58',
      title: options.title,
      html: `
        <div style="text-align: left; margin-top: 8px;">
          <p style="font-size: 13px; color: #595562; margin-bottom: 12px; line-height: 1.4;">${options.description}</p>
          <div style="background-color: #faf5ff; border: 1.5px dashed #7e22ce; border-radius: 8px; padding: 12px; margin-bottom: 10px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: #7e22ce; margin-bottom: 4px;">${options.credentialLabel}</div>
            <div style="font-family: monospace; font-size: 24px; font-weight: 700; letter-spacing: 0.15em; color: #583682; user-select: all;">${options.credentialValue}</div>
          </div>
          ${options.extraNote ? `<p style="font-size: 11px; color: #8c8794; line-height: 1.4; margin: 0;">${options.extraNote}</p>` : ''}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '📋 Salin Kata Sandi',
      cancelButtonText: 'Selesai',
      focusConfirm: true,
      preConfirm: () => {
        try {
          navigator.clipboard.writeText(options.credentialValue);
        } catch {
          const textArea = document.createElement('textarea');
          textArea.value = options.credentialValue;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        return true;
      },
    }).then((result) => {
      if (result.isConfirmed) {
        alert.toast('Kata sandi berhasil disalin ke clipboard!', 'success');
      }
    });
  },

  /**
   * Dialog Konfirmasi Interaktif (Pengganti window.confirm)
   */
  async confirm(options: {
    title: string;
    text: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    isDangerous?: boolean;
    icon?: 'warning' | 'info' | 'question';
  }): Promise<boolean> {
    const isDangerous = options.isDangerous ?? false;

    const result = await customSwal.fire({
      title: options.title,
      text: options.text,
      icon: options.icon || (isDangerous ? 'warning' : 'question'),
      iconColor: isDangerous ? '#dc2626' : '#583682',
      showCancelButton: true,
      confirmButtonText: options.confirmButtonText || (isDangerous ? 'Ya, Lanjutkan' : 'Konfirmasi'),
      cancelButtonText: options.cancelButtonText || 'Batal',
      customClass: {
        popup: 'rounded-xl border border-[#e6e1eb] shadow-2xl p-6 font-sans text-[#24212b]',
        title: 'font-display font-bold text-lg text-[#24212b] pt-1 tracking-tight',
        htmlContainer: 'text-xs text-[#595562] leading-relaxed mt-2',
        confirmButton: isDangerous
          ? 'px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-[#dc2626] hover:bg-[#b91c1c] transition shadow-xs mx-1.5'
          : 'px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-[#583682] hover:bg-[#472b68] transition shadow-xs mx-1.5',
        cancelButton:
          'px-4 py-2.5 rounded-lg text-xs font-semibold text-[#595562] bg-[#f0ecf4] hover:bg-[#e4dced] hover:text-[#24212b] transition border border-[#d8cde6] mx-1.5',
        actions: 'gap-2 mt-5',
      },
      buttonsStyling: false,
      reverseButtons: true,
      focusCancel: isDangerous,
    });

    return result.isConfirmed;
  },

  /**
   * Toast Notifikasi Mengambang Terpadu (Pojok Kanan Atas)
   */
  toast(title: string, icon: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
    const handled = dispatchToast(title, icon);
    if (!handled) {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        customClass: {
          popup: 'rounded-xl border border-[#e6e1eb] bg-white shadow-lg px-4 py-3 text-xs font-semibold text-[#24212b]',
        },
      });
      Toast.fire({ icon, title });
    }
  },
};

export default alert;
