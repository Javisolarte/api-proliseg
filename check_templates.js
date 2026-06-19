const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const filePath = 'C:/Users/JaviSol/Downloads/PROLISEG PLATAFORMA/full-version/src/app/demo/features/plantillas/plantillas-test/cotizacion.html';
  const htmlContent = fs.readFileSync(filePath, 'utf8');

  console.log(`Reading HTML content, length: ${htmlContent.length}`);

  const { data, error } = await adminClient
    .from('plantillas_documentos')
    .update({ contenido_html: htmlContent })
    .eq('id', 6)
    .select('id, nombre');
    
  if (error) {
    console.error("Error updating database template:", error);
  } else {
    console.log("Database template successfully updated:", JSON.stringify(data));
  }
}

run().catch(console.error);


