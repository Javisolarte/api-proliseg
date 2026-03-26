import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// Extraemos la URL de conexión del admin desde otra variable o desde SUPABASE_URL si tenemos el Postgres string
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Falta DATABASE_URL en .env');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function runSQL() {
  console.log('🔄 Conectando a Supabase (PostgreSQL)...');
  try {
    await client.connect();
    
    console.log('✅ Ejecutando creación de índice único restrictivo...');
    
    // 1. Eliminar índice si ya existe (por seguridad)
    await client.query('DROP INDEX IF EXISTS idx_turnos_unico_empleado_fecha_hora;');
    
    // 2. Eliminar cualquier duplicado exacto REZAGADO que no se haya podido borrar (para que no falle la creación del índice)
    // Esto es un DELETE DELETE ciego que escoge el MAX(id)
    await client.query(`
        DELETE FROM public.turnos
        WHERE id NOT IN (
          SELECT MAX(id)
          FROM public.turnos
          GROUP BY empleado_id, subpuesto_id, fecha, COALESCE(hora_inicio, '00:00:00')
        );
    `);
    console.log('🗑️ Duplicados residuales nivel SQL eliminados.');

    // 3. Crear el índice
    await client.query(`
        CREATE UNIQUE INDEX idx_turnos_unico_empleado_fecha_hora 
        ON public.turnos (empleado_id, subpuesto_id, fecha, COALESCE(hora_inicio, '00:00:00'));
    `);
    console.log('✅ Índice Único Creado con Éxito. (Adiós duplicados)');

  } catch (error) {
    console.error('❌ Error ejecutando SQL:', error);
  } finally {
    await client.end();
  }
}

runSQL();
