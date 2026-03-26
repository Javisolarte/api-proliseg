import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  const subpuestoId = 17;
  console.log(`--- CHECKING DUPLICATES FOR ABRIL 1, SUBPUESTO ${subpuestoId} ---`);

  const { data: turnos, error } = await supabase
    .from('turnos')
    .select('id, fecha, tipo_turno, empleado_id, creado_por, created_at, subpuesto_id, puesto_id')
    .eq('subpuesto_id', subpuestoId)
    .eq('fecha', '2026-04-01');

  if (error) return console.error(error);
  
  console.log(`Encontrados ${turnos?.length || 0} turnos para el 1 de Abril en subpuesto ${subpuestoId}`);
  turnos?.forEach(t => {
    console.log(`ID: ${t.id} | Emp: ${t.empleado_id} | Tipo: ${t.tipo_turno} | Creado: ${t.created_at} | Puesto: ${t.puesto_id}`);
  });
}

checkDuplicates().catch(console.error);
