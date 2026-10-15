import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  min: env.DB_POOL_MIN,
  idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
});

export const db = new Kysely<any>({
  dialect: new PostgresDialect({
    pool,
  }),
});

export function getPoolMetrics() {
  const total = pool.totalCount;
  const idle = pool.idleCount;
  const active = Math.max(0, total - idle);
  const waiting = pool.waitingCount;
  const max = env.DB_POOL_MAX;

  return {
    max,
    min: env.DB_POOL_MIN,
    totalCount: total,
    idleCount: idle,
    activeCount: active,
    waitingCount: waiting,
    utilizationPercentage: max > 0 ? Math.round((active / max) * 100) : 0,
  };
}

export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT now() as db_time, version() as version;');
    console.log(`[DB] Connected successfully to PostgreSQL at ${res.rows[0].db_time}`);
    console.log(`[DB] Pool Configured: Max=${env.DB_POOL_MAX}, Min=${env.DB_POOL_MIN}, IdleTimeout=${env.DB_IDLE_TIMEOUT_MS}ms`);
  } finally {
    client.release();
  }
}
