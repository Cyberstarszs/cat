import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateVerificationCode,
  generateSecureTempPassword,
} from '../../src/lib/hash.js';

describe('Security Utilities & Hash Operations (INV-22, FR-C03)', () => {
  it('should hash and verify passwords using bcrypt', async () => {
    const raw = 'SuperSecret123!';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);

    const matches = await verifyPassword(raw, hash);
    expect(matches).toBe(true);

    const wrong = await verifyPassword('WrongPassword!', hash);
    expect(wrong).toBe(false);
  });

  it('should hash session tokens with SHA-256 deterministically', () => {
    const token = 'session_test_token_123';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex is 64 chars
  });

  it('should generate secure 16-character verification codes (FR-C03)', () => {
    const code = generateVerificationCode();
    expect(code).toHaveLength(16);
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it('should generate secure temporary passwords with mixed character classes', () => {
    const pwd = generateSecureTempPassword();
    expect(pwd.length).toBeGreaterThanOrEqual(10);
    expect(/[a-z]/.test(pwd)).toBe(true);
    expect(/[A-Z]/.test(pwd)).toBe(true);
    expect(/[0-9]/.test(pwd)).toBe(true);
  });
});
