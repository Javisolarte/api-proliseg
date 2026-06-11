const axios = require('axios');
const crypto = require('crypto');

const cameras = [
  { name: 'OFICINA PROLISEG', ip: '181.63.207.251', port: 10199, user: 'admin', pass: 'proliseg12' }
];

function buildDigestHeader(method, url, user, pass, challenge) {
  const { realm, nonce, qop } = challenge;
  const nc = '00000001';
  const cnonce = crypto.randomBytes(4).toString('hex');
  const uri = new URL(url).pathname + (new URL(url).search || '');

  const ha1 = crypto.createHash('md5').update(`${user}:${realm}:${pass}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
  let responseHash = '';

  if (qop === 'auth') {
    responseHash = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
  } else {
    responseHash = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
  }

  let authStr = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${responseHash}"`;
  if (qop === 'auth') {
    authStr += `, qop="${qop}", nc=${nc}, cnonce="${cnonce}"`;
  }
  return authStr;
}

async function requestDigest(method, url, user, pass, body = null) {
  try {
    await axios.request({ method, url, data: body });
  } catch (err) {
    if (err.response && err.response.status === 401) {
      const authHeader = err.response.headers['www-authenticate'];
      if (!authHeader) throw err;
      
      const realm = authHeader.match(/realm="([^"]+)"/)?.[1];
      const nonce = authHeader.match(/nonce="([^"]+)"/)?.[1];
      const qop = authHeader.match(/qop="([^"]+)"/)?.[1];
      
      const challenge = { realm, nonce, qop };
      const header = buildDigestHeader(method, url, user, pass, challenge);
      
      return axios.request({
        method,
        url,
        data: body,
        headers: {
          Authorization: header,
          'Content-Type': 'application/xml',
          'Accept': 'application/xml'
        }
      });
    }
    throw err;
  }
}

async function run() {
  const cam = cameras[0];
  console.log(`Querying capabilities for ${cam.name}...`);
  try {
    const url = `http://${cam.ip}:${cam.port}/ISAPI/System/TwoWayAudio/channels/1`;
    const res = await requestDigest('GET', url, cam.user, cam.pass);
    console.log('--- Audio Channel Capabilities ---');
    console.log(res.data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
