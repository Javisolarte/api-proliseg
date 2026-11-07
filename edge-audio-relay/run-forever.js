'use strict';

/**
 * Watchdog supervisor 24/7 para proliseg-audio-edge (auto-restart en 1.5s ante fallos inesperados)
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const logDir = path.join(__dirname, 'logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'edge-audio.log');
const pidFile = path.join(__dirname, 'edge-supervisor.pid');

fs.writeFileSync(pidFile, String(process.pid), 'utf8');

function appendLog(line) {
  try {
    // Rotación simple a 5 MB
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 5 * 1024 * 1024) {
      fs.renameSync(logFile, logFile + '.1');
    }
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`, 'utf8');
  } catch {}
}

let child = null;
let stopping = false;

function launch() {
  if (stopping) return;
  appendLog('Iniciando proceso hijo server.js...');
  child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.on('data', (d) => appendLog(d.toString('utf8').trimEnd()));
  child.stderr.on('data', (d) => appendLog('[ERR] ' + d.toString('utf8').trimEnd()));

  child.on('exit', (code, signal) => {
    appendLog(`Proceso server.js finalizó (code=${code}, signal=${signal}). Reiniciando en 1500ms...`);
    if (!stopping) {
      setTimeout(launch, 1500);
    }
  });
}

process.on('SIGINT', () => {
  stopping = true;
  if (child) child.kill();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopping = true;
  if (child) child.kill();
  process.exit(0);
});

launch();
