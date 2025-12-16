-- ============================================================
-- Script simplificado para eliminar triggers obsoletos
-- ============================================================

-- Paso 1: Ver todos los triggers en asignacion_guardas_puesto
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgrelid = 'asignacion_guardas_puesto'::regclass
AND tgisinternal = false;

-- Paso 2: Eliminar triggers específicos (ejecuta uno por uno según lo que veas arriba)
-- Descomenta y ejecuta las líneas que correspondan a los triggers que veas:

-- DROP TRIGGER IF EXISTS actualizar_numero_guardas_trigger ON asignacion_guardas_puesto;
-- DROP TRIGGER IF EXISTS sync_guardas_count ON asignacion_guardas_puesto;
-- DROP TRIGGER IF EXISTS update_puesto_guardas ON asignacion_guardas_puesto;
-- DROP TRIGGER IF EXISTS trg_update_guardas ON asignacion_guardas_puesto;

-- Paso 3: Ver funciones que contienen "numero_guardas" en su nombre
SELECT 
    proname AS function_name,
    pronargs AS num_args
FROM pg_proc
WHERE proname LIKE '%numero_guardas%'
OR proname LIKE '%guardas%'
AND pronamespace = 'public'::regnamespace;

-- Paso 4: Eliminar funciones específicas (ejecuta según lo que veas arriba)
-- Descomenta y ejecuta las que correspondan:

-- DROP FUNCTION IF EXISTS actualizar_numero_guardas() CASCADE;
-- DROP FUNCTION IF EXISTS sync_guardas_count() CASCADE;
-- DROP FUNCTION IF EXISTS update_puesto_guardas() CASCADE;
