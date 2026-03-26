import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: puestos } = await supabase.from('puestos').select('id, nombre');
  puestos?.forEach(p => {
    if (p.nombre.toUpperCase().includes('JARDIN')) {
      console.log(`FOUND: ID=${p.id} Name=${p.nombre}`);
    }
  });
}

main().catch(console.error);
