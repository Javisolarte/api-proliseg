import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function globalAprilReset() {
  console.log('🚀 INICIANDO RECAMBIO GLOBAL DE ABRIL 2026...');

  // 1. ELIMINAR TODOS los turnos de Abril (01 al 30)
  const { data: del, error: delError } = await supabase
    .from('turnos')
    .delete()
    .gte('fecha', '2026-04-01')
    .lte('fecha', '2026-04-30')
    .select('id');

  if (delError) return console.error('Error eliminando:', delError);
  console.log(`🗑️  Total turnos eliminados en Abril: ${del?.length || 0}`);

  // 2. Limpiar todos los logs de generación de Abril 2026
  await supabase
    .from('turnos_generacion_log')
    .delete()
    .eq('mes', 4)
    .eq('año', 2026);
  
  console.log('✅ Logs de generación limpiados.');

  // 3. Llamar a la API para regenerar TODO el mes de Abril de forma masiva
  const apiUrl = `http://localhost:${process.env.PORT || 10000}/api/asignar-turnos/automatico?mes=4&anio=2026`;
  console.log('🚀 Llamando a la API para regeneración automática masiva...');
  
  try {
    const res = await fetch(apiUrl, { method: 'POST' });
    const json = await res.json();
    console.log('📊 Resultado de Generación:', JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error('❌ Error llamando a la API:', err.message);
  }
}

globalAprilReset().catch(console.error);
