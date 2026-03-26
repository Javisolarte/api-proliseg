import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function alignMetadata() {
  const data = [
    { id: 657, name: 'ANDERSSON', fase: 2 },
    { id: 423, name: 'JOSE LEONEL', fase: 0 },
    { id: 142, name: 'MARYURI', fase: 4 }
  ];

  console.log('--- ALIGNING METADATA FOR PUESTO 17 ---');
  for (const item of data) {
    const { data: res, error } = await supabase
      .from('asignacion_guardas_puesto')
      .update({
        fase_inicial: item.fase,
        fecha_inicio_patron: '2026-03-01'
      })
      .eq('empleado_id', item.id)
      .eq('puesto_id', 17)
      .eq('activo', true);

    if (error) console.error(`Error for ${item.name}:`, error);
    else console.log(`✅ Updated ${item.name} to fase ${item.fase}`);
  }

  // NUCLEAR WIPE AFTER UPDATE
  console.log('🧹 Wiping April turnos for Puesto 17...');
  await supabase.from('turnos').delete().eq('puesto_id', 17).gte('fecha', '2026-04-01').lte('fecha', '2026-04-30');
  await supabase.from('turnos_generacion_log').delete().eq('puesto_id', 17).eq('mes', 4);

  console.log('🚀 Regenerating via API...');
  const res = await fetch(`http://localhost:10000/api/asignar-turnos/automatico?subpuesto_id=17&mes=4&anio=2026`, { method: 'POST' });
  console.log('API Result:', await res.json());
}

alignMetadata().catch(console.error);
