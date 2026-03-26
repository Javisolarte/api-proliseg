import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupabaseService } from '../modules/supabase/supabase.service';

async function run() {
  console.log('🔍 Analizando variaciones de nombres en tipo_turno...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabaseService = app.get(SupabaseService);
  const supabase = supabaseService.getSupabaseAdminClient();

  const query = `
    SELECT tipo_turno, concepto_id, count(*) as cantidad
    FROM turnos
    GROUP BY tipo_turno, concepto_id
    ORDER BY cantidad DESC
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query });

  if (error) {
    console.error('❌ Error analizando turnos:', error);
  } else {
    console.log('📊 Resumen de tipo_turno y concepto_id:');
    console.table(data);
  }

  await app.close();
  process.exit(0);
}

run();
