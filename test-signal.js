const { createClient } = require('@supabase/supabase-js');
const net = require('net');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL or SUPABASE key is missing in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSimulation() {
  console.log('🔍 Querying alarmas_paneles from Supabase...');
  
  const { data: panels, error } = await supabase
    .from('alarmas_paneles')
    .select('cuenta_monitoreo, nombre_lugar')
    .limit(5);

  if (error) {
    console.error('Error querying Supabase:', error.message);
    process.exit(1);
  }

  let account = '8844';
  let name = 'Panel de Prueba por Defecto';

  if (panels && panels.length > 0) {
    console.log('Found registered panels:');
    panels.forEach((p, i) => console.log(`[${i}] Cuenta: ${p.cuenta_monitoreo} - ${p.nombre_lugar}`));
    
    account = panels[0].cuenta_monitoreo;
    name = panels[0].nombre_lugar;
    console.log(`Using panel: Cuenta ${account} (${name})`);
  } else {
    console.log('No registered panels found. Using default test account 8844.');
  }

  const packet = `[0001L001004#${account}|18113001004]`;

  const hostIp = '147.93.189.87';
  console.log(`📡 Connecting to alarm receiver at ${hostIp}:10300...`);
  
  const client = net.createConnection({ port: 10300, host: hostIp }, () => {
    console.log('✅ Connected to receiver TCP server!');
    console.log(`📤 Sending Sur-Gard packet: ${packet}`);
    client.write(packet);
  });

  client.on('data', (data) => {
    console.log('📥 Received from receiver:', data);
    console.log('Checking for ACK (Hex 06)...');
    if (data[0] === 0x06) {
      console.log('🎉 ACK received successfully!');
    } else {
      console.log('Unexpected response from server.');
    }
    client.end();
  });

  client.on('end', () => {
    console.log('🔌 Disconnected from TCP server.');
  });

  client.on('error', (err) => {
    console.error('❌ Connection error:', err.message);
    console.log('Please make sure the api-proliseg TCP receiver is running and listening on port 10300 at 147.93.189.87.');
  });
}

runSimulation();