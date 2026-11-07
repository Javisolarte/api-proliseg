'use strict';

const http = require('http');
const crypto = require('crypto');
const { mulawToAlawBuffer } = require('./g711');

const lanAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 32,
});

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function parseDigestHeader(wwwAuth) {
  if (!wwwAuth || !/^Digest\s/i.test(wwwAuth)) return null;
  const challenge = {};
  const regex = /(\w+)=("([^"]*)"|([^\s,]+))/g;
  let m;
  while ((m = regex.exec(wwwAuth)) !== null) {
    challenge[m[1]] = m[3] !== undefined ? m[3] : m[4];
  }
  if (!challenge.realm || !challenge.nonce) return null;
  const qopRaw = challenge.qop || '';
  const qopList = qopRaw.split(',').map((s) => s.trim()).filter(Boolean);
  challenge.qopSelected = qopList.includes('auth') ? 'auth' : qopList[0] || '';
  challenge.nc = 0;
  challenge.updatedAt = Date.now();
  return challenge;
}

class HikvisionLanEngine {
  constructor() {
    this.digestCache = new Map();       // hostKey -> challenge
    this.codecCache = new Map();        // hostKey -> 'mulaw' | 'alaw'
    this.activeSessions = new Map();    // hostKey -> { sessionId, isOpen, openedAt, putReq }
    this.pendingAnswers = new Map();    // hostKey -> Promise
  }

  hostKey(dev) {
    return `${dev.lanIp}:${dev.lanHttpPort}`;
  }

  buildDigestAuthorization(hostKey, method, uriPath, user, pass) {
    const ch = this.digestCache.get(hostKey);
    if (!ch) return null;
    ch.nc = (ch.nc || 0) + 1;
    const ncHex = String(ch.nc).padStart(8, '0');
    const cnonce = crypto.randomBytes(8).toString('hex');

    const ha1 = md5(`${user}:${ch.realm}:${pass}`);
    const ha2 = md5(`${method}:${uriPath}`);
    let response;
    if (ch.qopSelected) {
      response = md5(`${ha1}:${ch.nonce}:${ncHex}:${cnonce}:${ch.qopSelected}:${ha2}`);
    } else {
      response = md5(`${ha1}:${ch.nonce}:${ha2}`);
    }

    const parts = [
      `username="${user}"`,
      `realm="${ch.realm}"`,
      `nonce="${ch.nonce}"`,
      `uri="${uriPath}"`,
      `response="${response}"`,
    ];
    if (ch.algorithm) parts.push(`algorithm=${ch.algorithm}`);
    if (ch.opaque) parts.push(`opaque="${ch.opaque}"`);
    if (ch.qopSelected) {
      parts.push(`qop=${ch.qopSelected}`);
      parts.push(`nc=${ncHex}`);
      parts.push(`cnonce="${cnonce}"`);
    }
    return `Digest ${parts.join(', ')}`;
  }

  updateDigestFromHeaders(hostKey, headers) {
    const raw = headers?.['www-authenticate'];
    const wwwAuth = Array.isArray(raw) ? raw.find((h) => /Digest/i.test(h)) || raw[0] : raw;
    const parsed = parseDigestHeader(wwwAuth);
    if (parsed) {
      this.digestCache.set(hostKey, parsed);
      return true;
    }
    return false;
  }

  requestIsapi(dev, method, uriPath, body = null, contentType = 'application/xml', timeoutMs = 2200) {
    const hk = this.hostKey(dev);
    const payload = body !== null ? (Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8')) : null;

    const doAttempt = (authHeader) =>
      new Promise((resolve, reject) => {
        const headers = {
          Accept: '*/*',
          ...(contentType ? { 'Content-Type': contentType } : {}),
          ...(payload !== null ? { 'Content-Length': payload.length } : { 'Content-Length': 0 }),
          ...(authHeader ? { Authorization: authHeader } : {}),
        };

        const req = http.request(
          {
            hostname: dev.lanIp,
            port: dev.lanHttpPort,
            path: uriPath,
            method,
            headers,
            agent: lanAgent,
            timeout: timeoutMs,
          },
          (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
              resolve({
                status: res.statusCode || 0,
                headers: res.headers,
                raw: Buffer.concat(chunks).toString('utf8'),
              });
            });
          }
        );

        req.on('socket', (s) => s.setNoDelay(true));
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error(`ISAPI timeout ${method} ${hk}${uriPath}`)));
        if (payload !== null) req.write(payload);
        req.end();
      });

    return (async () => {
      let auth = this.buildDigestAuthorization(hk, method, uriPath, dev.user, dev.pass);
      let res = await doAttempt(auth);
      if (res.status === 401 && this.updateDigestFromHeaders(hk, res.headers)) {
        auth = this.buildDigestAuthorization(hk, method, uriPath, dev.user, dev.pass);
        res = await doAttempt(auth);
      }
      return res;
    })();
  }

  extractSessionId(raw) {
    if (!raw) return '';
    const xml = raw.match(/<sessionId>([^<]+)<\/sessionId>/i);
    if (xml?.[1]) return xml[1].trim();
    const js = raw.match(/"sessionId"\s*:\s*"?([^",}\s]+)"?/i);
    if (js?.[1]) return js[1].trim();
    return '';
  }

  async detectCodec(dev) {
    const hk = this.hostKey(dev);
    if (this.codecCache.has(hk)) return this.codecCache.get(hk);
    try {
      const res = await this.requestIsapi(dev, 'GET', '/ISAPI/System/TwoWayAudio/channels/1/capabilities', null, null, 1500);
      const raw = (res.raw || '').toLowerCase();
      let codec = 'mulaw';
      if (raw.includes('g.711alaw') && !raw.includes('g.711ulaw')) {
        codec = 'alaw';
      }
      this.codecCache.set(hk, codec);
      return codec;
    } catch {
      this.codecCache.set(hk, 'mulaw');
      return 'mulaw';
    }
  }

  async answerAndOpen(dev, channelId = 1) {
    const hk = this.hostKey(dev);
    const existing = this.activeSessions.get(hk);
    if (existing?.isOpen && Date.now() - existing.openedAt < 90000) {
      return existing;
    }

    if (this.pendingAnswers.has(hk)) {
      return this.pendingAnswers.get(hk);
    }

    const p = (async () => {
      try {
        const answerPayload = JSON.stringify({ CallSignal: { cmdType: 'answer' } });

        const [ansRes, openRes, codec] = await Promise.all([
          this.requestIsapi(
            dev,
            'PUT',
            '/ISAPI/VideoIntercom/callSignal?format=json',
            answerPayload,
            'application/json',
            1800
          ).catch(() => ({ status: 0, raw: '' })),
          this.requestIsapi(
            dev,
            'PUT',
            `/ISAPI/System/TwoWayAudio/channels/${channelId}/open`,
            null,
            'application/xml',
            2000
          ).catch(() => ({ status: 0, raw: '' })),
          this.detectCodec(dev),
        ]);

        // En segundo plano no bloqueante: silenciar variante ezviz
        this.requestIsapi(
          dev,
          'PUT',
          '/ISAPI/VideoIntercom/callSignal?format=json&channelType=ezviz',
          answerPayload,
          'application/json',
          1200
        ).catch(() => {});

        let finalOpen = openRes;
        // Si el canal había quedado ocupado de una llamada previa (HTTP 400/403/500), cerrar y reabrir 1 vez
        if (finalOpen.status !== 200) {
          await this.requestIsapi(dev, 'PUT', `/ISAPI/System/TwoWayAudio/channels/${channelId}/close`, null, 'application/xml', 1200).catch(() => {});
          finalOpen = await this.requestIsapi(dev, 'PUT', `/ISAPI/System/TwoWayAudio/channels/${channelId}/open`, null, 'application/xml', 1800).catch(() => ({ status: 0, raw: '' }));
        }

        const sessionId = this.extractSessionId(finalOpen.raw);
        const sessionObj = {
          sessionId,
          codec: codec || 'mulaw',
          isOpen: finalOpen.status === 200 || ansRes.status === 200,
          openedAt: Date.now(),
          putReq: null,
        };
        this.activeSessions.set(hk, sessionObj);
        return sessionObj;
      } finally {
        this.pendingAnswers.delete(hk);
      }
    })();

    this.pendingAnswers.set(hk, p);
    return p;
  }

  async openAudioStream(dev, onReady, onError, channelId = 1) {
    const hk = this.hostKey(dev);
    let session = await this.answerAndOpen(dev, channelId);
    const useAlaw = session.codec === 'alaw';

    let closed = false;
    let currentReq = null;
    let readyFired = false;
    let recovering = false;
    const recentChunks = [];
    let recentBytes = 0;
    const MAX_RING_BYTES = 6400; // ~800ms ventana G.711 para autorecuperación sin cortes

    const pushRecent = (buf) => {
      recentChunks.push(buf);
      recentBytes += buf.length;
      while (recentBytes > MAX_RING_BYTES && recentChunks.length > 1) {
        const old = recentChunks.shift();
        recentBytes -= old.length;
      }
    };

    const connectPutStream = async (reopenChannel = false) => {
      if (closed) return;
      if (reopenChannel) {
        this.activeSessions.delete(hk);
        session = await this.answerAndOpen(dev, channelId);
      }

      // Asegurar que tenemos challenge Digest precalentado antes de abrir stream chunked
      if (!this.digestCache.has(hk)) {
        await this.requestIsapi(dev, 'GET', `/ISAPI/System/TwoWayAudio/channels/${channelId}`, null, null, 1500).catch(() => {});
      }

      const uriPath = session.sessionId
        ? `/ISAPI/System/TwoWayAudio/channels/${channelId}/audioData?sessionId=${encodeURIComponent(session.sessionId)}`
        : `/ISAPI/System/TwoWayAudio/channels/${channelId}/audioData`;

      const authHeader = this.buildDigestAuthorization(hk, 'PUT', uriPath, dev.user, dev.pass);

      const req = http.request({
        hostname: dev.lanIp,
        port: dev.lanHttpPort,
        path: uriPath,
        method: 'PUT',
        agent: false, // Socket dedicado exclusivo para stream continuo de audio
        headers: {
          'Content-Type': 'application/octet-stream',
          'Transfer-Encoding': 'chunked',
          Connection: 'keep-alive',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      });

      currentReq = req;
      session.putReq = req;

      req.on('socket', (sock) => {
        sock.setNoDelay(true);
        sock.setKeepAlive(true, 10000);
      });

      req.on('response', async (res) => {
        const code = res.statusCode || 0;
        if (code === 401 && !closed && !recovering) {
          recovering = true;
          this.updateDigestFromHeaders(hk, res.headers);
          res.resume();
          try { req.destroy(); } catch {}
          await connectPutStream(false);
          for (const c of recentChunks) {
            if (currentReq && !currentReq.destroyed) currentReq.write(c);
          }
          recovering = false;
          return;
        }

        if ((code === 400 || code === 403 || code === 404 || code >= 500) && !closed && !recovering) {
          recovering = true;
          res.resume();
          try { req.destroy(); } catch {}
          await connectPutStream(true);
          for (const c of recentChunks) {
            if (currentReq && !currentReq.destroyed) currentReq.write(c);
          }
          recovering = false;
          return;
        }

        res.resume();
      });

      req.on('error', (err) => {
        if (!closed && !recovering && onError) {
          onError(err);
        }
      });

      req.flushHeaders();
      if (!readyFired) {
        readyFired = true;
        if (onReady) onReady({ codec: session.codec, sessionId: session.sessionId, lanIp: dev.lanIp });
      }
    };

    await connectPutStream(false);

    return {
      writeMulaw: (mulawChunk) => {
        if (closed || !mulawChunk?.length) return;
        const payload = useAlaw ? mulawToAlawBuffer(mulawChunk) : mulawChunk;
        pushRecent(payload);
        if (currentReq && !currentReq.destroyed && currentReq.writable) {
          currentReq.write(payload);
        }
      },
      close: async () => {
        if (closed) return;
        closed = true;
        if (currentReq) {
          try {
            currentReq.end();
            setTimeout(() => {
              try { currentReq.destroy(); } catch {}
            }, 150);
          } catch {}
          currentReq = null;
        }
      },
    };
  }

  async hangupAndClose(dev, channelId = 1) {
    const hk = this.hostKey(dev);
    const active = this.activeSessions.get(hk);
    if (active?.putReq) {
      try { active.putReq.destroy(); } catch {}
    }
    this.activeSessions.delete(hk);

    const hangUpPayload = JSON.stringify({ CallSignal: { cmdType: 'hangUp' } });
    await Promise.allSettled([
      this.requestIsapi(dev, 'PUT', `/ISAPI/System/TwoWayAudio/channels/${channelId}/close`, null, 'application/xml', 1500),
      this.requestIsapi(dev, 'PUT', '/ISAPI/VideoIntercom/callSignal?format=json', hangUpPayload, 'application/json', 1500),
      this.requestIsapi(dev, 'PUT', '/ISAPI/VideoIntercom/callSignal?format=json&channelType=ezviz', hangUpPayload, 'application/json', 1200),
    ]);
    return { ok: true };
  }
}

module.exports = { HikvisionLanEngine };
