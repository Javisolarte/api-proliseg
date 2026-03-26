import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const empIds = [657, 423, 142];
  const { data: turnos } = await supabase
    .from('turnos')
    .select('id, fecha, tipo_turno, empleado_id, creado_por, created_at, subpuesto_id, puesto_id')
    .in('empleado_id', empIds)
    .eq('fecha', '2026-04-01')
    .order('empleado_id', { ascending: true });

  console.log(JSON.stringify(turnos, null, 2));
}

main().catch(console.error);
