const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('turnos').select('*').gte('fecha', '2026-04-01').lte('fecha', '2026-04-30').limit(1);
  if (error) return console.error(error);
  console.log(JSON.stringify(data[0], null, 2));
}

check();
