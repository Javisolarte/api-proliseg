import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: turnos } = await supabase
    .from('turnos')
    .select('id, tipo_turno, configuracion_id, subpuesto_id, created_at')
    .eq('empleado_id', 657) // Andersson
    .gte('fecha', '2026-04-01')
    .lte('fecha', '2026-04-01');

  console.log(JSON.stringify(turnos, null, 2));
}

main().catch(console.error);
