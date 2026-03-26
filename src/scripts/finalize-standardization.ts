import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupabaseService } from '../modules/supabase/supabase.service';

async function run() {
  console.log('🚀 Iniciando estandarización ULTRA-RÁPIDA vía RPC Trick...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabaseService = app.get(SupabaseService);
  const supabase = supabaseService.getSupabaseAdminClient();

  // 1. Obtener Conceptos
  const { data: conceptos } = await supabase.from('conceptos_turno').select('id, nombre');
  
  if (conceptos) {
    console.log(`📡 Estandarizando ${conceptos.length} tipos de conceptos...`);
    for (const c of conceptos) {
      console.log(`... estandarizando [${c.nombre}]`);
      const query = `
        SELECT 1 AS res 
        FROM (
          UPDATE public.turnos 
          SET tipo_turno = '${c.nombre}' 
          WHERE concepto_id = ${c.id} 
          AND (tipo_turno IS NULL OR tipo_turno != '${c.nombre}')
          RETURNING 1
        ) sub
      `;
      const { error } = await supabase.rpc('exec_sql', { query });
      if (error) console.error(`❌ Error estandarizando ${c.nombre}:`, error);
    }
  }

  // 2. Deduplicación masiva vía RPC Trick
  console.log('📡 Ejecutando deduplicación masiva...');
  const dedupeQuery = `
    SELECT 1 AS res 
    FROM (
      DELETE FROM public.turnos
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM public.turnos
        GROUP BY empleado_id, subpuesto_id, fecha, COALESCE(hora_inicio, '00:00:00')
      )
      RETURNING 1
    ) sub
  `;
  const { error: dedupeError } = await supabase.rpc('exec_sql', { query: dedupeQuery });
  if (dedupeError) {
    console.error('❌ Error en deduplicación:', dedupeError);
  } else {
    console.log('✅ Deduplicación completada.');
  }

  await app.close();
  console.log('🎉 Proceso finalizado.');
  
  console.log('\n=========================================================');
  console.log('⚠️ IMPORTANTE: PARA BLOQUEAR DUPLICADOS PERMANENTEMENTE,');
  console.log('EJECUTA ESTE SQL EN TU DASHBOARD DE SUPABASE:');
  console.log('---------------------------------------------------------');
  console.log("CREATE UNIQUE INDEX idx_turnos_unico_empleado_fecha_hora ON public.turnos (empleado_id, subpuesto_id, fecha, COALESCE(hora_inicio, '00:00:00'));");
  console.log('=========================================================\n');
  
  process.exit(0);
}

run();
