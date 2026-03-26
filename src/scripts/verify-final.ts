import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupabaseService } from '../modules/supabase/supabase.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabase = app.get(SupabaseService).getSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('turnos')
    .select('tipo_turno, concepto_id');

  if (error) {
    console.error(error);
  } else {
    const stats: any = {};
    data.forEach(t => {
      const key = `${t.tipo_turno} (ID: ${t.concepto_id})`;
      stats[key] = (stats[key] || 0) + 1;
    });
    console.log('📊 Resumen Final de Estandarización:');
    console.table(Object.entries(stats).map(([name, count]) => ({ Concepto: name, Total: count })));
  }

  await app.close();
}

run();
