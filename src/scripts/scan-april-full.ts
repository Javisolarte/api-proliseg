import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function scanApril() {
  console.log('--- SCANNING ALL APRIL 2026 TURNOS ---');
  
  const { count, error } = await supabase
    .from('turnos')
    .select('*', { count: 'exact', head: true })
    .gte('fecha', '2026-04-01')
    .lte('fecha', '2026-04-30');

  if (error) return console.error(error);
  console.log(`Total Turnos in April in DB: ${count}`);

  if (count && count > 0) {
    const { data } = await supabase
      .from('turnos')
      .select('id, fecha, tipo_turno, puesto_id, subpuesto_id, creado_por, created_at')
      .gte('fecha', '2026-04-01')
      .lte('fecha', '2026-04-30')
      .limit(10);
    
    console.log('Sample Turnos:');
    console.log(JSON.stringify(data, null, 2));
  }
}

scanApril().catch(console.error);
