import crypto from 'crypto';
import * as nodeBcrypt from '@node-rs/bcrypt';
import bcryptjs from 'bcryptjs';

const DEFAULT_COST = 10;

/**
 * Hash password menggunakan native binding Rust (@node-rs/bcrypt) untuk performa
 * tinggi tanpa memblokir event loop Node.js. Otomatis fallback ke bcryptjs jika native binding gagal.
 */
export async function hashPassword(password: string, cost: number = DEFAULT_COST): Promise<string> {
  try {
    return await nodeBcrypt.hash(password, { cost });
  } catch {
    return bcryptjs.hash(password, cost);
  }
}

/**
 * Verifikasi password terhadap hash bcrypt ($2a, $2b, $2y didukung secara native)
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await nodeBcrypt.compare(password, hash);
  } catch {
    return bcryptjs.compare(password, hash);
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateVerificationCode(): string {
  // 16 chars uppercase alphanumeric (entropy >= 128 bit)
  return crypto.randomBytes(12).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, 'X').slice(0, 16);
}

export function generateTempPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%&*';
  
  let pwd = '';
  // Ensure at least one from each class
  pwd += letters[crypto.randomInt(letters.length)];
  pwd += letters[crypto.randomInt(letters.length)].toLowerCase();
  pwd += numbers[crypto.randomInt(numbers.length)];
  pwd += special[crypto.randomInt(special.length)];

  const allChars = letters + numbers + special;
  for (let i = 0; i < 8; i++) {
    pwd += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle
  return pwd.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

export function generateNumeric6DigitPassword(): string {
  // Generates exactly 6-digit numeric string (100000 to 999999) using crypto
  return crypto.randomInt(100000, 1000000).toString();
}

export const comparePassword = verifyPassword;
export const generateSecureTempPassword = generateTempPassword;
