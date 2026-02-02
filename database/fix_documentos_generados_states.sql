-- =============================================
-- FIX: UPDATE STATE CHECK CONSTRAINT FOR DOCUMENTS
-- =============================================

-- 1. Eliminar el constraint antiguo (que limitaba los estados)
ALTER TABLE public.documentos_generados 
DROP CONSTRAINT IF EXISTS documentos_generados_estado_check;

-- 2. Añadir el nuevo constraint con todos los estados operativos necesarios
-- Incluimos 'generando_pdf' y 'cerrado' que faltaban en la definición inicial
ALTER TABLE public.documentos_generados 
ADD CONSTRAINT documentos_generados_estado_check 
CHECK (estado IN ('borrador', 'generando_pdf', 'pendiente_firmas', 'firmado', 'anulado', 'cerrado', 'enviado'));

-- 3. Asegurar que las columnas de fechas existan (por si no se ejecutó la migración previa)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='documentos_generados' AND column_name='fecha_generacion') THEN
        ALTER TABLE documentos_generados ADD COLUMN fecha_generacion TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='documentos_generados' AND column_name='fecha_envio_firmas') THEN
        ALTER TABLE documentos_generados ADD COLUMN fecha_envio_firmas TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='documentos_generados' AND column_name='fecha_cierre') THEN
        ALTER TABLE documentos_generados ADD COLUMN fecha_cierre TIMESTAMP;
    END IF;
END $$;

COMMENT ON COLUMN public.documentos_generados.estado IS 'Estados: borrador, generando_pdf, pendiente_firmas, firmado, anulado, cerrado, enviado';
