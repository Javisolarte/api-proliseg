import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AsignarTurnosService } from '../modules/asignar_turnos/asignar_turnos.service';
import { SupabaseService } from '../modules/supabase/supabase.service';

async function run() {
  console.log('🏗️ Iniciando contexto de NestJS...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(AsignarTurnosService);
  const supabaseService = app.get(SupabaseService);
  const supabase = supabaseService.getClient();
  
  const mes = 4;
  const año = 2026;
  const fechaInicio = '2026-04-01';
  const fechaFin = '2026-04-30';
  
  console.log(`🚀 Iniciando regeneración TOTAL para ${mes}/${año}...`);
  
  // 1. Obtener subpuestos
  const { data: subpuestos } = await supabase
    .from('subpuestos_trabajo')
    .select('id, nombre')
    .eq('activo', true)
    .not('configuracion_id', 'is', null);

  if (!subpuestos) {
    console.error('No se encontraron subpuestos.');
    await app.close();
    return;
  }

  for (const sub of subpuestos) {
    console.log(`\n🔹 Procesando: ${sub.nombre} (ID: ${sub.id})`);
    
    // 2. Limpiar turnos existentes (evitar duplicados y asegurar limpieza de errores previos)
    const { error: delError } = await supabase
      .from('turnos')
      .delete()
      .eq('subpuesto_id', sub.id)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .neq('tipo_turno', 'RET');

    if (delError) console.error(`   ⚠️ Error al limpiar turnos: ${delError.message}`);

    // 3. Limpiar log de generación
    await supabase
      .from('turnos_generacion_log')
      .delete()
      .eq('subpuesto_id', sub.id)
      .eq('mes', mes)
      .eq('año', año);
    
    // 4. Generar
    try {
        const dto = {
            subpuesto_id: sub.id,
            fecha_inicio: fechaInicio,
            asignado_por: 203
        };
        const result = await service.asignarTurnos(dto as any);
        console.log(`   ✅ Generados ${result.total_turnos} turnos.`);
    } catch (err) {
        console.error(`   ❌ Error al generar: ${err.message}`);
    }
  }
  
  console.log('\n✨ Regeneración masiva completada exitosamente.');
  await app.close();
}

run().catch(err => {
    console.error('💥 Error fatal en el script:', err);
    process.exit(1);
});
