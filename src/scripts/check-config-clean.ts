import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
  const { data: detalles } = await supabase
    .from('detalles_turnos')
    .select('tipo, orden')
    .eq('configuracion_id', 3)
    .order('orden', { ascending: true });

  console.log(JSON.stringify(detalles));
}

checkConfig().catch(console.error);
