import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function globalWipeApril() {
  console.log('🧹 INICIANDO LIMPIEZA TOTAL DE ABRIL 2026...');

  // 1. ELIMINAR TODOS los turnos de Abril (01 al 30)
  const { data: del, error: delError } = await supabase
    .from('turnos')
    .delete()
    .gte('fecha', '2026-04-01')
    .lte('fecha', '2026-04-30')
    .select('id');

  if (delError) {
    console.error('❌ Error eliminando:', delError);
    return;
  }
  
  console.log(`✅ Se han eliminado ${del?.length || 0} turnos de Abril.`);
  
  // 2. Limpiar logs para permitir regeneración limpia
  await supabase
    .from('turnos_generacion_log')
    .delete()
    .eq('mes', 4)
    .eq('año', 2026);
    
  console.log('✅ Logs de generación limpiados para Abril.');
}

globalWipeApril().catch(console.error);
