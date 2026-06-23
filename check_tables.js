const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://ttkubmwrwgqxjdafpgji.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("----- CLIENTES -----");
  const { data: cData, error: cErr } = await supabase.from('clientes').select('*').limit(1);
  if (cErr) console.error("clientes err:", cErr);
  else console.log("clientes cols:", Object.keys(cData[0] || {}));

  console.log("\n----- CONTRATOS -----");
  const { data: conData, error: conErr } = await supabase.from('contratos').select('*').limit(1);
  if (conErr) console.error("contratos err:", conErr);
  else console.log("contratos cols:", Object.keys(conData[0] || {}));

  console.log("\n----- COTIZACIONES -----");
  const { data: cotData, error: cotErr } = await supabase.from('cotizaciones').select('*').limit(1);
  if (cotErr) console.error("cotizaciones err:", cotErr);
  else console.log("cotizaciones cols:", Object.keys(cotData[0] || {}));
}

check();
