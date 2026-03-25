import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AsignarTurnosService } from '../modules/asignar_turnos/asignar_turnos.service';
import { SupabaseService } from '../modules/supabase/supabase.service';

async function run() {
  console.log('🏗️ Inicializando contexto...')
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(AsignarTurnosService);
  const supabaseService = app.get(SupabaseService);
  const supabase = supabaseService.getClient();
  
  const mes = 4;
  const año = 2026;
  const fechaInicio = '2026-04-01';
  const fechaFin = '2026-04-30';
  
  console.log(`🧹 ELIMINANDO TURNOS DE ABRIL 2026 (Respetando Marzo)...`);
  
  // 1. Obtener subpuestos activos
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
    console.log(`\n🔹 [${sub.nombre}]`);
    
    // 2. Limpiar turnos de ABRIL (No tocar nada >= 2026-05-01 o <= 2026-03-31)
    try {
      const { data: turnosAEliminar } = await supabase
        .from('turnos')
        .select('id')
        .eq('subpuesto_id', sub.id)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin);

      if (turnosAEliminar && turnosAEliminar.length > 0) {
        const ids = turnosAEliminar.map(t => t.id);
        await supabase
          .from('rutas_supervision_asignacion')
          .update({ turno_id: null })
          .in('turno_id', ids);
      }
    } catch (err: any) {
      console.warn(`   ⚠️ Error al desvincular rutas: ${err.message}`);
    }

    const { error: delError, data: deleted } = await supabase
      .from('turnos')
      .delete()
      .eq('subpuesto_id', sub.id)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .neq('tipo_turno', 'RET')
      .select('id');

    if (delError) {
        console.error(`   ⚠️ Error al eliminar turnos: ${delError.message}`);
    } else {
        console.log(`   🗑️ Eliminados ${deleted?.length || 0} turnos.`);
    }

    // 3. Limpiar log de generación para que el disparador automático lo tome
    await supabase
      .from('turnos_generacion_log')
      .delete()
      .eq('subpuesto_id', sub.id)
      .eq('mes', mes)
      .eq('año', año);
    
    // 4. Disparar generador para este subpuesto específicamente
    try {
        const dto = {
            subpuesto_id: sub.id,
            fecha_inicio: fechaInicio,
            asignado_por: 203 // Admin
        };
        // fillFromMonthStart: true para que genere el mes completo de abril
        const result = await service.asignarTurnos(dto as any, undefined, true);
        console.log(`   ✅ Generados ${result.total_turnos} turnos nuevos para Abril.`);
    } catch (err) {
        console.error(`   ❌ Error al generar Abril: ${err.message}`);
    }
  }
  
  console.log('\n✨ Proceso de reinicio de Abril completado.');
  await app.close();
}

run().catch(err => {
    console.error('💥 Error fatal:', err);
    process.exit(1);
});
