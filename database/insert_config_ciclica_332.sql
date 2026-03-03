-- 1. CREAR LA CONFIGURACIÓN PRINCIPAL
-- Reemplaza el ID o deja que se genere automáticamente. 
-- Usamos un bloque para capturar el ID y usarlo en los detalles.

DO $$
DECLARE
    new_config_id integer;
BEGIN
    -- Insertar configuración principal
    INSERT INTO public.turnos_configuracion (nombre, descripcion, dias_ciclo, activo)
    VALUES ('Cíclica 3D*3N*2Z (8 días)', 'Ciclo rotativo: 3 días de día, 3 días de noche y 2 días de descanso.', 8, true)
    RETURNING id INTO new_config_id;

    -- 2. INSERTAR LOS DETALLES DEL CICLO (8 DÍAS)
    
    -- DÍA 1: DÍA
    INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
    VALUES (new_config_id, 1, 'DIA', '07:00:00', '19:00:00', 1);
    
    -- DÍA 2: DÍA
    INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
    VALUES (new_config_id, 2, 'DIA', '07:00:00', '19:00:00', 1);
    
    -- DÍA 3: DÍA
    INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
    VALUES (new_config_id, 3, 'DIA', '07:00:00', '19:00:00', 1);
    
    -- DÍA 4: NOCHE
    INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
    VALUES (new_config_id, 4, 'NOCHE', '19:00:00', '07:00:00', 1);
    
    -- DÍA 5: NOCHE
    INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
    VALUES (new_config_id, 5, 'NOCHE', '19:00:00', '07:00:00', 1);
    
    -- DÍA 6: NOCHE
    INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
    VALUES (new_config_id, 6, 'NOCHE', '19:00:00', '07:00:00', 1);
    
    -- DÍA 7: DESCANSO (Con hora sombra para el relevo)
    INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
    VALUES (new_config_id, 7, 'Z', '07:00:00', '19:00:00', 1);
    
    -- DÍA 8: DESCANSO (Con hora sombra para el relevo)
    INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
    VALUES (new_config_id, 8, 'Z', '19:00:00', '07:00:00', 1);

    RAISE NOTICE 'Configuración creada con ID: %', new_config_id;
END $$;
