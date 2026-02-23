-- Migración para añadir coordenadas a turnos_asistencia
-- Estas columnas permitirán mostrar el mapa en el detalle de asistencia

ALTER TABLE public.turnos_asistencia
ADD COLUMN IF NOT EXISTS latitud_entrada text,
ADD COLUMN IF NOT EXISTS longitud_entrada text,
ADD COLUMN IF NOT EXISTS latitud_salida text,
ADD COLUMN IF NOT EXISTS longitud_salida text;

COMMENT ON COLUMN public.turnos_asistencia.latitud_entrada IS 'Coordenada latitud al marcar entrada';
COMMENT ON COLUMN public.turnos_asistencia.longitud_entrada IS 'Coordenada longitud al marcar entrada';
COMMENT ON COLUMN public.turnos_asistencia.latitud_salida IS 'Coordenada latitud al marcar salida';
COMMENT ON COLUMN public.turnos_asistencia.longitud_salida IS 'Coordenada longitud al marcar salida';
