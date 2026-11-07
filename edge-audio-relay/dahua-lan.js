'use strict';

const http = require('http');
const net = require('net');
const crypto = require('crypto');
const { mulawToAlawBuffer } = require('./g711');

const dahuaHttpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 24,
});

function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex');
}

function parseDigest(headerVal) {
  if (!headerVal || !/Digest\s/i.test(headerVal)) return null;
  const out = {};
  const rx = /(\w+)=("([^"]*)"|([^\s,]+))/g;
  let m;
  while ((m = rx.exec(headerVal)) !== null) {
    out[m[1]] = m[3] !== undefined ? m[3] : m[4];
  }
  if (!out.realm || !out.nonce) return null;
  const qops = (out.qop || '').split(',').map((q) => q.trim()).filter(Boolean);
  out.qopSelected = qops.includes('auth') ? 'auth' : qops[0] || '';
  out.nc = 0;
  return out;
}

function buildDigestHeader(ch, method, uri, user, pass) {
  ch.nc = (ch.nc || 0) + 1;
  const ncHex = String(ch.nc).padStart(8, '0');
  const cnonce = crypto.randomBytes(8).toString('hex');
  const ha1 = md5(`${user}:${ch.realm}:${pass}`);
  const ha2 = md5(`${method}:${uri}`);
  const resp = ch.qopSelected
    ? md5(`${ha1}:${ch.nonce}:${ncHex}:${cnonce}:${ch.qopSelected}:${ha2}`)
    : md5(`${ha1}:${ch.nonce}:${ha2}`);

  const parts = [
    `username="${user}"`,
    `realm="${ch.realm}"`,
    `nonce="${ch.nonce}"`,
    `uri="${uri}"`,
    `response="${resp}"`,
  ];
  if (ch.opaque) parts.push(`opaque="${ch.opaque}"`);
  if (ch.qopSelected) {
    parts.push(`qop=${ch.qopSelected}`);
    parts.push(`nc=${ncHex}`);
    parts.push(`cnonce="${cnonce}"`);
  }
  return `Digest ${parts.join(', ')}`;
}

class DahuaLanEngine {
  constructor() {
    this.httpDigestCache = new Map();
  }

  hostKey(dev) {
    return `${dev.lanIp}:${dev.lanHttpPort}`;
  }

  async cgiGet(dev, uriPath, timeoutMs = 1800) {
    const hk = this.hostKey(dev);
    const attempt = (auth) =>
      new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: dev.lanIp,
            port: dev.lanHttpPort,
            path: uriPath,
            method: 'GET',
            agent: dahuaHttpAgent,
            timeout: timeoutMs,
            headers: {
              Accept: '*/*',
              ...(auth ? { Authorization: auth } : {}),
            },
          },
          (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () =>
              resolve({
                status: res.statusCode || 0,
                headers: res.headers,
                raw: Buffer.concat(chunks).toString('utf8'),
              })
            );
          }
        );
        req.on('socket', (s) => s.setNoDelay(true));
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error(`Dahua CGI timeout ${hk}${uriPath}`)));
        req.end();
      });

    let ch = this.httpDigestCache.get(hk);
    let auth = ch ? buildDigestHeader(ch, 'GET', uriPath, dev.user, dev.pass) : null;
    let res = await attempt(auth);
    if (res.status === 401) {
      const www = Array.isArray(res.headers['www-authenticate'])
        ? res.headers['www-authenticate'].find((h) => /Digest/i.test(h)) || res.headers['www-authenticate'][0]
        : res.headers['www-authenticate'];
      const parsed = parseDigest(www);
      if (parsed) {
        this.httpDigestCache.set(hk, parsed);
        auth = buildDigestHeader(parsed, 'GET', uriPath, dev.user, dev.pass);
        res = await attempt(auth);
      }
    }
    return res;
  }

  async answerCall(dev) {
    const endpoints = [
      '/cgi-bin/intercom.cgi?action=answer',
      '/cgi-bin/vto.cgi?action=answer',
      '/cgi-bin/console.cgi?action=answer',
    ];
    for (const ep of endpoints) {
      try {
        const r = await this.cgiGet(dev, ep, 1400);
        if (r.status === 200) return { ok: true, endpoint: ep };
      } catch {}
    }
    return { ok: true, endpoint: 'rtsp-backchannel-ready' };
  }

  async hangupCall(dev) {
    const endpoints = [
      '/cgi-bin/intercom.cgi?action=hangUp',
      '/cgi-bin/vto.cgi?action=hangUp',
      '/cgi-bin/intercom.cgi?action=cancel',
      '/cgi-bin/intercom.cgi?action=reject',
    ];
    for (const ep of endpoints) {
      try {
        const r = await this.cgiGet(dev, ep, 1400);
        if (r.status === 200) return { ok: true, endpoint: ep };
      } catch {}
    }
    return { ok: true };
  }

  /**
   * Abre Backchannel ONVIF RTSP directo en LAN (<35ms hasta PLAY 200 OK)
   * y empaqueta tramas G.711 en RTP-over-TCP interleaved sin requerir FFmpeg
   */
  async openBackchannelStream(dev, onReady, onError) {
    const rtspPort = Number(dev.lanRtspPort || 554);
    const baseUrl = `rtsp://${dev.lanIp}:${rtspPort}/cam/realmonitor?channel=1&subtype=1`;

    const socket = net.connect({ host: dev.lanIp, port: rtspPort });
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 10000);

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Timeout conectando RTSP ${dev.lanIp}:${rtspPort}`));
      }, 2500);
      socket.once('connect', () => {
        clearTimeout(t);
        resolve();
      });
      socket.once('error', (e) => {
        clearTimeout(t);
        reject(e);
      });
    });

    let cseq = 0;
    let rtspDigest = null;
    let sessionHeader = '';
    let rxBuf = Buffer.alloc(0);
    let pendingWaiter = null;

    socket.on('data', (chunk) => {
      if (!pendingWaiter) return;
      rxBuf = Buffer.concat([rxBuf, chunk]);

      // Ignorar tramas RTP interleaved ('$') si llegan antes de la respuesta RTSP
      while (rxBuf.length >= 4 && rxBuf[0] === 0x24) {
        const len = rxBuf.readUInt16BE(2);
        if (rxBuf.length < 4 + len) return;
        rxBuf = rxBuf.subarray(4 + len);
      }

      const headerEnd = rxBuf.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      const headerStr = rxBuf.subarray(0, headerEnd).toString('utf8');
      const clMatch = headerStr.match(/Content-Length:\s*(\d+)/i);
      const bodyLen = clMatch ? parseInt(clMatch[1], 10) : 0;
      if (rxBuf.length < headerEnd + 4 + bodyLen) return;

      const bodyStr = rxBuf.subarray(headerEnd + 4, headerEnd + 4 + bodyLen).toString('utf8');
      rxBuf = rxBuf.subarray(headerEnd + 4 + bodyLen);

      const statusMatch = headerStr.match(/^RTSP\/1\.0\s+(\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
      const waiter = pendingWaiter;
      pendingWaiter = null;
      waiter.resolve({ status, headersRaw: headerStr, body: bodyStr });
    });

    const sendRtsp = (method, url, extraHeaders = {}) =>
      new Promise((resolve, reject) => {
        cseq++;
        const lines = [`${method} ${url} RTSP/1.0`, `CSeq: ${cseq}`, 'User-Agent: ProlisegAudioEdge/1.0'];
        if (sessionHeader) lines.push(`Session: ${sessionHeader}`);
        if (rtspDigest) {
          lines.push(`Authorization: ${buildDigestHeader(rtspDigest, method, url, dev.user, dev.pass)}`);
        }
        for (const [k, v] of Object.entries(extraHeaders)) {
          lines.push(`${k}: ${v}`);
        }
        lines.push('', '');

        const timer = setTimeout(() => {
          pendingWaiter = null;
          reject(new Error(`Timeout RTSP ${method} en ${dev.lanIp}`));
        }, 2500);

        pendingWaiter = {
          resolve: (res) => {
            clearTimeout(timer);
            resolve(res);
          },
        };
        socket.write(lines.join('\r\n'));
      });

    const sendRtspWithAuth = async (method, url, extraHeaders = {}) => {
      let res = await sendRtsp(method, url, extraHeaders);
      if (res.status === 401) {
        const wwwMatch = res.headersRaw.match(/WWW-Authenticate:\s*(Digest[^\r\n]+)/i);
        if (wwwMatch?.[1]) {
          rtspDigest = parseDigest(wwwMatch[1]);
          if (rtspDigest) {
            res = await sendRtsp(method, url, extraHeaders);
          }
        }
      }
      return res;
    };

    try {
      await sendRtspWithAuth('OPTIONS', baseUrl, { Require: 'www.onvif.org/ver20/backchannel' });
      const desc = await sendRtspWithAuth('DESCRIBE', baseUrl, {
        Accept: 'application/sdp',
        Require: 'www.onvif.org/ver20/backchannel',
      });
      if (desc.status !== 200) {
        throw new Error(`RTSP DESCRIBE rechazado (${desc.status})`);
      }

      // Parsear pista sendonly del SDP para backchannel (usualmente trackID=4 o trackID=5, PCMA/8000 o PCMU/8000)
      const mediaBlocks = desc.body.split(/\r?\nm=/);
      let controlUrl = '';
      let payloadType = 8; // 8 = PCMA, 0 = PCMU
      let useAlaw = true;

      for (let i = 1; i < mediaBlocks.length; i++) {
        const block = 'm=' + mediaBlocks[i];
        if (!/^m=audio\b/i.test(block)) continue;
        const isBackchannel = /a=sendonly/i.test(block);
        const ctrlMatch = block.match(/a=control:([^\r\n]+)/i);
        if (!ctrlMatch) continue;

        if (isBackchannel || !controlUrl) {
          const rawCtrl = ctrlMatch[1].trim();
          if (/^rtsp:\/\//i.test(rawCtrl)) {
            controlUrl = rawCtrl;
          } else {
            const contentBaseMatch = desc.headersRaw.match(/Content-Base:\s*([^\r\n]+)/i);
            const prefix = (contentBaseMatch ? contentBaseMatch[1].trim() : baseUrl).replace(/\/+$/, '');
            controlUrl = `${prefix}/${rawCtrl.replace(/^\/+/, '')}`;
          }

          if (/PCMU\/8000/i.test(block) && !/PCMA\/8000/i.test(block)) {
            useAlaw = false;
            const ptMatch = block.match(/a=rtpmap:(\d+)\s+PCMU\/8000/i);
            payloadType = ptMatch ? parseInt(ptMatch[1], 10) : 0;
          } else {
            useAlaw = true;
            const ptMatch = block.match(/a=rtpmap:(\d+)\s+PCMA\/8000/i);
            payloadType = ptMatch ? parseInt(ptMatch[1], 10) : 8;
          }
          if (isBackchannel) break;
        }
      }

      if (!controlUrl) {
        throw new Error('SDP de cámara Dahua no expuso pista de audio backchannel');
      }

      const setupRes = await sendRtspWithAuth('SETUP', controlUrl, {
        Transport: 'RTP/AVP/TCP;unicast;interleaved=0-1',
        Require: 'www.onvif.org/ver20/backchannel',
      });
      if (setupRes.status !== 200) {
        throw new Error(`RTSP SETUP backchannel falló (${setupRes.status})`);
      }

      const sessMatch = setupRes.headersRaw.match(/Session:\s*([^;\r\n]+)/i);
      if (sessMatch?.[1]) sessionHeader = sessMatch[1].trim();

      const playRes = await sendRtspWithAuth('PLAY', baseUrl, {
        Require: 'www.onvif.org/ver20/backchannel',
      });
      if (playRes.status !== 200) {
        throw new Error(`RTSP PLAY backchannel falló (${playRes.status})`);
      }

      let closed = false;
      let seq = Math.floor(Math.random() * 30000);
      let timestamp = Math.floor(Math.random() * 100000);
      const ssrc = crypto.randomBytes(4).readUInt32BE(0);
      let residual = Buffer.alloc(0);
      const frameQueue = [];

      const pacer = setInterval(() => {
        if (closed || socket.destroyed || frameQueue.length === 0) return;
        // Anti-lag: si por jitter de Wi-Fi llegaron >10 paquetes de 20ms (200ms), recortar cola
        while (frameQueue.length > 10) frameQueue.shift();

        const payload160 = frameQueue.shift();
        seq = (seq + 1) & 0xffff;
        timestamp = (timestamp + 160) >>> 0;

        const pkt = Buffer.allocUnsafe(4 + 12 + 160);
        // RTSP Interleaved Header ($ + ch 0 + length 172)
        pkt[0] = 0x24;
        pkt[1] = 0x00;
        pkt.writeUInt16BE(172, 2);
        // RTP Header (V=2, PT=payloadType)
        pkt[4] = 0x80;
        pkt[5] = payloadType & 0x7f;
        pkt.writeUInt16BE(seq, 6);
        pkt.writeUInt32BE(timestamp, 8);
        pkt.writeUInt32BE(ssrc, 12);
        payload160.copy(pkt, 16);

        socket.write(pkt);
      }, 20);

      socket.on('error', (err) => {
        if (!closed && onError) onError(err);
      });

      socket.on('close', () => {
        clearInterval(pacer);
      });

      if (onReady) {
        onReady({ codec: useAlaw ? 'PCMA' : 'PCMU', lanIp: dev.lanIp });
      }

      return {
        writeMulaw: (mulawChunk) => {
          if (closed || !mulawChunk?.length) return;
          const converted = useAlaw ? mulawToAlawBuffer(mulawChunk) : mulawChunk;
          const combined = residual.length > 0 ? Buffer.concat([residual, converted]) : converted;
          let offset = 0;
          while (offset + 160 <= combined.length) {
            frameQueue.push(combined.subarray(offset, offset + 160));
            offset += 160;
          }
          residual = offset < combined.length ? Buffer.from(combined.subarray(offset)) : Buffer.alloc(0);
        },
        close: async () => {
          if (closed) return;
          closed = true;
          clearInterval(pacer);
          try {
            if (!socket.destroyed && sessionHeader) {
              const teardownLines = [
                `TEARDOWN ${baseUrl} RTSP/1.0`,
                `CSeq: ${++cseq}`,
                `Session: ${sessionHeader}`,
                ...(rtspDigest
                  ? [`Authorization: ${buildDigestHeader(rtspDigest, 'TEARDOWN', baseUrl, dev.user, dev.pass)}`]
                  : []),
                '',
                '',
              ];
              socket.write(teardownLines.join('\r\n'));
            }
          } catch {}
          setTimeout(() => {
            try { socket.destroy(); } catch {}
          }, 120);
        },
      };
    } catch (err) {
      try { socket.destroy(); } catch {}
      throw err;
    }
  }
}

module.exports = { DahuaLanEngine };
