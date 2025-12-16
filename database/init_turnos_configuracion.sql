-- ============================================
-- SCRIPT: Inicialización de Configuraciones de Turnos
-- Descripción: Inserta los detalles de todas las configuraciones de turnos
-- Fecha: 2025-12-16
-- ============================================

-- 1. Limpiar datos existentes (opcional - comentar si no quieres borrar)
-- DELETE FROM turnos_detalle_configuracion;

-- 2. Insertar detalles de configuración 3: 2D-2N-2Z (PRIORIDAD)
-- Esta es la configuración principal que se implementará primero
INSERT INTO turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
VALUES
  (3, 1, 'DIA', '08:00:00', '20:00:00', 1),
  (3, 2, 'NOCHE', '20:00:00', '08:00:00', 1),
  (3, 3, 'DESCANSO', '00:00:00', '00:00:00', 1)
ON CONFLICT DO NOTHING;

-- 3. Insertar detalles de otras configuraciones (para futuro)

-- Config 1: 3x8 (3 turnos de 8 horas)
INSERT INTO turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
VALUES
  (1, 1, 'MAÑANA', '06:00:00', '14:00:00', 1),
  (1, 2, 'TARDE', '14:00:00', '22:00:00', 1),
  (1, 3, 'NOCHE', '22:00:00', '06:00:00', 1)
ON CONFLICT DO NOTHING;

-- Config 2: 12x12 (2 turnos de 12 horas)
INSERT INTO turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
VALUES
  (2, 1, 'DIA', '07:00:00', '19:00:00', 1),
  (2, 2, 'NOCHE', '19:00:00', '07:00:00', 1)
ON CONFLICT DO NOTHING;

-- Config 4: 4x2 (4 días trabajo, 2 días descanso)
INSERT INTO turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
VALUES
  (4, 1, 'TRABAJO', '08:00:00', '17:00:00', 1),
  (4, 2, 'DESCANSO', '00:00:00', '00:00:00', 1)
ON CONFLICT DO NOTHING;

-- Config 5: 1x24 (24h trabajo, 24h descanso)
INSERT INTO turnos_detalle_configuracion (configuracion_id, orden, tipo, hora_inicio, hora_fin, plazas)
VALUES
  (5, 1, 'GUARDIA_24H', '08:00:00', '08:00:00', 1),
  (5, 2, 'DESCANSO', '00:00:00', '00:00:00', 1)
ON CONFLICT DO NOTHING;

-- 4. Actualizar vista vw_guardas_necesarios_subpuesto
-- Esta vista calcula correctamente los empleados necesarios
DROP VIEW IF EXISTS vw_guardas_necesarios_subpuesto;

CREATE OR REPLACE VIEW vw_guardas_necesarios_subpuesto AS
SELECT 
  s.id AS subpuesto_id,
  s.nombre,
  s.guardas_activos,
  -- Calcular estados del ciclo correctamente
  (SELECT COUNT(DISTINCT tipo) 
   FROM turnos_detalle_configuracion 
   WHERE configuracion_id = s.configuracion_id) AS estados_ciclo,
  -- Guardas necesarios = guardas_activos × estados_ciclo
  s.guardas_activos * (
    SELECT COUNT(DISTINCT tipo) 
    FROM turnos_detalle_configuracion 
    WHERE configuracion_id = s.configuracion_id
  ) AS guardas_necesarios
FROM subpuestos_trabajo s
WHERE s.activo = true AND s.configuracion_id IS NOT NULL;

-- 5. Verificar inserción
SELECT 
  tc.id,
  tc.nombre,
  tc.dias_ciclo,
  COUNT(tdc.id) as num_detalles,
  COUNT(DISTINCT tdc.tipo) as estados_ciclo,
  STRING_AGG(DISTINCT tdc.tipo, ', ' ORDER BY tdc.tipo) as tipos_turno
FROM turnos_configuracion tc
LEFT JOIN turnos_detalle_configuracion tdc ON tc.id = tdc.configuracion_id
GROUP BY tc.id, tc.nombre, tc.dias_ciclo
ORDER BY tc.id;

-- 6. Verificar vista
SELECT * FROM vw_guardas_necesarios_subpuesto LIMIT 5;
