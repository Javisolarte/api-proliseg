import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findPuesto() {
  const { data: puestos } = await supabase
    .from('puestos')
    .select('id, nombre')
    .ilike('nombre', '%JARDIN%');
    
  console.log('--- PUESTOS ENCONTRADOS ---');
  puestos?.forEach(p => console.log(`ID: ${p.id} | Nombre: ${p.nombre}`));

  if (!puestos || puestos.length === 0) return;

  const puestoId = puestos[0].id; // Asumimos el primero por ahora

  const { data: subs } = await supabase
    .from('subpuestos_trabajo')
    .select('id, nombre, configuracion_id')
    .eq('puesto_id', puestoId);

  console.log(`\n--- SUBPUESTOS PARA PUESTO ${puestoId} ---`);
  subs?.forEach(s => console.log(`ID: ${s.id} | Nombre: ${s.nombre} | Config: ${s.configuracion_id}`));

  const { data: asigs } = await supabase
    .from('asignacion_guardas_puesto')
    .select('id, empleado_id, subpuesto_id, empleado:empleado_id(nombre_completo)')
    .eq('puesto_id', puestoId)
    .eq('activo', true);

  console.log(`\n--- ASIGNACIONES ACTIVAS ---`);
  asigs?.forEach(a => {
    console.log(`Emp: ${(a.empleado as any)?.nombre_completo} | SubpuestoID: ${a.subpuesto_id}`);
  });
}

findPuesto().catch(console.error);
