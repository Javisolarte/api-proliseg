const axios = require('axios');
const crypto = require('crypto');

async function debugRpcLogin() {
  const ip = '10.8.0.3';
  const port = 10006;
  const user = 'admin';
  const pass = 'proliseg123';
  const baseUrl = `http://${ip}:${port}`;

  const step1 = await axios.post(`${baseUrl}/RPC2_Login`, {
    method: 'global.login',
    params: { userName: user, password: '', clientType: 'Web3.0' },
    id: 1,
  }, { timeout: 6000 });

  console.log('Step 1 response:', JSON.stringify(step1.data, null, 2));

  const { realm, random } = step1.data.params;
  const sessionId = step1.data.session;

  const ha1 = crypto.createHash('md5').update(`${user}:${realm}:${pass}`).digest('hex').toUpperCase();
  const finalPass = crypto.createHash('md5').update(`${user}:${random}:${ha1}`).digest('hex').toUpperCase();

  console.log('ha1:', ha1, 'finalPass:', finalPass);

  const step2 = await axios.post(`${baseUrl}/RPC2_Login`, {
    method: 'global.login',
    params: {
      userName: user,
      password: finalPass,
      clientType: 'Web3.0',
      authorityType: 'Default',
    },
    session: sessionId,
    id: 2,
  }, { timeout: 6000 });

  console.log('Step 2 response:', JSON.stringify(step2.data, null, 2));
}

debugRpcLogin().catch(e => console.error('Error:', e.response?.data || e.message));
