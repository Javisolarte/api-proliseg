import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupabaseService } from '../modules/supabase/supabase.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabaseService = app.get(SupabaseService);
  const supabase = supabaseService.getSupabaseAdminClient();

  console.log('Testing exec_sql for DDL...');

  const query = `
    DO $$ 
    BEGIN 
      CREATE TABLE IF NOT EXISTS public.test_ddl (id serial primary key);
    END $$;
    SELECT 1 as result;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query });

  if (error) {
    console.error('❌ RPC Error:', error);
  } else {
    console.log('✅ RPC Success:', data);
  }

  await app.close();
}

run();
