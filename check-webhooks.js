const axios = require('axios');

const cameras = [
  { name: 'OFICINA PROLISEG', ip: '181.63.207.251', port: 10199, user: 'admin', pass: 'proliseg12' },
  { name: 'VILLA LUCIANA INTERNO', ip: '10.8.0.2', port: 10150, user: 'admin', pass: 'Proliseg1025' }
];

async function checkCamera(cam) {
  console.log(`\n--- Checking ${cam.name} (${cam.ip}:${cam.port}) ---`);
  const base = `http://${cam.ip}:${cam.port}`;
  const auth = { username: cam.user, password: cam.pass };
  
  try {
    const res = await axios.get(`${base}/ISAPI/Event/notification/httpHosts`, { auth, timeout: 5000 });
    console.log(`Status: ${res.status}`);
    console.log(res.data);
  } catch (err) {
    console.error(`Error checking ${cam.name}: ${err.message}`);
    if (err.response) {
      console.error(`Response code: ${err.response.status}`);
      console.error(err.response.data);
    }
  }
}

async function run() {
  for (const cam of cameras) {
    await checkCamera(cam);
  }
}

run();
