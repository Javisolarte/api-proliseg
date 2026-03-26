import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !key) {
  console.error('❌ Error: Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function standardizeDbShifts() {
  console.log('🔄 Iniciando Script de Estandarización y Deduplicación mejorado...');

  const { data: conceptos, error: conError } = await supabase
    .from('conceptos_turno')
    .select('id, codigo, nombre');
  
  if (conError || !conceptos) {
    console.error('❌ Error obteniendo conceptos:', conError);
    process.exit(1);
  }

  const mapaConceptos = new Map<number, string>();
  conceptos.forEach(c => mapaConceptos.set(c.id, c.nombre));

  let totalTurnos = 0;
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  const toDelete = new Map<number, number>(); // map de idDuplicado -> idGuardado
  const toUpdate = new Map<number, string>();
  const keepTracker = new Map<string, any>();

  while (hasMore) {
    const { data: turnos, error } = await supabase
      .from('turnos')
      .select('id, empleado_id, subpuesto_id, fecha, hora_inicio, concepto_id, tipo_turno, updated_at')
      .range(offset, offset + limit - 1)
      .order('updated_at', { ascending: false }); 

    if (error) {
      console.error(`❌ Error iterando turnos (offset ${offset}):`, error.message);
      break;
    }
    if (!turnos || turnos.length === 0) {
      break;
    }

    totalTurnos += turnos.length;
    console.log(`📡 Analizando ${turnos.length} turnos (Total: ${totalTurnos})...`);

    for (const t of turnos) {
        const horaInicio = t.hora_inicio || '00:00:00';
        const key = `${t.empleado_id}_${t.subpuesto_id}_${t.fecha}_${horaInicio}`;

        if (keepTracker.has(key)) {
            // Es un duplicado. Guardamos a qué original pertenece.
            const kept = keepTracker.get(key);
            toDelete.set(t.id, kept.id);
        } else {
            keepTracker.set(key, t);
            if (t.concepto_id && mapaConceptos.has(t.concepto_id)) {
                const nombreOficial = mapaConceptos.get(t.concepto_id)!;
                if (t.tipo_turno !== nombreOficial) {
                    toUpdate.set(t.id, nombreOficial);
                }
            }
        }
    }
    offset += limit;
  }

  console.log(`📌 Análisis completado. ${toDelete.size} duplicados. ${toUpdate.size} para renombrar.`);

  // 2. Eliminar Duplicados (Cambiando el parent FK a los validos)
  const duplicadosList = Array.from(toDelete.entries());
  for (let i = 0; i < duplicadosList.length; i += 100) {
    const batch = duplicadosList.slice(i, i + 100);
    const deleteIds = batch.map(b => b[0]);

    for (const [idBad, idGood] of batch) {
       // Re-parent de dependencias
       await supabase.from('rutas_supervision_asignacion').update({ turno_id: idGood }).eq('turno_id', idBad);
       // Podríamos tener 'novedades_turnos' u otras.
    }

    const { error: delError } = await supabase.from('turnos').delete().in('id', deleteIds);
    if (delError) {
       console.error(`❌ Fallo borrado en batch de índice ${i}:`, delError.message);
       // A veces pueden quedar otras dependencias. Para no estancar, borraremos individualmente los que se puedan
       if (delError.message.includes('foreign key constraint')) {
          for (const idBad of deleteIds) {
             const res = await supabase.from('turnos').delete().eq('id', idBad);
             if (res.error) console.error(`⚠️ No se pudo borrar el duplicado ${idBad} por FK: ${res.error.message}`);
          }
       }
    }
  }

  // 3. Actualizar Nombres
  const updateEntries = Array.from(toUpdate.entries());
  let u = 0;
  for (const [id, nombreOficial] of updateEntries) {
     await supabase.from('turnos').update({ tipo_turno: nombreOficial }).eq('id', id);
     u++;
     if (u % 500 === 0) console.log(`📝 Actualizados ${u}/${updateEntries.length}`);
  }

  console.log('🎉 Limpieza finalizada.');
  process.exit(0);
}

standardizeDbShifts();
