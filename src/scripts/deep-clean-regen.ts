import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deepCleanAndRegen() {
  const subpuestoId = 17;
  console.log(`🧹 DEEP CLEAN para subpuesto ${subpuestoId}...`);

  // 1. Eliminar TODOS los turnos de Abril para este subpuesto
  const { data: del, error: delError } = await supabase
    .from('turnos')
    .delete()
    .eq('subpuesto_id', subpuestoId)
    .gte('fecha', '2026-04-01')
    .lte('fecha', '2026-04-30')
    .select('id');

  if (delError) return console.error('Error eliminando:', delError);
  console.log(`🗑️  ${del?.length || 0} turnos eliminados.`);

  // 2. Eliminar el log de generación para permitir re-intento
  await supabase
    .from('turnos_generacion_log')
    .delete()
    .eq('subpuesto_id', subpuestoId)
    .eq('mes', 4)
    .eq('año', 2026);
  
  console.log('✅ Log limpiado. Llamando a la API para regenerar...');

  // 3. Llamar a la API
  const apiUrl = `http://localhost:${process.env.PORT || 10000}/api/asignar-turnos/automatico?subpuesto_id=${subpuestoId}&mes=4&anio=2026`;
  
  try {
    const res = await fetch(apiUrl, { method: 'POST' });
    const json = await res.json();
    console.log('🚀 API Response:', JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.log('⚠️ API may not be running or failed:', err.message);
  }
}

deepCleanAndRegen().catch(console.error);
