import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('🚀 Menjalankan lingkungan CAT Governance (Backend + Frontend)...\n');

const backend = spawn(npmCmd, ['--prefix', 'backend', 'run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

const frontend = spawn(npmCmd, ['--prefix', 'frontend', 'run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  console.log('\n🛑 Menghentikan dev server...');
  if (backend && !backend.killed) {
    backend.kill();
  }
  if (frontend && !frontend.killed) {
    frontend.kill();
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

backend.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Backend process exited with code ${code}`);
  }
});

frontend.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Frontend process exited with code ${code}`);
  }
});
