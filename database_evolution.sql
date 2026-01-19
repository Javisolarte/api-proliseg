-- 1. MODIFICAR CONFIGURACIÓN DE TURNOS
ALTER TABLE public.turnos_configuracion 
ADD COLUMN IF NOT EXISTS tipo_proyeccion varchar DEFAULT 'ciclico' 
CHECK (tipo_proyeccion IN ('ciclico', 'semanal_reglas'));

-- 2. MODIFICAR DETALLES
ALTER TABLE public.turnos_detalle_configuracion
ADD COLUMN IF NOT EXISTS dias_semana integer[], 
ADD COLUMN IF NOT EXISTS aplica_festivos varchar DEFAULT 'indiferente' 
CHECK (aplica_festivos IN ('indiferente', 'no_aplica', 'solo_festivos'));

-- 3. MODIFICAR ASIGNACIÓN
ALTER TABLE public.asignacion_guardas_puesto
ADD COLUMN IF NOT EXISTS rol_puesto varchar DEFAULT 'titular' 
CHECK (rol_puesto IN ('titular', 'relevante')),
ADD COLUMN IF NOT EXISTS patron_descanso varchar DEFAULT NULL, 
ADD COLUMN IF NOT EXISTS fecha_inicio_patron date DEFAULT CURRENT_DATE;

-- A. CREAR CONFIGURACIÓN "MIXTA JACOME" (ITEM 14)
INSERT INTO public.turnos_configuracion (nombre, descripcion, dias_ciclo, tipo_proyeccion, activo)
VALUES ('MIXTO JACOME (ITEM 14)', 'L-V 12h | Sab 5h | Noche Finde', 7, 'semanal_reglas', true)
ON CONFLICT (nombre) DO NOTHING;

-- REGLA 1: Lunes a Viernes (1-5), 07:00-19:00, NO festivos
INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas, dias_semana, aplica_festivos)
VALUES ((SELECT id FROM turnos_configuracion WHERE nombre = 'MIXTO JACOME (ITEM 14)' LIMIT 1), 1, 'DIURNO', '07:00:00', '19:00:00', 1, ARRAY[1,2,3,4,5], 'no_aplica');

-- REGLA 2: Sábados (6), 07:30-12:30, NO festivos
INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas, dias_semana, aplica_festivos)
VALUES ((SELECT id FROM turnos_configuracion WHERE nombre = 'MIXTO JACOME (ITEM 14)' LIMIT 1), 2, 'SABADO_CORTO', '07:30:00', '12:30:00', 1, ARRAY[6], 'no_aplica');

-- REGLA 3: Sábados y Domingos (6,0), 19:00-07:00, Indiferente festivos
INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas, dias_semana, aplica_festivos)
VALUES ((SELECT id FROM turnos_configuracion WHERE nombre = 'MIXTO JACOME (ITEM 14)' LIMIT 1), 3, 'NOCHE_FINDE', '19:00:00', '07:00:00', 1, ARRAY[6,0], 'indiferente');

-- REGLA 4: Festivos, 19:00-07:00
INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas, dias_semana, aplica_festivos)
VALUES ((SELECT id FROM turnos_configuracion WHERE nombre = 'MIXTO JACOME (ITEM 14)' LIMIT 1), 4, 'NOCHE_FESTIVO', '19:00:00', '07:00:00', 1, NULL, 'solo_festivos');

-- B. CREAR CONFIGURACIÓN "4x2 NOCTURNO DIARIO"
INSERT INTO public.turnos_configuracion (nombre, descripcion, dias_ciclo, tipo_proyeccion, activo)
VALUES ('12H NOCTURNA 4x2', 'Todos los dias noche, requiere turnero', 1, 'semanal_reglas', true)
ON CONFLICT (nombre) DO NOTHING;

-- REGLA ÚNICA: Todos los días, 18:00 a 06:00
INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas, dias_semana, aplica_festivos)
VALUES ((SELECT id FROM turnos_configuracion WHERE nombre = '12H NOCTURNA 4x2' LIMIT 1), 1, 'NOCTURNO', '18:00:00', '06:00:00', 1, NULL, 'indiferente');
