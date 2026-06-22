const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`\n--- Fetching a record from usuarios_externos to see all columns ---`);
  const { data: users, error: userErr } = await adminClient
    .from('usuarios_externos')
    .select('*')
    .limit(1);

  if (userErr) {
    console.error("Error fetching user:", userErr);
  } else if (users && users.length > 0) {
    console.log("usuarios_externos columns:", Object.keys(users[0]));
    console.log("Full user row:", users[0]);
  } else {
    console.log("No users found");
  }

  console.log(`\n--- Fetching a record from personas_gestion_acceso to see all columns ---`);
  const { data: personas, error: perErr } = await adminClient
    .from('personas_gestion_acceso')
    .select('*')
    .limit(1);

  if (perErr) {
    console.error("Error fetching persona:", perErr);
  } else if (personas && personas.length > 0) {
    console.log("personas_gestion_acceso columns:", Object.keys(personas[0]));
    console.log("Full persona row:", personas[0]);
  } else {
    console.log("No personas found");
  }
}

run().catch(console.error);
