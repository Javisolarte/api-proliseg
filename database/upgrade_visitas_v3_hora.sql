-- Adición de columna para hora específica de la visita
ALTER TABLE public.visitas_tecnicas_puesto
ADD COLUMN IF NOT EXISTS hora_programada time without time zone;

-- Comentario para documentación
COMMENT ON COLUMN public.visitas_tecnicas_puesto.hora_programada IS 'Hora específica programada para la visita, complementa a fecha_programada';
