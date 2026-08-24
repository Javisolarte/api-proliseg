const axios = require('axios');
const crypto = require('crypto');

function parseDigestHeader(header) {
  const params = {};
  header.replace(/^Digest\s+/, '').split(/,\s*/).forEach(p => {
    const [key, ...valParts] = p.split('=');
    const val = valParts.join('=').replace(/^"|"$/g, '');
    params[key] = val;
  });
  return params;
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function cgi(ip, port, user, pass, method, path) {
  const baseUrl = `http://${ip}:${port}`;
  const url = `${baseUrl}${path}`;

  const res1 = await axios.get(url, { validateStatus: s => s === 401 || s === 200, timeout: 3000 });
  if (res1.status === 200) {
    return { ok: true, data: res1.data };
  }

  const authHeader = res1.headers['www-authenticate'];
  if (!authHeader || !authHeader.startsWith('Digest')) {
    throw new Error(`Auth header no es Digest: ${authHeader}`);
  }

  const params = parseDigestHeader(authHeader);
  const realm = params.realm || '';
  const nonce = params.nonce || '';
  const qop = params.qop || '';
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');

  const ha1 = md5(`${user}:${realm}:${pass}`);
  const ha2 = md5(`${method}:${path}`);

  let response;
  if (qop === 'auth' || qop.includes('auth')) {
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`);
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
  }

  let header = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${path}", response="${response}"`;
  if (qop) header += `, qop=auth, nc=${nc}, cnonce="${cnonce}"`;
  if (params.opaque) header += `, opaque="${params.opaque}"`;

  const res2 = await axios.get(url, { headers: { Authorization: header }, timeout: 3000 });
  return { ok: true, data: res2.data };
}

const targetDevices = [
  { name: 'Dahua 192.168.10.6 (Oficina WireGuard)', ip: '10.8.0.3', port: 10006, user: 'admin', pass: 'proliseg123', brand: 'Dahua' },
  { name: '192.168.10.199 (Oficina WireGuard)', ip: '10.8.0.3', port: 10199, user: 'admin', pass: 'proliseg12', brand: 'Hikvision' },
  { name: 'Villa Luciana Interno', ip: '10.8.0.2', port: 10150, user: 'admin', pass: 'Proliseg1025', brand: 'Hikvision' },
  { name: 'San Felipe Exterior', ip: '10.30.30.2', port: 10118, user: 'admin', pass: 'proliseg1015', brand: 'Hikvision' }
];

async function checkDevices() {
  console.log(`\n======================================================`);
  console.log(`🔍 REVISIÓN DE CONECTIVIDAD A DISPOSITIVOS EN RED VPN`);
  console.log(`======================================================\n`);

  for (const dev of targetDevices) {
    console.log(`📡 Probando [${dev.name}] → http://${dev.ip}:${dev.port}...`);
    try {
      if (dev.brand === 'Dahua') {
        const res = await cgi(dev.ip, dev.port, dev.user, dev.pass, 'GET', '/cgi-bin/magicBox.cgi?action=getSystemInfo');
        console.log(`   ✅ CONECTADO EXITOSAMENTE [Dahua CGI]`);
        console.log(`   Respuesta:\n${res.data.trim()}\n`);
      } else {
        const url = `http://${dev.ip}:${dev.port}/ISAPI/System/deviceInfo`;
        const res = await axios.get(url, { timeout: 3000, validateStatus: () => true });
        console.log(`   ✅ ALCANZABLE [Status: ${res.status}]\n`);
      }
    } catch (err) {
      console.log(`   ❌ NO ALCANZABLE DESDE ESTA PC LOCAL (${err.message})\n`);
    }
  }
}

checkDevices();
