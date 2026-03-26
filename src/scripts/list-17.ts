import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- ASIGNACIONES PUESTO 17 ---');
  const { data: asigs } = await supabase
    .from('asignacion_guardas_puesto')
    .select('id, empleado_id, subpuesto_id, subpuesto:subpuesto_id(nombre), empleado:empleado_id(nombre_completo)')
    .eq('puesto_id', 17)
    .eq('activo', true);

  asigs?.forEach(a => {
    console.log(`Emp: ${(a.empleado as any)?.nombre_completo} | Subpuesto: ${(a.subpuesto as any)?.nombre} (ID: ${a.subpuesto_id})`);
  });

  console.log('\n--- SUBPUESTOS Y CONFIGURACIONES ---');
  const { data: subs } = await supabase
    .from('subpuestos_trabajo')
    .select('id, nombre, configuracion_id')
    .eq('puesto_id', 17);

  subs?.forEach(s => {
    console.log(`Subpuesto: ${s.nombre} (ID: ${s.id}) | Config: ${s.configuracion_id}`);
  });
}

main().catch(console.error);
