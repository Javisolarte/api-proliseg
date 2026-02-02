-- =============================================
-- FIX: DYNAMIC SQL EXECUTION HELPER (exec_sql)
-- =============================================

-- Esta función permite ejecutar SQL dinámico desde Supabase RPC.
-- Útil para consultas complejas con JOINS dinámicos y filtros.

DROP FUNCTION IF EXISTS public.exec_sql(text);

CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY EXECUTE query;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

COMMENT ON FUNCTION public.exec_sql IS 'Ejecuta una consulta SQL dinámica y retorna los resultados como un conjunto de JSONB';
