import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupabaseService } from '../modules/supabase/supabase.service';

async function run() {
  console.log('🚀 Iniciando sincronización de seguridad FINAL...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabase = app.get(SupabaseService).getSupabaseAdminClient();

  const queries = [
    // 1. Map 'NORMAL' and 'DIURNO' to 'DIA' (1)
    `SELECT 1 FROM (UPDATE turnos SET tipo_turno = 'DIA', concepto_id = 1 WHERE tipo_turno IN ('NORMAL', 'DIURNO') RETURNING 1) t`,
    // 2. Map 'NOCTURNO' to 'NOCHE' (2)
    `SELECT 1 FROM (UPDATE turnos SET tipo_turno = 'NOCHE', concepto_id = 2 WHERE tipo_turno = 'NOCTURNO' RETURNING 1) t`,
    // 3. Map 'Z' or 'Descanso' to 'DESCANSO' (3)
    `SELECT 1 FROM (UPDATE turnos SET tipo_turno = 'DESCANSO', concepto_id = 3 WHERE tipo_turno IN ('Z', 'Descanso') RETURNING 1) t`,
    // 4. Global Sync: If name matches official name, set the ID
    `SELECT 1 FROM (UPDATE turnos SET concepto_id = c.id FROM conceptos_turno c WHERE turnos.tipo_turno = c.nombre AND turnos.concepto_id IS NULL RETURNING 1) t`,
    // 5. Global Sync Reverse: If ID is set but name is wrong, set official name
    `SELECT 1 FROM (UPDATE turnos SET tipo_turno = c.nombre FROM conceptos_turno c WHERE turnos.concepto_id = c.id AND turnos.tipo_turno != c.nombre RETURNING 1) t`
  ];

  for (let i = 0; i < queries.length; i++) {
    console.log(`📡 Ejecutando paso ${i + 1}...`);
    const { error } = await supabase.rpc('exec_sql', { query: queries[i] });
    if (error) console.error(`❌ Error en paso ${i + 1}:`, error.message);
  }

  await app.close();
  console.log('🎉 Sincronización completada.');
}

run();
