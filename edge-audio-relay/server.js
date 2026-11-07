'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Resolver node_modules de api-proliseg sin importar el directorio de trabajo actual
const API_ROOT = path.resolve(__dirname, '..');
const API_NODE_MODULES = path.join(API_ROOT, 'node_modules');
if (!module.paths.includes(API_NODE_MODULES)) {
  module.paths.unshift(API_NODE_MODULES);
}

const envPathLocal = path.join(__dirname, '.env');
const envPathParent = path.join(API_ROOT, '.env');
if (fs.existsSync(envPathParent)) process.loadEnvFile(envPathParent);
if (fs.existsSync(envPathLocal)) process.loadEnvFile(envPathLocal);

const { WebSocketServer } = require('ws');
const { createClient } = require('@supabase/supabase-js');
const ffmpegStatic = require('ffmpeg-static');
const { AcmeTlsManager } = require('./acme-tls');
const { HikvisionLanEngine } = require('./hikvision-lan');
const { DahuaLanEngine } = require('./dahua-lan');

const EDGE_PORT = Number(process.env.EDGE_HTTPS_PORT || 9443);
const EDGE_ACME_PORT = Number(process.env.EDGE_ACME_PORT || 9080);
const EDGE_TLS_DOMAIN = process.env.EDGE_TLS_DOMAIN || '181-63-207-251.sslip.io';
const MEDIAMTX_HOST = process.env.EDGE_MEDIAMTX_HOST || '192.168.10.32';
const MEDIAMTX_WHEP_PORT = Number(process.env.EDGE_MEDIAMTX_WHEP_PORT || 8889);
const JWT_SECRET = process.env.JWT_SECRET || '';
const FFMPEG_BIN = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const hikEngine = new HikvisionLanEngine();
const dahuaEngine = new DahuaLanEngine();

// ─── Caché en memoria de Dispositivos IoT (0ms lookup en llamadas) ──────────
const devicesById = new Map();
const devicesByIp = new Map();
let lastDeviceSync = 0;

function normalizeDeviceRow(row) {
  const ct = row.configuracion_tecnica || {};
  const pm = ct.puertos_mapeados || {};
  const origIp = String(pm.original_ip || row.ip_local || row.ip_direccion || '').trim();
  const origHttp = Number(pm.original_http || ct.puerto_http_original || 80) || 80;
  const origRtsp = Number(pm.original_rtsp || ct.puerto_rtsp || 554) || 554;

  const marcaStr = String(ct.marca || ct.modelo || row.nombre_identificador || '').toLowerCase();
  const isHik =
    marcaStr.includes('hikvision') ||
    marcaStr.includes('hik') ||
    marcaStr.includes('ds-k') ||
    marcaStr.includes('ds-2cd') ||
    origIp.endsWith('.78') ||
    origIp.endsWith('.79');

  const isDahua =
    !isHik &&
    (marcaStr.includes('dahua') ||
      marcaStr.includes('asi32') ||
      marcaStr.includes('asi') ||
      marcaStr.includes('vto') ||
      (origIp.startsWith('192.168.35.') && !origIp.endsWith('.78') && !origIp.endsWith('.79')));

  return {
    id: row.id,
    nombre: row.nombre_identificador || 'Control de Acceso',
    lanIp: origIp,
    vpnIp: String(row.ip_direccion || '').trim(),
    lanHttpPort: origHttp,
    lanRtspPort: origRtsp,
    user: row.credencial_usuario || 'admin',
    pass: row.credencial_password || '',
    isDahua,
    isHikvision: !isDahua,
    rawConfig: ct,
  };
}

async function syncDevices(force = false) {
  if (!force && Date.now() - lastDeviceSync < 60000 && devicesById.size > 0) return;
  try {
    const { data, error } = await supabase.from('dispositivos_iot').select('*');
    if (error || !Array.isArray(data)) return;
    devicesById.clear();
    devicesByIp.clear();
    for (const row of data) {
      const norm = normalizeDeviceRow(row);
      devicesById.set(norm.id, norm);
      if (norm.lanIp) devicesByIp.set(norm.lanIp, norm);
      if (norm.vpnIp) devicesByIp.set(norm.vpnIp, norm);
    }
    lastDeviceSync = Date.now();
  } catch (err) {
    console.warn(`⚠️ [EDGE-SYNC] Error sincronizando dispositivos_iot: ${err.message}`);
  }
}

async function resolveDevice(deviceId, targetIp, fallbackLocalIp) {
  if (deviceId && devicesById.has(deviceId)) return devicesById.get(deviceId);
  if (fallbackLocalIp && devicesByIp.has(fallbackLocalIp)) return devicesByIp.get(fallbackLocalIp);
  if (targetIp && devicesByIp.has(targetIp)) return devicesByIp.get(targetIp);

  await syncDevices(true);
  if (deviceId && devicesById.has(deviceId)) return devicesById.get(deviceId);
  if (fallbackLocalIp && devicesByIp.has(fallbackLocalIp)) return devicesByIp.get(fallbackLocalIp);
  if (targetIp && devicesByIp.has(targetIp)) return devicesByIp.get(targetIp);
  return null;
}

// ─── Verificación ultrarrápida de JWT (HS256 local + caché 5 min) ──────────
const verifiedTokenCache = new Map();

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

async function verifyOperatorToken(rawToken) {
  const token = String(rawToken || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const cached = verifiedTokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  try {
    const parts = token.split('.');
    if (parts.length === 3 && JWT_SECRET) {
      const signingInput = `${parts[0]}.${parts[1]}`;
      const expected = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(signingInput)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

      if (expected === parts[2]) {
        const payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
        if (!payload.exp || payload.exp * 1000 > Date.now()) {
          verifiedTokenCache.set(token, { payload, expiresAt: Date.now() + 300000 });
          return payload;
        }
      }
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      verifiedTokenCache.set(token, { payload: data.user, expiresAt: Date.now() + 300000 });
      return data.user;
    }
  } catch {}
  return null;
}

// ─── Cabeceras CORS + Private Network Access (Chrome PNA) ──────────────────
function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, If-Match, X-Target-Ip, X-Target-Device-Id'
  );
  res.setHeader('Access-Control-Expose-Headers', 'Location, Link, ETag, Accept-Patch');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ─── Proxy directo LAN de señalización WHEP hacia 192.168.10.32:8889 (<1ms) ─
const whepAgent = new http.Agent({ keepAlive: true, maxSockets: 64 });

function proxyWhepRequest(req, res, subpath) {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const upstreamHeaders = {};
    for (const h of ['content-type', 'accept', 'if-match', 'authorization']) {
      if (req.headers[h]) upstreamHeaders[h] = req.headers[h];
    }
    if (body.length > 0) upstreamHeaders['content-length'] = body.length;

    const pReq = http.request(
      {
        hostname: MEDIAMTX_HOST,
        port: MEDIAMTX_WHEP_PORT,
        path: subpath,
        method: req.method,
        headers: upstreamHeaders,
        agent: whepAgent,
        timeout: 6000,
      },
      (pRes) => {
        setCorsHeaders(req, res);
        for (const [k, v] of Object.entries(pRes.headers)) {
          const lk = k.toLowerCase();
          if (lk.startsWith('access-control-')) continue;
          if (lk === 'location' && typeof v === 'string') {
            // Reescribir Location (ej. /cam_xxx/whep/uuid) bajo el prefijo /webrtc para que PATCH y DELETE sigan en LAN directa
            const normalizedLoc = v.startsWith('/') ? `/webrtc${v}` : v;
            res.setHeader('Location', normalizedLoc);
            continue;
          }
          if (v !== undefined) res.setHeader(k, v);
        }
        res.writeHead(pRes.statusCode || 502);
        pRes.pipe(res);
      }
    );

    pReq.on('socket', (s) => s.setNoDelay(true));
    pReq.on('error', (err) => {
      setCorsHeaders(req, res);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, mensaje: `Error WHEP local: ${err.message}` }));
    });
    pReq.on('timeout', () => pReq.destroy(new Error('Timeout MediaMTX local')));

    if (body.length > 0) pReq.write(body);
    pReq.end();
  });
}

// ─── Stream directo LAN de Audio Entrante (RX) para Dahua / Hikvision ──────
async function handleAudioOut(req, res, urlObj) {
  const deviceId = urlObj.searchParams.get('deviceId') || '';
  const ip = urlObj.searchParams.get('ip') || '';
  const localIp = urlObj.searchParams.get('localIp') || '';

  const dev = await resolveDevice(deviceId, ip, localIp);
  if (!dev || !dev.lanIp) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, mensaje: 'Dispositivo no encontrado en Edge LAN' }));
    return;
  }

  const rtspUrl = dev.isDahua
    ? `rtsp://${encodeURIComponent(dev.user)}:${encodeURIComponent(dev.pass)}@${dev.lanIp}:${dev.lanRtspPort}/cam/realmonitor?channel=1&subtype=1`
    : `rtsp://${encodeURIComponent(dev.user)}:${encodeURIComponent(dev.pass)}@${dev.lanIp}:${dev.lanRtspPort}/Streaming/Channels/102`;

  setCorsHeaders(req, res);
  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const ffArgs = [
    '-hide_banner',
    '-loglevel', 'error',
    '-fflags', '+nobuffer+flush_packets+discardcorrupt',
    '-flags', 'low_delay',
    '-rtsp_transport', 'tcp',
    '-probesize', '1024',
    '-analyzeduration', '0',
    '-i', rtspUrl,
    '-vn',
    '-af', 'highpass=f=165,equalizer=f=2500:t=q:w=1.2:g=4,lowpass=f=3650,acompressor=threshold=-20dB:ratio=3:attack=5:release=60:makeup=2',
    '-acodec', 'libmp3lame',
    '-ar', '16000',
    '-ac', '1',
    '-b:a', '48k',
    '-flush_packets', '1',
    '-f', 'mp3',
    'pipe:1',
  ];

  const ff = spawn(FFMPEG_BIN, ffArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  ff.stdout.pipe(res);

  const cleanup = () => {
    try { ff.kill('SIGKILL'); } catch {}
  };
  req.on('close', cleanup);
  res.on('close', cleanup);
  ff.on('error', cleanup);
}

// ─── Servidor Principal HTTPS + WSS ────────────────────────────────────────
async function main() {
  await syncDevices(true);
  setInterval(() => syncDevices(false), 60000).unref();

  const acme = new AcmeTlsManager({
    domain: EDGE_TLS_DOMAIN,
    acmeHttpPort: EDGE_ACME_PORT,
  });

  const initialCreds = acme.ensureFallbackSelfSigned();

  const requestHandler = async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const urlObj = new URL(req.url || '/', `https://${req.headers.host || EDGE_TLS_DOMAIN}`);
    const pathname = urlObj.pathname;

    // 1. Health check instantáneo (<2ms) para Auto-Edge Detection en Angular
    if (req.method === 'GET' && pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'proliseg-audio-edge',
          mode: 'lan-direct',
          domain: EDGE_TLS_DOMAIN,
          tls: acme.status,
          devicesCached: devicesById.size,
          ts: Date.now(),
        })
      );
      return;
    }

    // 2. Proxy WHEP local directo (POST / PATCH / DELETE /webrtc/:stream/whep...)
    if (pathname.startsWith('/webrtc/')) {
      const subpath = pathname.slice('/webrtc'.length) + urlObj.search;
      proxyWhepRequest(req, res, subpath);
      return;
    }

    // 3. Audio RX directo LAN (/control-acceso/audio-out)
    if (req.method === 'GET' && pathname === '/control-acceso/audio-out') {
      await handleAudioOut(req, res, urlObj);
      return;
    }

    // 4. Contestar llamada directo en hardware LAN (<20ms)
    const contestarMatch = pathname.match(/^\/control-acceso\/dispositivos\/([^/]+)\/contestar$/);
    if (req.method === 'POST' && contestarMatch) {
      const user = await verifyOperatorToken(req.headers.authorization || urlObj.searchParams.get('token'));
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, mensaje: 'Token requerido' }));
        return;
      }
      const dev = await resolveDevice(contestarMatch[1], '', '');
      if (!dev) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, mensaje: 'Dispositivo no encontrado' }));
        return;
      }

      const t0 = Date.now();
      try {
        const result = dev.isDahua ? await dahuaEngine.answerCall(dev) : await hikEngine.answerAndOpen(dev);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, mode: 'edge-lan', latencyMs: Date.now() - t0, ...result }));
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, mensaje: err.message }));
      }
      return;
    }

    // 5. Colgar llamada y cerrar canal de voz directo en hardware LAN (<20ms)
    const colgarMatch = pathname.match(/^\/control-acceso\/dispositivos\/([^/]+)\/colgar$/);
    if (req.method === 'POST' && colgarMatch) {
      const user = await verifyOperatorToken(req.headers.authorization || urlObj.searchParams.get('token'));
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, mensaje: 'Token requerido' }));
        return;
      }
      const dev = await resolveDevice(colgarMatch[1], '', '');
      if (!dev) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, mensaje: 'Dispositivo no encontrado' }));
        return;
      }

      const t0 = Date.now();
      try {
        const result = dev.isDahua ? await dahuaEngine.hangupCall(dev) : await hikEngine.hangupAndClose(dev);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, mode: 'edge-lan', latencyMs: Date.now() - t0, ...result }));
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, mensaje: err.message }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, mensaje: 'Ruta no encontrada en proliseg-audio-edge' }));
  };

  const httpsServer = https.createServer(initialCreds, requestHandler);
  const wss = new WebSocketServer({ noServer: true });

  httpsServer.on('upgrade', async (req, socket, head) => {
    socket.setNoDelay(true);
    try {
      const urlObj = new URL(req.url || '/', `https://${req.headers.host || EDGE_TLS_DOMAIN}`);
      if (urlObj.pathname !== '/audio-in') {
        socket.destroy();
        return;
      }

      const token = urlObj.searchParams.get('token') || req.headers.authorization || '';
      const user = await verifyOperatorToken(token);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, urlObj, user);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, _req, urlObj) => {
    const deviceId = urlObj.searchParams.get('deviceId') || '';
    const targetIp = urlObj.searchParams.get('targetIp') || '';
    const localIp = urlObj.searchParams.get('localIp') || '';

    const dev = await resolveDevice(deviceId, targetIp, localIp);
    if (!dev || !dev.lanIp) {
      ws.send(JSON.stringify({ type: 'error', mensaje: 'Dispositivo no registrado en Edge LAN' }));
      ws.close();
      return;
    }

    let isMuted = false;
    let streamHandle = null;
    let earlyBuffer = [];
    const tStart = Date.now();

    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        try {
          const msg = JSON.parse(data.toString('utf8'));
          if (msg?.type === 'mute') {
            isMuted = Boolean(msg.muted);
          } else if (msg?.type === 'stop') {
            ws.close();
          }
        } catch {}
        return;
      }

      if (isMuted) return;
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (streamHandle) {
        streamHandle.writeMulaw(buf);
      } else {
        earlyBuffer.push(buf);
        while (earlyBuffer.length > 5) earlyBuffer.shift();
      }
    });

    const cleanup = () => {
      if (streamHandle) {
        const h = streamHandle;
        streamHandle = null;
        h.close().catch(() => {});
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);

    try {
      const onReady = (meta) => {
        console.log(
          `⚡ [EDGE-TX] Audio directo activo -> ${dev.nombre} (${dev.lanIp}) [${meta.codec}] en ${Date.now() - tStart}ms`
        );
        if (ws.readyState === ws.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'ready',
              mode: 'edge-lan',
              lanIp: dev.lanIp,
              codec: meta.codec,
              setupMs: Date.now() - tStart,
            })
          );
        }
      };

      const onError = (err) => {
        console.warn(`⚠️ [EDGE-TX] Error en stream hacia ${dev.nombre} (${dev.lanIp}): ${err.message}`);
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'error', mensaje: err.message }));
          ws.close();
        }
      };

      streamHandle = dev.isDahua
        ? await dahuaEngine.openBackchannelStream(dev, onReady, onError)
        : await hikEngine.openAudioStream(dev, onReady, onError);

      while (earlyBuffer.length > 0) {
        streamHandle.writeMulaw(earlyBuffer.shift());
      }
    } catch (err) {
      console.warn(`⚠️ [EDGE-TX] Fallo abriendo canal hacia ${dev.nombre} (${dev.lanIp}): ${err.message}`);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'error', mensaje: err.message }));
        ws.close();
      }
    }
  });

  httpsServer.listen(EDGE_PORT, '0.0.0.0', () => {
    console.log(
      `🚀 [proliseg-audio-edge] Escuchando en https://${EDGE_TLS_DOMAIN}:${EDGE_PORT} (${devicesById.size} equipos LAN cargados)`
    );
  });

  // Emitir/renovar certificado Let's Encrypt real en caliente y revisar cada 12 horas
  const refreshTls = async () => {
    try {
      const res = await acme.obtainLetsEncryptCert();
      httpsServer.setSecureContext({ cert: res.cert, key: res.key });
      if (res.renewed) {
        console.log(`🔒 [proliseg-audio-edge] Contexto TLS actualizado en caliente con certificado Let's Encrypt válido`);
      }
    } catch (err) {
      console.warn(`⚠️ [ACME] Aviso al gestionar certificado Let's Encrypt: ${err.message}`);
    }
  };

  await refreshTls();
  setInterval(refreshTls, 12 * 60 * 60 * 1000).unref();
}

main().catch((err) => {
  console.error('❌ [proliseg-audio-edge] Error fatal:', err);
  process.exit(1);
});
