/**
 * 🧹 MARCH 2026 — DUPLICATE CLEANUP (SAFE)
 * 
 * Reglas:
 * - Duplicado = mismo empleado_id + misma fecha + mismo subpuesto_id → más de 1 registro.
 * - Si hay duplicados Y alguno tiene observaciones → se conserva el de mayor ID con obs,
 *   se borran los SIN observaciones del grupo.
 * - Si ninguno tiene observaciones → se conserva el de MAYOR ID, se borran los demás.
 * - ⚠️  Los turnos con observaciones NUNCA se borran aunque sean "duplicados técnicos".
 * 
 * Ejecutar (análisis): DRY_RUN = true  (default)
 * Ejecutar (borrado):  DRY_RUN = false
 * 
 *  npx ts-node -r tsconfig-paths/register src/scripts/march-dedup.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = false; // ← EJECUCIÓN REAL

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const MARCH_START = '2026-03-01';
const MARCH_END   = '2026-03-31';
const BATCH_SIZE  = 200;

interface Turno {
  id: number;
  empleado_id: number;
  subpuesto_id: number;
  puesto_id: number;
  fecha: string;
  tipo_turno: string;
  estado_turno: string;
  observaciones: string | null;
  created_at: string;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ANÁLISIS DE DUPLICADOS — MARZO 2026 ${DRY_RUN ? '(SIMULACIÓN)' : '⚠️  EJECUCIÓN REAL'}`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. Cargar todos los turnos de Marzo
  console.log('📥 Cargando turnos de Marzo 2026...');
  let allTurnos: Turno[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('turnos')
      .select('id, empleado_id, subpuesto_id, puesto_id, fecha, tipo_turno, estado_turno, observaciones, created_at')
      .gte('fecha', MARCH_START)
      .lte('fecha', MARCH_END)
      .order('id', { ascending: true })
      .range(from, from + 999);

    if (error) { console.error('❌', error.message); return; }
    if (!data || data.length === 0) break;
    allTurnos.push(...(data as Turno[]));
    if (data.length < 1000) break;
    from += 1000;
  }

  const total = allTurnos.length;
  const conObs = allTurnos.filter(t => t.observaciones && t.observaciones.trim() !== '');
  console.log(`   Total turnos Marzo: ${total}`);
  console.log(`   Con observaciones:  ${conObs.length} (protegidos)`);

  // 2. Agrupar por clave única
  const grouped = new Map<string, Turno[]>();
  for (const t of allTurnos) {
    const key = `${t.subpuesto_id ?? 'null'}_${t.empleado_id}_${t.fecha}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }

  const duplicateGroups = Array.from(grouped.values()).filter(g => g.length > 1);
  
  if (duplicateGroups.length === 0) {
    console.log('\n✅ No se encontraron duplicados en Marzo 2026.');
    return;
  }

  console.log(`\n⚠️  Grupos duplicados encontrados: ${duplicateGroups.length}`);

  const toDelete: number[] = [];

  for (const group of duplicateGroups) {
    const f = group[0];
    const conObsGroup = group.filter(t => t.observaciones && t.observaciones.trim() !== '');
    const sinObsGroup = group.filter(t => !t.observaciones || t.observaciones.trim() === '');

    let keepId: number;
    let deleteIds: number[] = [];

    if (conObsGroup.length > 0) {
      // Conservar el de mayor ID con obs; borrar solo los sin obs
      keepId = conObsGroup.sort((a, b) => b.id - a.id)[0].id;
      deleteIds = sinObsGroup.map(t => t.id);
    } else {
      // Todos sin obs → conservar mayor ID
      const sorted = group.sort((a, b) => b.id - a.id);
      keepId = sorted[0].id;
      deleteIds = sorted.slice(1).map(t => t.id);
    }

    if (deleteIds.length > 0) {
      console.log(`   SubpuestoID: ${f.subpuesto_id} | PuestoID: ${f.puesto_id} | Emp: ${f.empleado_id} | Fecha: ${f.fecha}`);
      group.forEach(t => {
        const marker = t.id === keepId ? '✅ CONSERVAR' : (deleteIds.includes(t.id) ? '🗑  BORRAR' : '🔒 PROTEGIDO');
        console.log(`     ID: ${t.id} | Obs: ${t.observaciones ? '✔' : '—'} | Estado: ${t.estado_turno} → ${marker}`);
      });
      toDelete.push(...deleteIds);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🗑  TOTAL A ELIMINAR: ${toDelete.length} duplicados`);
  console.log(`✅  SE CONSERVAN:     ${total - toDelete.length} turnos`);
  console.log(`${'='.repeat(60)}`);

  if (DRY_RUN) {
    console.log(`\n⚠️  MODO SIMULACIÓN — No se eliminó nada.`);
    console.log(`   → Cambia DRY_RUN = false para ejecutar el borrado real.\n`);
    return;
  }

  if (toDelete.length === 0) {
    console.log('\n✅ Nada que eliminar.');
    return;
  }

  // 3. Limpiar FKs en lotes
  console.log('\n🔗 Limpiando dependencias FK...');
  const fkTables = [
    { table: 'rutas_supervision_asignacion', col: 'turno_id', action: 'delete' as const },
    { table: 'turnos_asistencia',            col: 'turno_id', action: 'delete' as const },
    { table: 'turnos_reemplazos',            col: 'turno_original_id', action: 'delete' as const },
    { table: 'asistencias',                  col: 'turno_id', action: 'null' as const },
    { table: 'minutas',                      col: 'turno_id', action: 'null' as const },
    { table: 'novedades',                    col: 'turno_id', action: 'null' as const },
  ];

  for (const { table, col, action } of fkTables) {
    let count = 0;
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const batch = toDelete.slice(i, i + BATCH_SIZE);
      if (action === 'delete') {
        const { data } = await supabase.from(table).delete().in(col, batch).select('id');
        count += data?.length || 0;
      } else {
        const upd: Record<string, null> = { [col]: null };
        const { data } = await supabase.from(table).update(upd).in(col, batch).select('id');
        count += data?.length || 0;
      }
    }
    if (count > 0) console.log(`   ✅ ${table}: ${count} filas afectadas`);
  }

  // 4. Borrar duplicados en lotes
  console.log('\n🗑  Eliminando duplicados...');
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('turnos').delete().in('id', batch).select('id');
    if (error) {
      console.error(`   ❌ Error lote ${Math.floor(i/BATCH_SIZE)+1}:`, error.message);
    } else {
      deleted += data?.length || 0;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 DEDUPLICACIÓN COMPLETA`);
  console.log(`   Eliminados: ${deleted} duplicados`);
  console.log(`   Conservados: ${total - deleted} turnos`);
  console.log(`   Turnos con observaciones: INTACTOS ✅`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(console.error);
