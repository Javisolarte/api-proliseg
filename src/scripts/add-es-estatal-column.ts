/**
 * 🔒 MIGRACIÓN: AGREGAR COLUMNA es_estatal A puestos_trabajo
 * 
 * Este script agrega la columna 'es_estatal' a la tabla puestos_trabajo.
 * 
 * IMPORTANTE: Este script usa la service_role_key (admin).
 * Ejecutar:
 *   npx ts-node -r tsconfig-paths/register src/scripts/add-es-estatal-column.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🛠️ Agregando columna es_estatal a puestos_trabajo...\n');

  const sql = `
    ALTER TABLE public.puestos_trabajo 
    ADD COLUMN IF NOT EXISTS es_estatal boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS es_monitoreo boolean DEFAULT false;
    
    COMMENT ON COLUMN public.puestos_trabajo.es_estatal IS 'Indica si es un puesto estatal (sector público) para mostrar horas en programación';
    COMMENT ON COLUMN public.puestos_trabajo.es_monitoreo IS 'Indica si es un puesto de monitoreo (no requiere personal, muestra M en programación)';
  `;

  // Intentamos ejecutar via exec_sql (si existe el RPC)
  const { error } = await supabase.rpc('exec_sql', { query: sql });

  if (error) {
    console.error('❌ No se pudo aplicar automáticamente.');
    console.error('   Error:', error.message);
    console.log('\n📋 EJECUTA ESTE SQL MANUALMENTE EN EL SQL EDITOR DE SUPABASE:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
  } else {
    console.log('✅ Columna es_estatal agregada correctamente.');
  }
}

applyMigration().catch(console.error);
