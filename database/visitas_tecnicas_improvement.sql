-- Mejoras a la tabla de visitas técnicas post-requerimiento
ALTER TABLE public.visitas_tecnicas_puesto
ADD COLUMN IF NOT EXISTS estado varchar DEFAULT 'programada' 
  CHECK (estado IN ('programada', 'en_proceso', 'completada', 'incumplida', 'cancelada')),
ADD COLUMN IF NOT EXISTS asignado_a int REFERENCES public.usuarios_externos(id),
ADD COLUMN IF NOT EXISTS fecha_programada timestamp without time zone,
ADD COLUMN IF NOT EXISTS cumplida boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notas_programacion text;

-- Asegurar que los campos existentes tengan valores coherentes si ya hay datos
UPDATE public.visitas_tecnicas_puesto 
SET estado = 'completada', cumplida = true 
WHERE fecha_salida IS NOT NULL AND estado = 'programada';
