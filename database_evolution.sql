ALTER TABLE public.turnos_configuracion 
ADD COLUMN IF NOT EXISTS tipo_proyeccion varchar DEFAULT 'ciclico' 
CHECK (tipo_proyeccion IN ('ciclico', 'semanal_reglas')),
ADD COLUMN IF NOT EXISTS creado_por integer,
ADD COLUMN IF NOT EXISTS actualizado_por integer,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. MODIFICAR DETALLES
ALTER TABLE public.turnos_detalle_configuracion
ADD COLUMN IF NOT EXISTS dias_semana integer[], 
ADD COLUMN IF NOT EXISTS aplica_festivos varchar DEFAULT 'indiferente' 
CHECK (aplica_festivos IN ('indiferente', 'no_aplica', 'solo_festivos')),
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS actualizado_por integer;

-- 3. MODIFICAR ASIGNACIÓN
ALTER TABLE public.asignacion_guardas_puesto
ADD COLUMN IF NOT EXISTS rol_puesto varchar DEFAULT 'titular' 
CHECK (rol_puesto IN ('titular', 'relevante')),
ADD COLUMN IF NOT EXISTS patron_descanso varchar DEFAULT NULL, 
ADD COLUMN IF NOT EXISTS fecha_inicio_patron date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 4. MODIFICAR TURNOS
ALTER TABLE public.turnos
ADD COLUMN IF NOT EXISTS observaciones text;

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

-- 4. FUNCIÓN PARA GENERAR FESTIVOS COLOMBIA (LEY EMILIA)
CREATE OR REPLACE FUNCTION public.generar_festivos_colombia(anio_input integer)
RETURNS void AS $$
DECLARE
    pascua date;
    base_festivos record;
BEGIN
    -- Tabla para almacenar festivos si no existe
    CREATE TABLE IF NOT EXISTS public.festivos_colombia (
        fecha date PRIMARY KEY,
        nombre varchar,
        created_at timestamp DEFAULT now()
    );

    -- 1. Calcular Domingo de Pascua (Algoritmo Butcher-Meeus)
    pascua := (SELECT (
        make_date(anio_input, 3, 1) + 
        ((((19 * (anio_input % 19) + (anio_input / 100) - (anio_input / 400) - ((8 * (anio_input / 100) + 13) / 25) + 15) % 30) + 
          ((2 * (anio_input % 4) + 4 * (anio_input % 7) + 6 * ((19 * (anio_input % 19) + (anio_input / 100) - (anio_input / 400) - ((8 * (anio_input / 100) + 13) / 25) + 15) % 30) + 
            (anio_input / 100) - (anio_input / 400) - 2) % 7) + 22) * interval '1 day')
    )::date);

    -- 2. Lista de festivos fijos y móviles
    WITH raw_dates AS (
        -- Fijos (No se mueven)
        SELECT make_date(anio_input, 1, 1) as f, 'Año Nuevo' as n, false as emilia
        UNION SELECT make_date(anio_input, 5, 1), 'Día del Trabajo', false
        UNION SELECT make_date(anio_input, 7, 20), 'Independencia de Colombia', false
        UNION SELECT make_date(anio_input, 8, 7), 'Batalla de Boyacá', false
        UNION SELECT make_date(anio_input, 12, 8), 'Inmaculada Concepción', false
        UNION SELECT make_date(anio_input, 12, 25), 'Navidad', false
        -- Ley Emilia (Se mueven al lunes si no lo son)
        UNION SELECT make_date(anio_input, 1, 6), 'Reyes Magos', true
        UNION SELECT make_date(anio_input, 3, 19), 'San José', true
        UNION SELECT make_date(anio_input, 6, 29), 'San Pedro y San Pablo', true
        UNION SELECT make_date(anio_input, 8, 15), 'Asunción de la Virgen', true
        UNION SELECT make_date(anio_input, 10, 12), 'Día de la Raza', true
        UNION SELECT make_date(anio_input, 11, 1), 'Todos los Santos', true
        UNION SELECT make_date(anio_input, 11, 11), 'Independencia de Cartagena', true
        -- Basados en Pascua
        UNION SELECT pascua - 3, 'Jueves Santo', false
        UNION SELECT pascua - 2, 'Viernes Santo', false
        UNION SELECT pascua + 43, 'Ascensión del Señor', true
        UNION SELECT pascua + 64, 'Corpus Christi', true
        UNION SELECT pascua + 71, 'Sagrado Corazón de Jesús', true
    ),
    calculated AS (
        SELECT 
            CASE 
                WHEN emilia AND extract(dow from f) <> 1 THEN f + ((8 - extract(dow from f))::int % 7 + 1) * interval '1 day'
                ELSE f 
            END::date as fecha_final,
            n as nombre_final
        FROM raw_dates
    )
    INSERT INTO public.festivos_colombia (fecha, nombre)
    SELECT fecha_final, nombre_final FROM calculated
    ON CONFLICT (fecha) DO UPDATE SET nombre = EXCLUDED.nombre;

END;
$$ LANGUAGE plpgsql;
