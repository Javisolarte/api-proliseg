const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Checking active sessions in DB...");
  const { data: sessions, error } = await adminClient
    .from('sesiones_usuario')
    .select('*')
    .eq('activa', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching sessions:", error);
    return;
  }

  console.log(`Found ${sessions?.length || 0} active sessions.`);
  for (const s of sessions || []) {
    const { data: extUser } = await adminClient
      .from('usuarios_externos')
      .select('*')
      .eq('id', s.usuario_id)
      .maybeSingle();

    console.log(`\n--- Session ID: ${s.id} ---`);
    console.log(`User: ${extUser?.nombre_completo} (Email: ${extUser?.correo})`);
    console.log(`Created At: ${s.created_at}, IP: ${s.ip_address}`);

    if (extUser) {
      const { data: resident } = await adminClient
        .from('residentes')
        .select('*')
        .eq('usuario_id', extUser.id)
        .maybeSingle();

      if (resident) {
        console.log(`Resident Profile: Found!`);
        console.log(`  Name: ${resident.nombre_completo}`);
        console.log(`  Document: ${resident.documento}`);
        console.log(`  Puesto ID: ${resident.puesto_id}`);
        console.log(`  Activo: ${resident.activo}`);

        // Check vehicle in control_acceso_recoleccion_registros
        const { data: recopilacionReg } = await adminClient
          .from('control_acceso_recoleccion_registros')
          .select('tiene_vehiculo, placa_vehiculo')
          .eq('cedula', resident.documento)
          .maybeSingle();
        console.log(`  Recopilacion vehicle: tiene_vehiculo=${recopilacionReg?.tiene_vehiculo}, placa=${recopilacionReg?.placa_vehiculo}`);

        // Check vehicle in vehiculos
        const { data: vehiculoReg } = await adminClient
          .from('vehiculos')
          .select('*')
          .eq('tarjeta_propietario', resident.documento);
        console.log(`  Global vehicles table: found ${vehiculoReg?.length || 0} vehicles`);

        // Check vehicle in residentes_vehiculos
        const { data: resVehiculos } = await adminClient
          .from('residentes_vehiculos')
          .select('*')
          .eq('residente_id', resident.id);
        console.log(`  Resident vehicles table: found ${resVehiculos?.length || 0} vehicles`);

        // Check personas_gestion_acceso
        const { data: persona } = await adminClient
          .from('personas_gestion_acceso')
          .select('id, nombre_completo, activo')
          .eq('documento_identidad', resident.documento)
          .eq('activo', true)
          .maybeSingle();

        if (persona) {
          console.log(`  Persona (Access Control): Found (ID: ${persona.id})`);
          
          const { data: permisos } = await adminClient
            .from('acceso_permisos_dispositivos')
            .select('dispositivo:dispositivos_iot(id, nombre_identificador, puesto_id, configuracion_tecnica)')
            .eq('persona_id', persona.id)
            .eq('activo', true);

          console.log(`  Device Permissions: ${permisos?.length || 0}`);
          permisos?.forEach(p => {
            console.log(`    - Device: ${p.dispositivo?.nombre_identificador} (ID: ${p.dispositivo?.id}, Puesto ID: ${p.dispositivo?.puesto_id}, Config: ${JSON.stringify(p.dispositivo?.configuracion_tecnica)})`);
          });
        } else {
          console.log(`  Persona (Access Control): NOT FOUND OR NOT ACTIVE`);
        }
      } else {
        console.log(`Resident Profile: NOT FOUND`);
      }
    }
  }
}

run().catch(console.error);
