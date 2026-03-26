import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: sub } = await supabase.from('subpuestos_trabajo').select('configuracion_id').eq('id', 17).single();
  const { data: dets } = await supabase.from('detalles_turnos').select('*').eq('configuracion_id', sub?.configuracion_id).order('orden', { ascending: true });
  console.log('--- CONFIG 17 ---');
  dets?.forEach(d => console.log(`O:${d.orden} | T:${d.tipo}`));
}

main().catch(console.error);
