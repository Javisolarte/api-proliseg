-- ==========================================
-- ESTRUCTURE FOR EMPLOYEE SIGNATURES & AUTO-SIGNING
-- ==========================================

-- 1. Añadir campos a la tabla de empleados para firma recurrente
ALTER TABLE public.empleados 
ADD COLUMN IF NOT EXISTS firma_digital_base64 text,
ADD COLUMN IF NOT EXISTS cargo_oficial character varying;

-- 2. Vincular firmas de documentos directamente a empleados (opcional pero recomendado)
ALTER TABLE public.firmas_documentos
ADD COLUMN IF NOT EXISTS empleado_id integer REFERENCES public.empleados(id);

-- 3. Comentario descriptivo
COMMENT ON COLUMN public.empleados.firma_digital_base64 IS 'Firma digital maestra del empleado para procesos automáticos';
COMMENT ON COLUMN public.firmas_documentos.empleado_id IS 'Referencia directa al empleado que firma';
