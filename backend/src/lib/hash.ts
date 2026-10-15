import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
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

export const comparePassword = verifyPassword;
export const generateSecureTempPassword = generateTempPassword;
