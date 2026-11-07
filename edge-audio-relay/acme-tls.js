'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const LE_DIRECTORY_PROD = 'https://acme-v02.api.letsencrypt.org/directory';
const LE_DIRECTORY_STAGING = 'https://acme-staging-v02.api.letsencrypt.org/directory';

function findOpenSsl() {
  const candidates = [
    process.env.OPENSSL_BIN,
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
    'openssl',
  ].filter(Boolean);

  for (const bin of candidates) {
    try {
      execFileSync(bin, ['version'], { stdio: 'ignore' });
      return bin;
    } catch {}
  }
  throw new Error('No se encontró binario OpenSSL para generar CSR/certificados');
}

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function httpsJsonRequest(url, method = 'GET', bodyObj = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = bodyObj !== null ? (typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj)) : null;
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        headers: {
          'User-Agent': 'proliseg-audio-edge/1.0',
          ...(payload !== null
            ? {
                'Content-Type': 'application/jose+json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...headers,
        },
        timeout: 15000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data = raw;
          try {
            if (raw && (res.headers['content-type'] || '').includes('json')) {
              data = JSON.parse(raw);
            }
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, data, raw });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout ACME request: ${url}`));
    });
    if (payload !== null) req.write(payload);
    req.end();
  });
}

class AcmeTlsManager {
  constructor(opts = {}) {
    this.domain = opts.domain || '181-63-207-251.sslip.io';
    this.email = opts.email || 'settingspyp@gmail.com';
    this.certsDir = opts.certsDir || path.join(__dirname, 'certs');
    this.acmeHttpPort = Number(opts.acmeHttpPort || 9080);
    this.staging = Boolean(opts.staging);
    this.challenges = new Map();
    this.acmeServer = null;
    this.opensslBin = findOpenSsl();
    this.status = 'initializing';

    fs.mkdirSync(this.certsDir, { recursive: true });
    this.certPath = path.join(this.certsDir, 'fullchain.pem');
    this.keyPath = path.join(this.certsDir, 'privkey.pem');
    this.accountKeyPath = path.join(this.certsDir, 'account.key.pem');
    this.accountUrlPath = path.join(this.certsDir, 'account.url.txt');
  }

  startChallengeServer() {
    if (this.acmeServer) return Promise.resolve();
    return new Promise((resolve) => {
      this.acmeServer = http.createServer((req, res) => {
        const prefix = '/.well-known/acme-challenge/';
        if (req.method === 'GET' && req.url && req.url.startsWith(prefix)) {
          const token = req.url.slice(prefix.length).split('?')[0].trim();
          const keyAuth = this.challenges.get(token);
          if (keyAuth) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(keyAuth);
            return;
          }
        }
        if (req.method === 'GET' && req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, acmeResponder: true, domain: this.domain }));
          return;
        }
        res.writeHead(404);
        res.end('Not Found');
      });

      this.acmeServer.on('error', (err) => {
        console.warn(`⚠️ [ACME-HTTP] No se pudo abrir puerto ${this.acmeHttpPort}: ${err.message}`);
        resolve();
      });

      this.acmeServer.listen(this.acmeHttpPort, '0.0.0.0', () => {
        console.log(`🔐 [ACME-HTTP] Respondedor HTTP-01 activo en 0.0.0.0:${this.acmeHttpPort}`);
        resolve();
      });
    });
  }

  getValidDaysRemaining() {
    if (!fs.existsSync(this.certPath) || !fs.existsSync(this.keyPath)) return -1;
    try {
      const x509 = new crypto.X509Certificate(fs.readFileSync(this.certPath));
      if (x509.issuer && x509.issuer === x509.subject) {
        // Self-signed temporal
        return 0;
      }
      const san = x509.subjectAltName || '';
      if (!san.toLowerCase().includes(this.domain.toLowerCase())) {
        return 0;
      }
      const validTo = Date.parse(x509.validTo);
      if (!Number.isFinite(validTo)) return 0;
      return (validTo - Date.now()) / (1000 * 60 * 60 * 24);
    } catch {
      return -1;
    }
  }

  ensureFallbackSelfSigned() {
    if (fs.existsSync(this.certPath) && fs.existsSync(this.keyPath)) {
      return {
        cert: fs.readFileSync(this.certPath),
        key: fs.readFileSync(this.keyPath),
      };
    }

    const tmpKey = path.join(this.certsDir, 'selfsigned.key.pem');
    const tmpCert = path.join(this.certsDir, 'selfsigned.cert.pem');
    execFileSync(this.opensslBin, [
      'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1',
      '-days', '365', '-nodes',
      '-keyout', tmpKey,
      '-out', tmpCert,
      '-subj', `/CN=${this.domain}`,
      '-addext', `subjectAltName=DNS:${this.domain},IP:192.168.10.157,IP:181.63.207.251`,
    ], { stdio: 'ignore' });

    this.status = 'self-signed-fallback';
    return {
      cert: fs.readFileSync(tmpCert),
      key: fs.readFileSync(tmpKey),
    };
  }

  loadOrCreateAccountKey() {
    if (fs.existsSync(this.accountKeyPath)) {
      return crypto.createPrivateKey(fs.readFileSync(this.accountKeyPath));
    }
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    fs.writeFileSync(this.accountKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    return privateKey;
  }

  async obtainLetsEncryptCert() {
    const days = this.getValidDaysRemaining();
    if (days > 25) {
      this.status = `letsencrypt-valid (${Math.round(days)}d)`;
      return {
        renewed: false,
        cert: fs.readFileSync(this.certPath),
        key: fs.readFileSync(this.keyPath),
      };
    }

    await this.startChallengeServer();
    const dirUrl = this.staging ? LE_DIRECTORY_STAGING : LE_DIRECTORY_PROD;
    console.log(`🔐 [ACME] Solicitando certificado Let's Encrypt para ${this.domain}...`);

    const dirRes = await httpsJsonRequest(dirUrl, 'GET');
    if (dirRes.status !== 200 || !dirRes.data?.newOrder) {
      throw new Error(`No se pudo leer directorio ACME (${dirRes.status})`);
    }
    const directory = dirRes.data;

    const accountKey = this.loadOrCreateAccountKey();
    const pubJwk = crypto.createPublicKey(accountKey).export({ format: 'jwk' });
    const jwk = { crv: pubJwk.crv, kty: pubJwk.kty, x: pubJwk.x, y: pubJwk.y };
    const thumbprint = b64url(crypto.createHash('sha256').update(JSON.stringify(jwk)).digest());

    let nonce = null;
    const getNonce = async () => {
      if (nonce) {
        const n = nonce;
        nonce = null;
        return n;
      }
      const r = await httpsJsonRequest(directory.newNonce, 'HEAD');
      return r.headers['replay-nonce'];
    };

    const signedPost = async (url, payloadObj, kid = null) => {
      const currentNonce = await getNonce();
      const protectedHeader = kid
        ? { alg: 'ES256', kid, nonce: currentNonce, url }
        : { alg: 'ES256', jwk, nonce: currentNonce, url };

      const protectedB64 = b64url(JSON.stringify(protectedHeader));
      const payloadB64 = payloadObj === '' ? '' : b64url(JSON.stringify(payloadObj));
      const signingInput = `${protectedB64}.${payloadB64}`;
      const signature = crypto.sign('sha256', Buffer.from(signingInput, 'utf8'), {
        key: accountKey,
        dsaEncoding: 'ieee-p1363',
      });

      const res = await httpsJsonRequest(url, 'POST', {
        protected: protectedB64,
        payload: payloadB64,
        signature: b64url(signature),
      });
      if (res.headers['replay-nonce']) {
        nonce = res.headers['replay-nonce'];
      }
      return res;
    };

    // 1. Account registration / lookup
    const acctRes = await signedPost(directory.newAccount, {
      termsOfServiceAgreed: true,
      contact: [`mailto:${this.email}`],
    });
    if (acctRes.status !== 200 && acctRes.status !== 201) {
      throw new Error(`Error cuenta ACME (${acctRes.status}): ${acctRes.raw}`);
    }
    const accountUrl = acctRes.headers.location;
    fs.writeFileSync(this.accountUrlPath, accountUrl, 'utf8');

    // 2. New Order
    const orderRes = await signedPost(
      directory.newOrder,
      { identifiers: [{ type: 'dns', value: this.domain }] },
      accountUrl
    );
    if (orderRes.status !== 201) {
      throw new Error(`Error newOrder ACME (${orderRes.status}): ${orderRes.raw}`);
    }
    const orderUrl = orderRes.headers.location;
    const order = orderRes.data;

    // 3. Authorizations (HTTP-01)
    for (const authzUrl of order.authorizations || []) {
      const authzRes = await signedPost(authzUrl, '', accountUrl);
      const authz = authzRes.data;
      if (authz.status === 'valid') continue;

      const httpChallenge = (authz.challenges || []).find((c) => c.type === 'http-01');
      if (!httpChallenge) {
        throw new Error(`No hay challenge http-01 para ${this.domain}`);
      }

      const keyAuthorization = `${httpChallenge.token}.${thumbprint}`;
      this.challenges.set(httpChallenge.token, keyAuthorization);

      try {
        await signedPost(httpChallenge.url, {}, accountUrl);

        let attempts = 0;
        while (attempts < 25) {
          await new Promise((r) => setTimeout(r, 1500));
          const poll = await signedPost(authzUrl, '', accountUrl);
          if (poll.data.status === 'valid') break;
          if (poll.data.status === 'invalid') {
            throw new Error(`Validación HTTP-01 falló: ${JSON.stringify(poll.data)}`);
          }
          attempts++;
        }
      } finally {
        this.challenges.delete(httpChallenge.token);
      }
    }

    // 4. Generate domain key & CSR via OpenSSL
    const nextKeyPath = path.join(this.certsDir, 'privkey.next.pem');
    const csrDerPath = path.join(this.certsDir, 'domain.csr.der');
    execFileSync(this.opensslBin, [
      'ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', nextKeyPath,
    ], { stdio: 'ignore' });
    execFileSync(this.opensslBin, [
      'req', '-new', '-key', nextKeyPath,
      '-subj', `/CN=${this.domain}`,
      '-addext', `subjectAltName=DNS:${this.domain}`,
      '-outform', 'DER',
      '-out', csrDerPath,
    ], { stdio: 'ignore' });

    const csrDer = fs.readFileSync(csrDerPath);

    // 5. Finalize order
    const finRes = await signedPost(order.finalize, { csr: b64url(csrDer) }, accountUrl);
    if (finRes.status !== 200) {
      throw new Error(`Error finalize ACME (${finRes.status}): ${finRes.raw}`);
    }

    let finalOrder = finRes.data;
    let waitOrder = 0;
    while (finalOrder.status !== 'valid' && waitOrder < 20) {
      if (finalOrder.status === 'invalid') {
        throw new Error(`Orden ACME inválida: ${JSON.stringify(finalOrder)}`);
      }
      await new Promise((r) => setTimeout(r, 1500));
      const pollOrder = await signedPost(orderUrl, '', accountUrl);
      finalOrder = pollOrder.data;
      waitOrder++;
    }

    if (!finalOrder.certificate) {
      throw new Error(`ACME no devolvió URL de certificado: ${JSON.stringify(finalOrder)}`);
    }

    // 6. Download PEM certificate chain
    const certRes = await signedPost(finalOrder.certificate, '', accountUrl);
    if (certRes.status !== 200 || !certRes.raw.includes('BEGIN CERTIFICATE')) {
      throw new Error(`Error descargando cadena PEM (${certRes.status})`);
    }

    fs.writeFileSync(this.certPath, certRes.raw, 'utf8');
    fs.renameSync(nextKeyPath, this.keyPath);
    try { fs.unlinkSync(csrDerPath); } catch {}

    const rem = this.getValidDaysRemaining();
    this.status = `letsencrypt-valid (${Math.round(rem)}d)`;
    console.log(`✅ [ACME] Certificado Let's Encrypt emitido con éxito para ${this.domain} (${Math.round(rem)} días)`);

    return {
      renewed: true,
      cert: fs.readFileSync(this.certPath),
      key: fs.readFileSync(this.keyPath),
    };
  }
}

module.exports = { AcmeTlsManager };
