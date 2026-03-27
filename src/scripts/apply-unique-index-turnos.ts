/**
 * 🔒 MIGRACIÓN: ÍNDICE ÚNICO EN TABLA TURNOS
 * 
 * Aplica un índice UNIQUE en Supabase para que la base de datos
 * RECHACE físicamente cualquier intento de insertar un turno duplicado
 * (mismo empleado + mismo subpuesto + misma fecha).
 * 
 * IMPORTANTE: Este script usa la service_role_key (admin).
 * Ejecutar UNA SOLA VEZ:
 *   npx ts-node -r tsconfig-paths/register src/scripts/apply-unique-index-turnos.ts
 * 
 * Si el índice ya existe, PostgreSQL lo ignorará sin errores.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function applyIndex() {
  console.log('🔒 Aplicando índice UNIQUE en tabla turnos...\n');

  // ─────────────────────────────────────────────────────────────────
  // El índice único que previene duplicados:
  //   - empleado_id: el empleado
  //   - subpuesto_id: el subpuesto específico
  //   - fecha: el día
  // Un empleado NO puede tener más de un turno por día en el MISMO subpuesto.
  // ─────────────────────────────────────────────────────────────────
  const sql = `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_turnos_unique_emp_sub_fecha
    ON public.turnos (empleado_id, subpuesto_id, fecha)
    WHERE subpuesto_id IS NOT NULL;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query: sql });

  if (error) {
    // Supabase normalmente no expone exec_sql por seguridad.
    // Si falla, mostrar el SQL para ejecutarlo manualmente en el SQL Editor de Supabase.
    console.error('❌ No se pudo aplicar el índice automáticamente.');
    console.error('   Error:', error.message);
    console.log('\n📋 EJECUTA ESTE SQL MANUALMENTE EN EL SQL EDITOR DE SUPABASE:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    console.log('\n✅ Una vez aplicado, el sistema rechazará cualquier duplicado a nivel de DB.');
  } else {
    console.log('✅ Índice UNIQUE aplicado correctamente en tabla turnos.');
    console.log('   Columnas: empleado_id + subpuesto_id + fecha');
    console.log('   El sistema ahora rechaza duplicados a nivel de base de datos.');
  }
}

applyIndex().catch(console.error);
