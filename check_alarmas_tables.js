const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://ttkubmwrwgqxjdafpgji.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'alarmas_contact_id_catalogo',
  'alarmas_paneles',
  'alarmas_particiones',
  'alarmas_zonas',
  'alarmas_usuarios_panel',
  'alarmas_contactos_emergencia',
  'alarmas_eventos_historico',
  'alarmas_gestion_bitacora'
];

const views = [
  'v_alarmas_cola_monitoreo',
  'v_alarmas_historial_completo'
];

async function check() {
  console.log("Checking Tables:");
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`❌ Table ${table} ERROR:`, error.message);
    } else {
      console.log(`✅ Table ${table} exists. Columns:`, Object.keys(data[0] || {}));
    }
  }

  console.log("\nChecking Views:");
  for (const view of views) {
    const { data, error } = await supabase.from(view).select('*').limit(1);
    if (error) {
      console.error(`❌ View ${view} ERROR:`, error.message);
    } else {
      console.log(`✅ View ${view} exists. Columns:`, Object.keys(data[0] || {}));
    }
  }
}

check();
