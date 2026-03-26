import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function nuclearWipe() {
  const puestoId = 17;
  console.log(`🚀 NUCLEAR WIPE para PUESTO ${puestoId} (Abril 2026)...`);

  // 1. Eliminar TODOS los turnos de Abril para este PUESTO (sin importar el subpuesto)
  const { data: del, error: delError } = await supabase
    .from('turnos')
    .delete()
    .eq('puesto_id', puestoId)
    .gte('fecha', '2026-04-01')
    .lte('fecha', '2026-04-30');

  if (delError) return console.error('Error eliminando:', delError);
  console.log(`🗑️  Turnos de puestos eliminados.`);

  // 2. Eliminar turnos de los subpuestos de ese puesto por si acaso
  const { data: subs } = await supabase.from('subpuestos_trabajo').select('id').eq('puesto_id', puestoId);
  const subIds = subs?.map(s => s.id) || [];
  
  if (subIds.length > 0) {
    const { data: delSub } = await supabase
      .from('turnos')
      .delete()
      .in('subpuesto_id', subIds)
      .gte('fecha', '2026-04-01')
      .lte('fecha', '2026-04-30');
    console.log(`🗑️  Turnos de subpuestos eliminados.`);
  }

  // 3. Limpiar logs de generación para Abril 2026
  await supabase.from('turnos_generacion_log').delete().in('subpuesto_id', subIds).eq('mes', 4).eq('año', 2026);
  await supabase.from('turnos_generacion_log').delete().eq('puesto_id', puestoId).eq('mes', 4).eq('año', 2026);

  console.log('✅ Base de datos limpia para Abril 2026. Procediendo a regenerar...');

  // 4. Regenerar para cada subpuesto
  for (const subId of subIds) {
    const apiUrl = `http://localhost:${process.env.PORT || 10000}/api/asignar-turnos/automatico?subpuesto_id=${subId}&mes=4&anio=2026`;
    console.log(`Generating for subpuesto ${subId}...`);
    try {
      const res = await fetch(apiUrl, { method: 'POST' });
      const json = await res.json();
      console.log(`Result ${subId}:`, JSON.stringify(json));
    } catch (e: any) {
      console.log(`Failed ${subId}:`, e.message);
    }
  }
}

nuclearWipe().catch(console.error);
