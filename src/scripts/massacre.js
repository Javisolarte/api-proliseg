const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function massacre() {
  console.log('🔥 STARTING GLOBAL APRIL MASSACRE...');
  
  // Borrar de a pedazos si es necesario, pero intentaremos todo de una
  // Usamos un filtro más amplio por si hay problemas de zona horaria: '2026-03-31' a '2026-05-01'
  const { data, error } = await supabase
    .from('turnos')
    .delete()
    .gte('fecha', '2026-04-01')
    .lte('fecha', '2026-04-30')
    .select('id');

  if (error) return console.error('Error during massacre:', error);
  console.log(`🔪 Killed ${data?.length || 0} turnos.`);

  // Si todavía quedan muchos, es que el filtro falla.
  const { count } = await supabase.from('turnos').select('*', { count: 'exact', head: true }).gte('fecha', '2026-04-01').lte('fecha', '2026-04-30');
  console.log(`Remaining in April: ${count}`);

  if (count > 0) {
    console.log('The filter is failing! Checking 5 survivors...');
    const { data: survivors } = await supabase.from('turnos').select('id, fecha').gte('fecha', '2026-04-01').lte('fecha', '2026-04-30').limit(5);
    console.log(JSON.stringify(survivors));
  }
}

massacre();
