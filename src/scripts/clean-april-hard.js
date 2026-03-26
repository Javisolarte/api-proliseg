const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanAprilHard() {
  console.log('🚮 STARTING HARD CLEANUP FOR APRIL 2026...');

  // 1. Obtener IDs de todos los turnos de Abril
  const { data: turnos, error: tError } = await supabase
    .from('turnos')
    .select('id')
    .gte('fecha', '2026-04-01')
    .lte('fecha', '2026-04-30');
    
  if (tError) return console.error('Error fetching turnos:', tError);
  const ids = turnos.map(t => t.id);
  console.log(`Initial count in April: ${ids.length}`);

  if (ids.length === 0) {
    console.log('No turnos found in April. Already clean?');
    return;
  }

  // 2. ELIMINAR dependencias en rutas_supervision_asignacion
  // Lo hacemos por lotes para no saturar
  console.log('🧹 Cleaning foreign key references...');
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { error: fError } = await supabase
      .from('rutas_supervision_asignacion')
      .delete()
      .in('turno_id', chunk);
    if (fError) console.warn('Warning deleting refs:', fError.message);
  }

  // 3. ELIMINAR los turnos de Abril
  console.log('🔪 Executing global April massacre...');
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { error: dError } = await supabase
      .from('turnos')
      .delete()
      .in('id', chunk);
    if (dError) console.error('Error deleting turnos:', dError.message);
  }

  // 4. Limpiar logs
  await supabase.from('turnos_generacion_log').delete().eq('mes', 4).eq('año', 2026);

  // 5. Verificación final
  const { count } = await supabase.from('turnos').select('*', { count: 'exact', head: true }).gte('fecha', '2026-04-01').lte('fecha', '2026-04-30');
  console.log(`✅ FINAL TOTAL in April: ${count}`);
}

cleanAprilHard().catch(console.error);
