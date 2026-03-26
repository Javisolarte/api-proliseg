const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function globalAprilMassacre() {
  console.log('🚮 STARTING GLOBAL APRIL MASSACRE (LOOP)...');

  let count = 1;
  while (count > 0) {
    const { count: c, error: cErr } = await supabase
      .from('turnos')
      .select('*', { count: 'exact', head: true })
      .gte('fecha', '2026-04-01')
      .lte('fecha', '2026-04-30');
    
    if (cErr) return console.error(cErr);
    count = c || 0;
    console.log(`Current April Count: ${count}`);
    if (count === 0) break;

    // Obtener un lote de IDs
    const { data: turnos } = await supabase
      .from('turnos')
      .select('id')
      .gte('fecha', '2026-04-01')
      .lte('fecha', '2026-04-30')
      .limit(1000);

    const ids = turnos.map(t => t.id);
    
    // 1. Limpiar referencias
    const { error: fErr } = await supabase.from('rutas_supervision_asignacion').delete().in('turno_id', ids);
    if (fErr) console.warn('Warn FK:', fErr.message);

    // 2. Borrar turnos
    const { error: dErr } = await supabase.from('turnos').delete().in('id', ids);
    if (dErr) console.error('Error deleting:', dErr.message);
    else console.log(`🔪 Killed ${ids.length} turnos.`);

    // Breve espera para no saturar si hay regeneración infinita
    await new Promise(r => setTimeout(r, 2000));
  }

  // Limpiar logs
  await supabase.from('turnos_generacion_log').delete().eq('mes', 4).eq('año', 2026);
  console.log('✅ APRIL 2026 IS FINALLY EMPTY.');
}

globalAprilMassacre().catch(console.error);
