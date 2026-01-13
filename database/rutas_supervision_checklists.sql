-- Migración: Sistema de Checklists Granulares para Supervisión
-- Objetivo: Permitir auditorías detalladas con ítems específicos por tipo de chequeo.

-- 1. Tabla Maestra de Ítems (Preguntas del Checklist)
CREATE TABLE IF NOT EXISTS public.tipos_chequeo_items (
    id SERIAL PRIMARY KEY,
    tipo_chequeo_id INTEGER NOT NULL REFERENCES public.tipos_chequeo(id) ON DELETE CASCADE,
    pregunta TEXT NOT NULL,
    descripcion TEXT,
    obligatorio BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tabla de Resultados de los Checkpoints
CREATE TABLE IF NOT EXISTS public.minutas_rutas_check_resultados (
    id SERIAL PRIMARY KEY,
    minuta_id INTEGER NOT NULL REFERENCES public.minutas_rutas(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES public.tipos_chequeo_items(id),
    resultado VARCHAR(20) NOT NULL, -- 'cumple', 'no_cumple', 'na'
    observacion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_items_tipo ON public.tipos_chequeo_items(tipo_chequeo_id);
CREATE INDEX IF NOT EXISTS idx_resultados_minuta ON public.minutas_rutas_check_resultados(minuta_id);

-- 4. Comentarios de tabla para documentación
COMMENT ON TABLE public.tipos_chequeo_items IS 'Definición de puntos específicos a revisar en cada tipo de supervisión.';
COMMENT ON TABLE public.minutas_rutas_check_resultados IS 'Resultados individuales de cada ítem del checklist durante una inspección.';

-- 5. Insertar algunos ítems de ejemplo para "Supervisor Nocturno" (Asumiendo que ID 1 es Supervisión Nocturna)
-- Nota: Esto es solo ilustrativo, el administrador los creará por Web.
-- INSERT INTO public.tipos_chequeo_items (tipo_chequeo_id, pregunta, orden) VALUES 
-- (1, '¿Vigilante porta carnet y uniforme completo?', 1),
-- (1, '¿Se encuentra el vigilante despierto y alerta?', 2),
-- (1, '¿Libro de minutas foliado y al día?', 3),
-- (1, '¿Estado de los equipos de comunicación?', 4);
