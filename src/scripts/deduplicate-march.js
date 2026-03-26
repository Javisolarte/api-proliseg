const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deduplicate(subpuestoId) {
  console.log(`--- DEDUPLICATING SUBPUESTO ${subpuestoId} FOR MARCH 2026 ---`);
  
  const { data: turnos, error } = await supabase
    .from('turnos')
    .select('id, fecha, empleado_id, observaciones, created_at')
    .eq('subpuesto_id', subpuestoId)
    .gte('fecha', '2026-03-01')
    .lte('fecha', '2026-03-31')
    .order('fecha', { ascending: true });

  if (error) return console.error(error);
  console.log(`Found ${turnos.length} total records in March.`);

  const map = new Map(); // Key: fecha|empleado_id
  const toDelete = [];

  for (const t of turnos) {
    const key = `${t.fecha}|${t.empleado_id}|${t.tipo_turno}`; // Agregue tipo_turno logic if needed
    // Actually, maybe different shift types are valid if they are different times?
    // Let's use fecha|empleado_id as a start, but check if they really overlap.
    const uniqueKey = `${t.fecha}|${t.empleado_id}`;

    if (!map.has(uniqueKey)) {
      map.set(uniqueKey, t);
    } else {
      const existing = map.get(uniqueKey);
      
      // Si el nuevo tiene observaciones y el viejo no, intercambiamos
      if (t.observaciones && !existing.observaciones) {
        toDelete.push(existing.id);
        map.set(uniqueKey, t);
      } else {
        // En cualquier otro caso, borramos el nuevo (duplicado)
        toDelete.push(t.id);
      }
    }
  }

  console.log(`Nodes to keep: ${map.size}`);
  console.log(`Nodes to delete: ${toDelete.length}`);

  if (toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      const { error: dErr } = await supabase.from('turnos').delete().in('id', chunk);
      if (dErr) console.error('Error deleting:', dErr.message);
    }
    console.log('✅ Cleanup finished.');
  }
}

async function run() {
  await deduplicate(17);
  await deduplicate(16);
}

run();
