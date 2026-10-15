import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('[MIGRATOR] Checking migration status...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    let migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      const srcMigrationsDir = path.resolve(__dirname, '../../src/db/migrations');
      if (fs.existsSync(srcMigrationsDir)) {
        migrationsDir = srcMigrationsDir;
      } else {
        console.log('[MIGRATOR] No migrations directory found.');
        return;
      }
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const { rows: appliedRows } = await client.query('SELECT name FROM schema_migrations;');
    const appliedSet = new Set(appliedRows.map(r => r.name));

    for (const file of files) {
      if (!appliedSet.has(file)) {
        console.log(`[MIGRATOR] Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        await client.query('BEGIN;');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1);', [file]);
          await client.query('COMMIT;');
          console.log(`[MIGRATOR] Successfully applied: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK;');
          console.error(`[MIGRATOR] Error applying ${file}:`, err);
          throw err;
        }
      } else {
        console.log(`[MIGRATOR] Already applied: ${file}`);
      }
    }

    console.log('[MIGRATOR] All migrations are up to date.');
  } finally {
    client.release();
  }
}

// Auto-run if executed directly via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      console.log('[MIGRATOR] Migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[MIGRATOR] Migration process failed:', err);
      process.exit(1);
    });
}
