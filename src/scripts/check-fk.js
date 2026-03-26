const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkFK() {
  console.log('--- CHECKING FOREIGN KEY DEPENDENCIES ---');
  
  // 1. Encontrar IDs de turnos de Abril
  const { data: turnos } = await supabase
    .from('turnos')
    .select('id')
    .gte('fecha', '2026-04-01')
    .lte('fecha', '2026-04-30');

  const turnoIds = turnos?.map(t => t.id) || [];
  console.log(`Found ${turnoIds.length} turnos in April.`);

  if (turnoIds.length === 0) return;

  // 2. Ver cuántos están referenciados en rutas_supervision_asignacion
  // Dividimos en grupos de 1000 para Supabase
  let refsCount = 0;
  for (let i = 0; i < turnoIds.length; i += 1000) {
    const chunk = turnoIds.slice(i, i + 1000);
    const { count } = await supabase
      .from('rutas_supervision_asignacion')
      .select('*', { count: 'exact', head: true })
      .in('turno_id', chunk); // Reemplaza 'turno_id' por el nombre real de la columna FK
    refsCount += (count || 0);
  }

  console.log(`Total references in rutas_supervision_asignacion: ${refsCount}`);
}

checkFK().catch(console.error);
