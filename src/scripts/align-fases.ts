import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupabaseService } from '../modules/supabase/supabase.service';

/**
 * Script to calibrate fase_inicial for all active assignments
 * based on their actual shifts at the end of March 2026.
 */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabaseService = app.get(SupabaseService);
  const supabase = supabaseService.getClient();

  console.log('🔍 Iniciando calibración de fases...');

  // 1. Obtener todas las asignaciones con sus configuraciones
  const { data: asignaciones } = await supabase
    .from('asignacion_guardas_puesto')
    .select(`
      *,
      empleado:empleado_id(nombre_completo),
      subpuesto:subpuesto_id(
        id, 
        configuracion:configuracion_id(*)
      )
    `)
    .eq('activo', true);

  if (!asignaciones) return;

  for (const a of asignaciones) {
    const subpuesto = a.subpuesto as any;
    const config = subpuesto?.configuracion;
    if (!config || config.tipo_proyeccion !== 'ciclico') continue;

    const cicloLength = config.dias_ciclo;
    const empleadoId = a.empleado_id;
    const subpuestoId = a.subpuesto_id;

    // 2. Obtener los últimos turnos de marzo
    const { data: turnosMarzo } = await supabase
      .from('turnos')
      .select('fecha, tipo_turno')
      .eq('empleado_id', empleadoId)
      .eq('subpuesto_id', subpuestoId)
      .gte('fecha', '2026-03-25')
      .lte('fecha', '2026-03-31')
      .order('fecha', { ascending: false });

    if (!turnosMarzo || turnosMarzo.length === 0) {
      console.log(`⚠️ No hay turnos en marzo para ${a.empleado.nombre_completo}. Se omite.`);
      continue;
    }

    const ultimoTurno = turnosMarzo[0];
    const penultimoTurno = turnosMarzo[1];

    // 3. Obtener el orden del ciclo
    const { data: detalles } = await supabase
      .from('turnos_detalle_configuracion')
      .select('*')
      .eq('configuracion_id', config.id)
      .order('orden', { ascending: true });

    if (!detalles) continue;

    // 4. Determinar la fase del último turno (31 de marzo)
    const tipo = ultimoTurno.tipo_turno;
    let faseEncontrada = -1;

    // Buscar coincidencias de tipo
    const candidatos = detalles
      .map((d, index) => ({ index, tipo: d.tipo }))
      .filter(d => d.tipo === tipo);

    if (candidatos.length === 1) {
      faseEncontrada = candidatos[0].index;
    } else if (candidatos.length > 1) {
      // Si hay varios (ej: DIA, DIA), mirar el anterior
      if (penultimoTurno) {
        if (penultimoTurno.tipo_turno === tipo) {
          // Es el segundo del mismo tipo
          faseEncontrada = candidatos[1].index;
        } else {
          // Es el primero del mismo tipo
          faseEncontrada = candidatos[0].index;
        }
      } else {
        faseEncontrada = candidatos[0].index; // Asumir primero
      }
    }

    if (faseEncontrada === -1) {
       console.log(`❌ No se pudo determinar la fase para ${a.empleado.nombre_completo} (Tipo: ${tipo})`);
       continue;
    }

    // 5. Back-calculate fase_inicial para el 1 de marzo (30 días antes del 31)
    const faseMarzo1 = ((faseEncontrada - 30) % cicloLength + cicloLength) % cicloLength;

    console.log(`✅ [${a.empleado.nombre_completo}] Fase 31-Mar: ${faseEncontrada} -> Fase 01-Mar: ${faseMarzo1}`);

    // Update assignment
    await supabase
      .from('asignacion_guardas_puesto')
      .update({
        fase_inicial: faseMarzo1,
        fecha_inicio_patron: '2026-03-01'
      })
      .eq('id', a.id);
  }

  console.log('\n✨ Calibración finalizada.');
  await app.close();
}

run();
