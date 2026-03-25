const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: asignaciones, error } = await supabase
    .from('asignacion_guardas_puesto')
    .select(`
      *,
      empleado:empleado_id (nombre_completo),
      subpuesto:subpuesto_id (
        id, nombre, configuracion_id, guardas_activos,
        configuracion:configuracion_id (*)
      )
    `)
    .eq('activo', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Filter in JS because ilike on joined table in Supabase client might be tricky depending on version
  const daniel = asignaciones.find(a => 
    a.empleado?.nombre_completo.toLowerCase().includes('daniel alexander andrade')
  );

  console.log('--- Daniel Assignment ---');
  console.log(JSON.stringify(daniel, null, 2));

  if (daniel && daniel.subpuesto_id) {
     const { data: otros } = await supabase
        .from('asignacion_guardas_puesto')
        .select('*, empleado:empleado_id(nombre_completo)')
        .eq('subpuesto_id', daniel.subpuesto_id)
        .eq('activo', true);
     
     console.log('--- All employees in this subpuesto ---');
     console.log(JSON.stringify(otros, null, 2));

     const { data: detalles } = await supabase
        .from('turnos_detalle_configuracion')
        .select('*')
        .eq('configuracion_id', daniel.subpuesto.configuracion_id)
        .order('orden', {ascending: true});
     
     console.log('--- Shift Configuration Details ---');
     console.log(JSON.stringify(detalles, null, 2));
  }
}

run();
