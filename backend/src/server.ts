import os from 'node:os';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { pool, getPoolMetrics } from './db/connection.js';
import { checkClockDrift } from './lib/time.js';
import { startTimeoutSweeper } from './jobs/sweep-timeout.job.js';
import { startAbsentSweeper } from './jobs/mark-absent.job.js';
import { startEmailQueueWorker } from './jobs/email-queue.job.js';

async function startServer() {
  const app = await buildApp();

  try {
    const address = await app.listen({
      host: env.HOST,
      port: env.PORT,
    });

    const interfaces = os.networkInterfaces();
    const networkIps: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          networkIps.push(net.address);
        }
      }
    }

    // Periksa status sinkronisasi NTP & Pool
    const clock = await checkClockDrift();
    const poolMetrics = getPoolMetrics();

    console.log(`\n===============================================================`);
    console.log(`[SERVER] CAT GOVERNANCE Backend Berjalan Siap Digunakan`);
    console.log(`> Akses Lokal (Komputer Admin):   http://localhost:${env.PORT}`);
    if (networkIps.length > 0) {
      networkIps.forEach((ip) => {
        console.log(`> Akses Jaringan (Klien / Komputer Lain di LAN): http://${ip}:${env.PORT}`);
      });
    } else {
      console.log(`> Akses Jaringan:                 ${address}`);
    }
    console.log(`> API V1 Endpoint:                http://localhost:${env.PORT}/api/v1`);
    console.log(`> Health & Diagnostics:           http://localhost:${env.PORT}/health`);
    console.log(`> Sinkronisasi Jam (NTP):         ${clock.status} (Deviasi: ${clock.driftMs}ms)`);
    console.log(`> Kapasitas Pool PostgreSQL:      Max: ${poolMetrics.max} koneksi (Min: ${poolMetrics.min})`);
    if (clock.status !== 'HEALTHY') {
      console.warn(`[PERINGATAN WAKTU] ${clock.message}`);
    }
    console.log(`===============================================================\n`);

    // Start background background sweepers
    const stopTimeoutSweeper = startTimeoutSweeper(10000);
    const stopAbsentSweeper = startAbsentSweeper(60000);
    const stopEmailWorker = startEmailQueueWorker(4000);

    // Graceful Shutdown Handler
    const shutdown = async (signal: string) => {
      console.log(`[SERVER] Received ${signal}. Shutting down gracefully...`);
      stopTimeoutSweeper();
      stopAbsentSweeper();
      stopEmailWorker();

      try {
        await app.close();
        console.log('[SERVER] Fastify HTTP server closed.');
        await pool.end();
        console.log('[SERVER] PostgreSQL pool closed.');
        process.exit(0);
      } catch (err) {
        console.error('[SERVER] Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('[SERVER] Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
