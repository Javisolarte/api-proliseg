import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
  const subpuestoId = 17;
  console.log(`--- CONFIGURACIÓN PARA SUBPUESTO ${subpuestoId} ---`);

  const { data: sub } = await supabase
    .from('subpuestos_trabajo')
    .select('configuracion_id')
    .eq('id', subpuestoId)
    .single();

  if (!sub) return console.log('Subpuesto no encontrado');

  const { data: detalles } = await supabase
    .from('detalles_turnos')
    .select('*')
    .eq('configuracion_id', sub.configuracion_id)
    .order('orden', { ascending: true });

  console.log(`Config ID: ${sub.configuracion_id}`);
  detalles?.forEach(d => {
    console.log(`Orden: ${d.orden} | Tipo: ${d.tipo} | Hora: ${d.hora_inicio}-${d.hora_fin}`);
  });
}

checkConfig().catch(console.error);
