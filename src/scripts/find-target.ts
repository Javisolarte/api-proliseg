import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findEmpPuesto() {
  const { data: emps } = await supabase
    .from('empleados')
    .select('id, nombre_completo')
    .or('nombre_completo.ilike.%ANDERSSON%,nombre_completo.ilike.%JOSE LEONEL%,nombre_completo.ilike.%MARYURI%');
  
  const ids = emps?.map(e => e.id) || [];
  if (ids.length === 0) return console.log('Empleados no encontrados');

  const { data: asigs } = await supabase
    .from('asignacion_guardas_puesto')
    .select('puesto_id, subpuesto_id, subpuesto:subpuesto_id(nombre), puesto:puesto_id(nombre), empleado_id')
    .in('empleado_id', ids)
    .eq('activo', true);

  console.log('--- ASIGNACIONES REVELADORAS ---');
  asigs?.forEach(a => {
    console.log(`Emp: ${a.empleado_id} | Puesto: ${(a.puesto as any)?.nombre} (${a.puesto_id}) | Sub: ${(a.subpuesto as any)?.nombre} (${a.subpuesto_id})`);
  });
}

findEmpPuesto().catch(console.error);
