import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupabaseService } from '../modules/supabase/supabase.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabase = app.get(SupabaseService).getSupabaseAdminClient();
  const { data } = await supabase.from('conceptos_turno').select('id, codigo, nombre').order('id', { ascending: true });
  console.table(data);
  await app.close();
}

run();
