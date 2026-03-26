import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const empId = 657; // Andersson
  const { data: turnos } = await supabase
    .from('turnos')
    .select('fecha, tipo_turno, subpuesto_id, puesto_id')
    .eq('empleado_id', empId)
    .gte('fecha', '2026-03-01')
    .lte('fecha', '2026-03-31');

  console.log(JSON.stringify(turnos, null, 2));
}

main().catch(console.error);
