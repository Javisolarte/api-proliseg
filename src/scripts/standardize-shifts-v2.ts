import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupabaseService } from '../modules/supabase/supabase.service';

async function run() {
  console.log('🚀 Iniciando estandarización COMPLETA de tipos de turno...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabaseService = app.get(SupabaseService);
  const supabase = supabaseService.getSupabaseAdminClient();

  const mappings = [
    // DIA (1)
    { id: 1, name: 'DIA', codes: ['D', 'DIA', 'DIURNO', 'D12', 'NORMAL'] },
    // NOCHE (2)
    { id: 2, name: 'NOCHE', codes: ['N', 'NOCHE', 'NOCTURNO', 'N12'] },
    // DESCANSO (3)
    { id: 3, name: 'DESCANSO', codes: ['Z', 'DESCANSO', 'Descanso', 'X', 'OFF', 'Z_RELEVO'] },
    // INDUCCION (4)
    { id: 4, name: 'INDUCCION', codes: ['IND', 'INDUCCION'] },
    // RETIRADO (5)
    { id: 5, name: 'RETIRADO', codes: ['RET', 'RETIRADO'] },
    // LICENCIA (6)
    { id: 6, name: 'LICENCIA', codes: ['LIC', 'LICENCIA'] },
    // PNR (7)
    { id: 7, name: 'PERMISO NO REMUNERADO', codes: ['PNR', 'PERMISO NO REMUNERADO'] },
    // SANCION (8)
    { id: 8, name: 'SANCION', codes: ['SAN', 'SANCION'] },
    // INCAPACIDAD (9)
    { id: 9, name: 'INCAPACIDAD', codes: ['INC', 'INCAPACIDAD'] },
    // VACACIONES (10 / 11)
    { id: 10, name: 'VACACIONES', codes: ['V', 'VACACIONES'] },
    { id: 11, name: 'VACACIONES PAGADAS', codes: ['Vp', 'VACACIONES PAGADAS'] },
    // REEMPLAZO (12)
    { id: 12, name: 'REEMPLAZO', codes: ['R', 'REEMPLAZO', 'Dr'] },
    // EXTRA (13)
    { id: 13, name: 'EXTRA', codes: ['DX', 'NX', 'EXTRA'] }
  ];

  for (const m of mappings) {
    console.log(`📡 Procesando mapping para [${m.name}] (IDs: ${m.codes.join(', ')})`);
    
    // Convertir lista de códigos para SQL: 'D', 'DIA', ...
    const codesList = m.codes.map(c => `'${c}'`).join(', ');

    const query = `
      SELECT 1 AS res
      FROM (
        UPDATE public.turnos
        SET tipo_turno = '${m.name}',
            concepto_id = ${m.id}
        WHERE (tipo_turno IN (${codesList}) OR concepto_id = ${m.id})
        AND (tipo_turno != '${m.name}' OR concepto_id IS NULL)
        RETURNING 1
      ) sub
    `;

    const { error } = await supabase.rpc('exec_sql', { query });
    if (error) {
      console.error(`❌ Error actualizando [${m.name}]:`, error.message);
    } else {
      console.log(`✅ [${m.name}] estandarizado.`);
    }
  }

  // Caso especial: RELEVO (Inferencia por horario)
  console.log('📡 Procesando caso especial [RELEVO]...');
  const relevoQuery = `
    SELECT 1 AS res
    FROM (
      UPDATE public.turnos
      SET tipo_turno = CASE 
            WHEN hora_inicio >= '17:00:00' OR hora_inicio < '05:00:00' THEN 'NOCHE'
            ELSE 'DIA'
          END,
          concepto_id = CASE 
            WHEN hora_inicio >= '17:00:00' OR hora_inicio < '05:00:00' THEN 2
            ELSE 1
          END
      WHERE tipo_turno = 'RELEVO'
      RETURNING 1
    ) sub
  `;
  const { error: relError } = await supabase.rpc('exec_sql', { query: relevoQuery });
  if (relError) {
    console.error(`❌ Error actualizando RELEVO:`, relError.message);
  } else {
    console.log('✅ RELEVO estandarizado según horario.');
  }

  // Limpieza final de concepto_id NULL que tengan nombres conocidos pero no mapeados arriba por alguna razón
  // (Por si quedaron registros de tipo_turno literal pero sin ID)
  console.log('📡 Sincronización final de IDs basados en nombres oficiales...');
  const syncQuery = `
    SELECT 1 AS res
    FROM (
      UPDATE public.turnos
      SET concepto_id = c.id
      FROM public.conceptos_turno c
      WHERE public.turnos.tipo_turno = c.nombre
      AND public.turnos.concepto_id IS NULL
      RETURNING 1
    ) sub
  `;
  await supabase.rpc('exec_sql', { query: syncQuery });

  await app.close();
  console.log('🎉 Finalizada la estandarización absoluta.');
  process.exit(0);
}

run();
