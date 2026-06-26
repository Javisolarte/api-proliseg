const fs = require('fs');
const envPath = './.env';
let supabaseUrl = 'https://ttkubmwrwgqxjdafpgji.supabase.co';
let supabaseKey = '';

const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim(), v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    if (k === 'SUPABASE_URL') supabaseUrl = v;
    if (k === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = v;
  }
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Check all panels and their dispositivo_id linkage
  const { data: panels, error } = await supabase
    .from('alarmas_paneles')
    .select('id, cuenta_monitoreo, nombre_lugar, dispositivo_id, estado_panel');
  
  if (error) { console.error('Error:', error); return; }
  console.log('=== Alarmas Paneles ===');
  console.table(panels);
  
  // Also check the panel for account 8844 specifically
  const panel8844 = panels?.find(p => p.cuenta_monitoreo === '8844');
  if (panel8844) {
    console.log('\n✅ Panel 8844 found:', panel8844);
    if (panel8844.dispositivo_id) {
      // Check the device exists
      const { data: dev } = await supabase
        .from('dispositivos_iot')
        .select('id, nombre_identificador, estado, configuracion_tecnica')
        .eq('id', panel8844.dispositivo_id)
        .maybeSingle();
      console.log('✅ Linked device:', dev);
    } else {
      console.log('⚠️  No dispositivo_id linked! WebSocket events will NOT be emitted for this panel.');
    }
  } else {
    console.log('\n⚠️  No panel with account 8844 found!');
    const firstPanel = panels?.[0];
    if (firstPanel) {
      console.log('First panel:', firstPanel);
    }
  }
}

run();
