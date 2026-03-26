import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const subpuestoId = 17;
  console.log(`--- VERIFICACIÓN SUBPUESTO ${subpuestoId} ---`);

  const { data: turnos, error } = await supabase
    .from('turnos')
    .select('fecha, tipo_turno, empleado:empleado_id(nombre_completo)')
    .eq('subpuesto_id', subpuestoId)
    .gte('fecha', '2026-04-01')
    .lte('fecha', '2026-04-03')
    .order('fecha', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!turnos || turnos.length === 0) {
    console.log('No se encontraron turnos en Abril.');
    return;
  }

  const porFecha: any = {};
  turnos.forEach(t => {
    const f = t.fecha.split('T')[0];
    if (!porFecha[f]) porFecha[f] = [];
    porFecha[f].push(`${(t.empleado as any)?.nombre_completo}: ${t.tipo_turno}`);
  });

  Object.keys(porFecha).sort().forEach(fecha => {
    console.log(`\n📅 ${fecha}:`);
    porFecha[fecha].forEach((info: string) => console.log(`   - ${info}`));
  });

  // Check for collisions (same shift on same day for same subpuesto)
  // This helps confirm that they are properly phased now.
}

verify().catch(console.error);
