import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndersson() {
  const empId = 657; // Andersson
  console.log(`--- TURNOS ABRIL 2026 PARA ANDERSSON (ID: ${empId}) ---`);

  const { data: turnos } = await supabase
    .from('turnos')
    .select('id, fecha, tipo_turno, subpuesto_id, created_at')
    .eq('empleado_id', empId)
    .gte('fecha', '2026-04-01')
    .lte('fecha', '2026-04-01');

  if (turnos) {
    turnos.forEach(t => {
      console.log(`ID: ${t.id} | Fecha: ${t.fecha} | Tipo: ${t.tipo_turno} | Sub: ${t.subpuesto_id} | Created: ${t.created_at}`);
    });
  } else {
    console.log('No turnos found.');
  }
}

checkAndersson().catch(console.error);
