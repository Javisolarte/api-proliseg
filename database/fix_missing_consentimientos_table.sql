-- =============================================
-- FIX: CREATE MISSING consentimientos_empleado TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.consentimientos_empleado (
    id SERIAL PRIMARY KEY,
    empleado_id INTEGER NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
    documento_generado_id INTEGER REFERENCES public.documentos_generados(id) ON DELETE SET NULL,
    tipo_consentimiento VARCHAR(100) NOT NULL, -- 'tratamiento_datos', 'poligrafo', 'visita_domiciliaria', etc.
    acepta BOOLEAN DEFAULT FALSE,
    fecha_consentimiento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    documento_pdf_url TEXT,
    datos_json JSONB,
    vigente BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_consentimientos_emp_id ON public.consentimientos_empleado(empleado_id);
CREATE INDEX IF NOT EXISTS idx_consentimientos_tipo ON public.consentimientos_empleado(tipo_consentimiento);
CREATE INDEX IF NOT EXISTS idx_consentimientos_vigente ON public.consentimientos_empleado(vigente);

-- Comentario descriptivo
COMMENT ON TABLE public.consentimientos_empleado IS 'Registro de consentimientos legales de empleados vinculados a documentos generados';

-- Trigger para updated_at (Si no existe ya la función)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_consentimientos_empleado_updated_at') THEN
        CREATE TRIGGER update_consentimientos_empleado_updated_at 
        BEFORE UPDATE ON public.consentimientos_empleado
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
