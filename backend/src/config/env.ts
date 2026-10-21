import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../../');

dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_POOL_MAX: z.coerce.number().default(50),
  DB_POOL_MIN: z.coerce.number().default(5),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().default(20000),
  APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters long'),
  BASE_URL: z.string().default('http://localhost:3000'),
  ADMIN_EMAIL: z.string().email().optional().default('admin@fia.kampus.ac.id'),
  ADMIN_PASSWORD: z.string().min(10).optional().default('AdminPassword123!'),
  UNIRA_API_BASE_URL: z.string().default('https://api.unira.ac.id'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment validation failed');
}

export const env = parsed.data;
