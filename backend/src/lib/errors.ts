import { FastifyReply, FastifyRequest } from 'fastify';

export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: { status: 401, message: 'Email atau kata sandi tidak valid.' },
  AUTH_REQUIRED: { status: 401, message: 'Autentikasi diperlukan atau sesi Anda telah kedaluwarsa.' },
  AUTH_LOCKED: { status: 423, message: 'Akun Anda terkunci sementara karena beberapa kali gagal login.' },
  AUTH_PASSWORD_CHANGE_REQUIRED: { status: 403, message: 'Anda wajib mengganti kata sandi terlebih dahulu.' },
  FORBIDDEN: { status: 403, message: 'Anda tidak memiliki hak akses untuk tindakan ini.' },
  NOT_FOUND: { status: 404, message: 'Data atau sumber daya yang diminta tidak ditemukan.' },
  VALIDATION_FAILED: { status: 422, message: 'Data masukan tidak memenuhi format atau validasi.' },
  RATE_LIMITED: { status: 429, message: 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.' },
  INVALID_TRANSITION: { status: 409, message: 'Perubahan status ini tidak diizinkan.' },
  CONFIG_LOCKED: { status: 409, message: 'Konfigurasi ujian sudah terkunci karena sudah ada sesi yang dipublikasikan.' },
  SESSION_LOCKED: { status: 409, message: 'Jadwal sesi tidak dapat diubah karena sudah memiliki percobaan ujian.' },
  SESSION_NOT_OPEN: { status: 409, message: 'Sesi ujian belum dibuka atau sudah berakhir.' },
  SESSION_ENDING_SOON: { status: 409, message: 'Sisa waktu sesi kurang dari durasi yang dibutuhkan untuk ujian.' },
  SESSION_NOT_FINISHED: { status: 409, message: 'Sesi belum berakhir atau masih ada peserta yang mengerjakan.' },
  QUESTION_POOL_INSUFFICIENT: { status: 409, message: 'Stok bank soal aktif tidak mencukupi untuk memenuhi aturan komposisi ujian.' },
  CAPACITY_FULL: { status: 409, message: 'Kapasitas kursi sesi ini sudah penuh.' },
  SCHEDULE_OVERLAP: { status: 409, message: 'Jadwal sesi ini beririsan dengan sesi lain yang telah terdaftar.' },
  ALREADY_PASSED: { status: 409, message: 'Peserta sudah dinyatakan lulus pada ujian kompetensi ini.' },
  QUOTA_EXCEEDED: { status: 409, message: 'Batas kesempatan percobaan untuk ujian ini sudah habis.' },
  PREVIOUS_RESULT_PENDING: { status: 409, message: 'Hasil percobaan sebelumnya belum dipublikasikan.' },
  ALREADY_ENROLLED: { status: 409, message: 'Peserta sudah terdaftar pada sesi ujian ini.' },
  ATTEMPT_EXPIRED: { status: 409, message: 'Batas waktu pengerjaan ujian sudah berakhir.' },
  ATTEMPT_NOT_ACTIVE: { status: 409, message: 'Percobaan ujian tidak dalam status sedang dikerjakan.' },
  ACCESS_CODE_INVALID: { status: 403, message: 'Kode akses sesi yang Anda masukkan salah.' },
  LAST_ADMIN: { status: 409, message: 'Admin aktif terakhir tidak boleh dinonaktifkan atau dihapus.' },
  CORRECTION_INVALID: { status: 409, message: 'Koreksi soal tidak valid atau menghasilkan total skor nol.' },
  APPEAL_WINDOW_CLOSED: { status: 409, message: 'Batas waktu pengajuan sanggah sudah berakhir.' },
  CONFLICT: { status: 409, message: 'Operasi konflik dengan status atau data yang ada.' },
  APPEAL_ALREADY_EXISTS: { status: 409, message: 'Sanggahan untuk hasil ujian ini sudah diajukan dan sedang diproses.' },
  INTERNAL_ERROR: { status: 500, message: 'Terjadi kesalahan internal pada server.' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: any;

  constructor(code: ErrorCode, customMessage?: string, details?: any) {
    const meta = ERROR_CODES[code] || ERROR_CODES.INTERNAL_ERROR;
    super(customMessage || meta.message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = meta.status;
    this.details = details || {};
  }
}

export function handleGlobalError(error: any, request: FastifyRequest, reply: FastifyReply) {
  const requestId = request.id || 'unknown';

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      request_id: requestId,
    });
  }

  // Fastify Schema Validation Error
  if (error.validation) {
    return reply.status(422).send({
      error: {
        code: 'VALIDATION_FAILED',
        message: error.message || 'Validasi masukan gagal',
        details: error.validation,
      },
      request_id: requestId,
    });
  }

  // Rate limit error
  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: {
        code: 'RATE_LIMITED',
        message: ERROR_CODES.RATE_LIMITED.message,
        details: {},
      },
      request_id: requestId,
    });
  }

  // Database error or unexpected server error
  request.log.error(error);
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: ERROR_CODES.INTERNAL_ERROR.message,
      details: {},
    },
    request_id: requestId,
  });
}
