const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function repair() {
  console.log('--- REPAIRING CONFIGURATIONS ---');
  
  // 1. Encontrar subpuestos sin configuracion_id pero con turnos en marzo
  const { data: turnos } = await supabase.from('turnos').select('subpuesto_id, configuracion_id').gte('fecha', '2026-03-01').lte('fecha', '2026-03-10').not('configuracion_id', 'is', null);
  
  const map = new Map();
  turnos.forEach(t => map.set(t.subpuesto_id, t.configuracion_id));

  for (const [sid, cid] of map.entries()) {
    const { data: subpuesto } = await supabase.from('subpuestos_trabajo').select('configuracion_id').eq('id', sid).single();
    if (subpuesto && subpuesto.configuracion_id === null) {
      console.log(`Repairing Subpuesto ${sid}: setting configuracion_id = ${cid}`);
      await supabase.from('subpuestos_trabajo').update({ configuracion_id: cid }).eq('id', sid);
    }
  }
  console.log('✅ Configurations repaired.');
}

repair();
