/**
 * Script para regenerar turnos de ABRIL 2026.
 * 
 * PROCESO:
 * 1. Buscar todos los subpuestos activos con configuración
 * 2. Para cada subpuesto: eliminar turnos de abril 2026 (SOLO abril, NO marzo)
 * 3. Regenerar turnos de abril 2026 usando la lógica corregida con continuidad desde marzo
 * 
 * USO: npx ts-node -r tsconfig-paths/register src/scripts/regenerar-abril-2026.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🚀 Iniciando regeneración de turnos ABRIL 2026...');
  console.log('⚠️  MARZO NO SERÁ TOCADO.\n');

  // 1. Obtener todos los subpuestos activos con configuración
  const { data: subpuestos, error: subError } = await supabase
    .from('subpuestos_trabajo')
    .select(`
      id,
      nombre,
      puesto_id,
      configuracion_id,
      guardas_activos,
      configuracion:configuracion_id (
        id,
        nombre,
        activo,
        tipo_proyeccion
      )
    `)
    .eq('activo', true)
    .not('configuracion_id', 'is', null);

  if (subError || !subpuestos) {
    console.error('❌ Error obteniendo subpuestos:', subError);
    return;
  }

  console.log(`📋 ${subpuestos.length} subpuestos activos encontrados.\n`);

  let totalEliminados = 0;
  let totalGenerados = 0;
  let errores = 0;

  for (const subpuesto of subpuestos) {
    const config = Array.isArray(subpuesto.configuracion) 
      ? subpuesto.configuracion[0] 
      : subpuesto.configuracion;

    if (!config?.activo) {
      console.log(`⏭️  ${subpuesto.nombre} - config inactiva, omitido`);
      continue;
    }

    console.log(`\n🔧 Procesando: ${subpuesto.nombre} (ID: ${subpuesto.id})`);

    // 2. Verificar que hay asignaciones completas
    const { count: asignacionesActivas } = await supabase
      .from('asignacion_guardas_puesto')
      .select('*', { count: 'exact', head: true })
      .eq('subpuesto_id', subpuesto.id)
      .eq('activo', true);

    if (!asignacionesActivas || asignacionesActivas === 0) {
      console.log(`   ⏭️  Sin empleados asignados, omitido`);
      continue;
    }

    // 3. Eliminar turnos de ABRIL 2026 (SOLO abril)
    // Primero desvincular de rutas de supervisión
    try {
      const { data: turnosAbril } = await supabase
        .from('turnos')
        .select('id')
        .eq('subpuesto_id', subpuesto.id)
        .gte('fecha', '2026-04-01')
        .lte('fecha', '2026-04-30');

      if (turnosAbril && turnosAbril.length > 0) {
        const ids = turnosAbril.map(t => t.id);
        
        // Desvincular rutas de supervisión
        await supabase
          .from('rutas_supervision_asignacion')
          .update({ turno_id: null })
          .in('turno_id', ids);

        // Eliminar turnos de abril
        const { data: eliminados, error: delError } = await supabase
          .from('turnos')
          .delete()
          .eq('subpuesto_id', subpuesto.id)
          .gte('fecha', '2026-04-01')
          .lte('fecha', '2026-04-30')
          .neq('tipo_turno', 'RET')
          .select('id');

        const cantEliminados = eliminados?.length || 0;
        totalEliminados += cantEliminados;
        console.log(`   🗑️  ${cantEliminados} turnos de abril eliminados`);

        if (delError) {
          console.error(`   ❌ Error eliminando:`, delError.message);
          errores++;
          continue;
        }
      } else {
        console.log(`   ℹ️  Sin turnos de abril existentes`);
      }
    } catch (err: any) {
      console.error(`   ❌ Error:`, err.message);
      errores++;
      continue;
    }

    // 4. Eliminar el log de generación de abril para permitir regeneración
    await supabase
      .from('turnos_generacion_log')
      .delete()
      .eq('subpuesto_id', subpuesto.id)
      .eq('mes', 4)
      .eq('año', 2026);

    console.log(`   ✅ Listo para regenerar - usará el endpoint automático`);
  }

  // 5. Ahora llamar a la generación automática para abril 2026 a través de la API
  console.log('\n\n🔄 Llamando generación automática para Abril 2026...');
  console.log('   (Esto usará la lógica corregida con continuidad desde historial de marzo)');

  // El endpoint lo haremos mediante fetch al API local
  const apiUrl = `http://localhost:${process.env.PORT || 10000}/api/asignar-turnos/automatico?mes=4&anio=2026`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('\n✅ Resultado de generación automática:', JSON.stringify(result, null, 2));
      totalGenerados = result.generados || 0;
    } else {
      const errorText = await response.text();
      console.error('❌ Error en la API:', response.status, errorText);
      console.log('\n⚠️  La API puede no estar corriendo. Por favor:');
      console.log('   1. Inicia la API con: npm run start:dev');
      console.log('   2. Ejecuta este script de nuevo');
      console.log('   O usa el endpoint directamente: POST /api/asignar-turnos/automatico?mes=4&anio=2026');
    }
  } catch (fetchErr: any) {
    console.log(`\n⚠️  No se pudo conectar a la API (${fetchErr.message})`);
    console.log('   Los turnos de abril fueron ELIMINADOS exitosamente.');
    console.log('   Cuando la API se inicie, la generación automática se ejecutará y');
    console.log('   usará la lógica corregida con continuidad desde marzo.');
    console.log('\n   OPCIÓN 1: Inicia la API y visita en el navegador:');
    console.log('   POST /api/asignar-turnos/automatico?mes=4&anio=2026');
    console.log('\n   OPCIÓN 2: La generación automática se ejecuta a medianoche automáticamente.');
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 RESUMEN:`);
  console.log(`   Turnos de abril eliminados: ${totalEliminados}`);
  console.log(`   Subpuestos procesados: ${subpuestos.length}`);
  console.log(`   Errores: ${errores}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
