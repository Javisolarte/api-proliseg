-- Insertar Configuración 'Horario de Oficina'
INSERT INTO public.turnos_configuracion (nombre, descripcion, dias_ciclo, activo)
VALUES ('Horario de Oficina', 'Lunes a Viernes 8-12 y 14-18, Sábados 8-12. (Automatizado por Sistema)', 7, true);

-- Insertar un detalle dummy para pasar validaciones (aunque la lógica interna lo sobrescribe)
INSERT INTO public.turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
SELECT id, 1, 'OFICINA', '08:00:00', '18:00:00', 1
FROM public.turnos_configuracion 
WHERE nombre = 'Horario de Oficina'
LIMIT 1;

-- Verificar inserción
SELECT * FROM public.turnos_configuracion WHERE nombre = 'Horario de Oficina';
